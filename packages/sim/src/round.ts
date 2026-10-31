import type { Hole, Vec2 } from '@dgrpg/course-format';
import type { Reason, ThrowEvent } from './events.ts';
import { distance2 } from './geometry.ts';
import { checkPlannedShot, type PlannedShotCheck } from './planned.ts';
import type { Player } from './player.ts';
import { PUTT_RANGE, puttChance, puttReasons, resolvePutt } from './putt.ts';
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
 * Actions are the same for humans and bots. Inside putt range a
 * Standard Shot is a putt at the basket, so `target` is ignored there.
 * A Planned Shot aims at a point inside one of the hole's hand-drawn regions.
 */
export type Action =
  | { readonly type: 'standard-shot'; readonly target: Vec2 }
  | { readonly type: 'planned-shot'; readonly regionId: string; readonly target: Vec2 };

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

/** Whether the action is legal right now, and if not, why (for the UI). */
export const checkAction = (
  state: RoundState,
  action: Action,
): PlannedShotCheck | { readonly allowed: true } =>
  action.type === 'planned-shot'
    ? checkPlannedShot(state.hole, state.player, state.lie, action.regionId, action.target)
    : { allowed: true };

const styleFor = (state: RoundState, action: Action): ThrowStyle | undefined => {
  if (action.type === 'standard-shot') return { kind: 'standard' };
  const check = checkPlannedShot(state.hole, state.player, state.lie, action.regionId, action.target);
  return check.allowed ? { kind: 'planned', region: check.region } : undefined;
};

/** The modifiers shown before the shot, from the same functions the throw uses. Empty if not allowed. */
export const previewReasons = (state: RoundState, action: Action): readonly Reason[] => {
  const style = styleFor(state, action);
  if (!style) return [];
  return shotKind(state) === 'putt'
    ? puttReasons(state.player, state.lie, state.hole.basket)
    : throwReasons(state.player, state.lie, action.target, style);
};

/** Success chance shown before the shot. Undefined if the action is not allowed. */
export const previewChance = (state: RoundState, action: Action): number | undefined => {
  const style = styleFor(state, action);
  if (!style) return undefined;
  return shotKind(state) === 'putt'
    ? puttChance(state.player, state.lie, state.hole.basket)
    : throwChance(state.player, state.lie, action.target, style);
};

/** The core step: `apply(state, action) -> { state, events }`. Never mutates `state`. */
export const apply = (
  state: RoundState,
  action: Action,
): { readonly state: RoundState; readonly events: readonly ThrowEvent[] } => {
  if (state.status !== 'playing') return { state, events: [] };
  const style = styleFor(state, action);
  if (!style) return { state, events: [] };

  if (shotKind(state) === 'putt') {
    const putt = resolvePutt(state.hole, state.player, state.lie, state.rng);
    return {
      state: {
        ...state,
        lie: putt.lie,
        strokes: state.strokes + 1,
        status: putt.holed ? 'holed' : 'playing',
        rng: putt.rng,
      },
      events: putt.events,
    };
  }

  const shot = resolveThrow(state.hole, state.player, state.lie, action.target, state.rng, style);
  return {
    state: {
      ...state,
      // Out of bounds: one penalty stroke, replay from the previous lie.
      lie: shot.lie ?? state.lie,
      strokes: state.strokes + (shot.lie ? 1 : 2),
      rng: shot.rng,
    },
    events: shot.events,
  };
};
