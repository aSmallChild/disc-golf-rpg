import type { Hole, Vec2 } from '@dgrpg/course-format';
import type { ThrowEvent } from './events.ts';
import { distance2 } from './geometry.ts';
import type { Player } from './player.ts';
import { PUTT_RANGE, puttChance, resolvePutt } from './putt.ts';
import { createRng, type Rng } from './rng.ts';
import { resolveThrow, throwChance } from './throw.ts';

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
 */
export type Action = { readonly type: 'standard-shot'; readonly target: Vec2 };

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

/** Success chance shown before the shot, from the same functions the throw uses. */
export const previewChance = (state: RoundState, target: Vec2): number =>
  shotKind(state) === 'putt'
    ? puttChance(state.player, state.lie, state.hole.basket)
    : throwChance(state.player, state.lie, target);

/** The core step: `apply(state, action) -> { state, events }`. Never mutates `state`. */
export const apply = (
  state: RoundState,
  action: Action,
): { readonly state: RoundState; readonly events: readonly ThrowEvent[] } => {
  if (state.status !== 'playing') return { state, events: [] };

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

  const shot = resolveThrow(state.hole, state.player, state.lie, action.target, state.rng);
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
