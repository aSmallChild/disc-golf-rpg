import type { Hole, Vec2 } from '@dgrpg/course-format';
import {
  type BasketZone,
  plannedPuttChance,
  plannedPuttReasons,
  resolvePlannedPutt,
} from './basket-zones.ts';
import type { Reason, ThrowEvent } from './events.ts';
import { distance2 } from './geometry.ts';
import { checkPlannedPutt, checkPlannedShot, type Refusal } from './planned.ts';
import type { Player, ThrowLine, ThrowType } from './player.ts';
import { PUTT_RANGE, type PuttResolution, puttChance, puttReasons, resolvePutt } from './putt.ts';
import { createRng, type Rng } from './rng.ts';
import { resolveThrow, type ThrowStyle, throwChance, throwReasons } from './throw.ts';

/** Plain, serialisable state for one player playing one hole. */
export type RoundState = {
  readonly hole: Hole;
  readonly player: Player;
  readonly lie: Vec2;
  readonly strokes: number;
  readonly status: 'playing' | 'holed';
  readonly rng: Rng;
};

/**
 * Actions are the same for humans and bots.
 * - Standard Shot: inside putt range it is a putt at the centre chains, so `target` is ignored there.
 * - Planned Shot: a point inside one of the hole's hand-drawn regions, with a chosen line and throw type.
 * - Planned Putt: a basket zone, inside putt range.
 */
export type Action =
  | { readonly type: 'standard-shot'; readonly target: Vec2 }
  | {
      readonly type: 'planned-shot';
      readonly regionId: string;
      readonly target: Vec2;
      readonly line: ThrowLine;
      readonly throwType: ThrowType;
    }
  | { readonly type: 'planned-putt'; readonly zone: BasketZone };

export type ShotKind = 'throw' | 'putt';

export const createRound = (hole: Hole, player: Player, seed: number): RoundState => ({
  hole,
  player,
  lie: hole.tee,
  strokes: 0,
  status: 'playing',
  rng: createRng(seed),
});

export const distanceToBasket = (state: RoundState): number => distance2(state.lie, state.hole.basket);

export const shotKind = (state: RoundState): ShotKind =>
  distanceToBasket(state) <= PUTT_RANGE ? 'putt' : 'throw';

/** What an allowed action will actually do. */
type Plan =
  | { readonly kind: 'throw'; readonly target: Vec2; readonly style: ThrowStyle }
  | { readonly kind: 'putt' }
  | { readonly kind: 'planned-putt'; readonly zone: BasketZone };

const planFor = (state: RoundState, action: Action): Plan | Refusal => {
  const { hole, player, lie } = state;
  switch (action.type) {
    case 'standard-shot':
      return shotKind(state) === 'putt'
        ? { kind: 'putt' }
        : { kind: 'throw', target: action.target, style: { kind: 'standard' } };
    case 'planned-shot': {
      const check = checkPlannedShot(
        hole,
        player,
        lie,
        action.regionId,
        action.target,
        action.line,
        action.throwType,
      );
      return check.allowed
        ? {
            kind: 'throw',
            target: action.target,
            style: { kind: 'planned', region: check.region, line: action.line, throwType: action.throwType },
          }
        : check;
    }
    case 'planned-putt': {
      const check = checkPlannedPutt(hole, player, lie);
      return check.allowed ? { kind: 'planned-putt', zone: action.zone } : check;
    }
  }
};

const isRefusal = (plan: Plan | Refusal): plan is Refusal => 'allowed' in plan;

/** Whether the action is legal right now, and if not, why (for the UI). */
export const checkAction = (state: RoundState, action: Action): { readonly allowed: true } | Refusal => {
  const plan = planFor(state, action);
  return isRefusal(plan) ? plan : { allowed: true };
};

/** The modifiers shown before the shot, from the same functions the shot uses. Empty if not allowed. */
export const previewReasons = (state: RoundState, action: Action): readonly Reason[] => {
  const plan = planFor(state, action);
  if (isRefusal(plan)) return [];
  const { player, lie, hole } = state;
  switch (plan.kind) {
    case 'putt':
      return puttReasons(player, lie, hole.basket);
    case 'planned-putt':
      return plannedPuttReasons(player, lie, hole.basket, plan.zone);
    case 'throw':
      return throwReasons(player, lie, plan.target, plan.style);
  }
};

/** Success chance shown before the shot. Undefined if the action is not allowed. */
export const previewChance = (state: RoundState, action: Action): number | undefined => {
  const plan = planFor(state, action);
  if (isRefusal(plan)) return undefined;
  const { player, lie, hole } = state;
  switch (plan.kind) {
    case 'putt':
      return puttChance(player, lie, hole.basket);
    case 'planned-putt':
      return plannedPuttChance(player, lie, hole.basket, plan.zone);
    case 'throw':
      return throwChance(player, lie, plan.target, plan.style);
  }
};

const afterPutt = (state: RoundState, putt: PuttResolution) => ({
  state: {
    ...state,
    lie: putt.lie,
    strokes: state.strokes + 1,
    status: putt.holed ? ('holed' as const) : ('playing' as const),
    rng: putt.rng,
  },
  events: putt.events,
});

/** The core step: `apply(state, action) -> { state, events }`. Never mutates `state`. */
export const apply = (
  state: RoundState,
  action: Action,
): { readonly state: RoundState; readonly events: readonly ThrowEvent[] } => {
  if (state.status !== 'playing') return { state, events: [] };
  const plan = planFor(state, action);
  if (isRefusal(plan)) return { state, events: [] };
  const { hole, player, lie, rng } = state;

  switch (plan.kind) {
    case 'putt':
      return afterPutt(state, resolvePutt(hole, player, lie, rng));
    case 'planned-putt':
      return afterPutt(state, resolvePlannedPutt(hole, player, lie, plan.zone, rng));
    case 'throw': {
      const shot = resolveThrow(hole, player, lie, plan.target, rng, plan.style);
      return {
        state: {
          ...state,
          // Out of bounds: one penalty stroke, replay from the previous lie.
          lie: shot.lie ?? lie,
          strokes: state.strokes + (shot.lie ? 1 : 2),
          rng: shot.rng,
        },
        events: shot.events,
      };
    }
  }
};
