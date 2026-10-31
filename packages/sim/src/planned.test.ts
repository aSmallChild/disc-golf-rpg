import type { Vec2 } from '@dgrpg/course-format';
import { describe, expect, it } from 'vitest';
import type { ThrowEvent } from './events.ts';
import { distance2 } from './geometry.ts';
import { checkPlannedShot, plannedKindFor } from './planned.ts';
import { beginner, type Player } from './player.ts';
import { type Action, apply, createRound, previewChance, previewReasons, type RoundState } from './round.ts';
import { flatHole } from './test-hole.ts';

const seeds = Array.from({ length: 300 }, (_, index) => index + 1);
const nearTarget: Vec2 = [30, 95]; // 55 m from the tee, inside 'near'.
const farTarget: Vec2 = [30, 45]; // 105 m from the tee, inside 'far'.

const planned = (regionId: string, target: Vec2): Action => ({ type: 'planned-shot', regionId, target });
const standard = (target: Vec2): Action => ({ type: 'standard-shot', target });
const messagesOf = (events: readonly ThrowEvent[]) =>
  events.flatMap((event) => (event.type === 'message' ? [event.text] : []));

/** Mean distance from the target over many seeds, counting only in-bounds throws. */
const meanMiss = (player: Player, action: Action): number => {
  const misses = seeds.map((seed) =>
    distance2(apply(createRound(flatHole(), player, seed), action).state.lie, action.target),
  );
  return misses.reduce((sum, miss) => sum + miss, 0) / misses.length;
};

describe('planned shots', () => {
  it('classifies throw length into upshot and drive', () => {
    expect(plannedKindFor([0, 0], [0, 80])).toBe('upshot');
    expect(plannedKindFor([0, 0], [0, 81])).toBe('drive');
  });

  it('allows an unlocked upshot into a region', () => {
    const check = checkPlannedShot(flatHole(), beginner, flatHole().tee, 'near', nearTarget);
    expect(check.allowed && check.kind).toBe('upshot');
  });

  it('rejects a drive the player has not unlocked, and says why', () => {
    const check = checkPlannedShot(flatHole(), beginner, flatHole().tee, 'far', farTarget);
    expect(check.allowed).toBe(false);
    expect(!check.allowed && check.why).toContain('not unlocked');
  });

  it('rejects unknown regions, targets outside the region, and putts', () => {
    const hole = flatHole();
    expect(checkPlannedShot(hole, beginner, hole.tee, 'nowhere', nearTarget).allowed).toBe(false);
    expect(checkPlannedShot(hole, beginner, hole.tee, 'near', farTarget).allowed).toBe(false);
    expect(checkPlannedShot(hole, beginner, [30, 25], 'far', [30, 45]).allowed).toBe(false);
  });

  it('leaves the state alone for an illegal action', () => {
    const round = createRound(flatHole(), beginner, 9);
    const result = apply(round, planned('far', farTarget));
    expect(result.state).toBe(round);
    expect(result.events).toEqual([]);
    expect(previewChance(round, planned('far', farTarget))).toBeUndefined();
    expect(previewReasons(round, planned('far', farTarget))).toEqual([]);
  });

  it('gives a better release chance than a Standard Shot, with the reason listed', () => {
    const round = createRound(flatHole(), beginner, 1);
    const plannedChance = previewChance(round, planned('near', nearTarget)) ?? 0;
    const standardChance = previewChance(round, standard(nearTarget)) ?? 0;
    expect(plannedChance - standardChance).toBe(10);
    expect(previewReasons(round, planned('near', nearTarget))[0]?.source).toContain('Big Brained Shot');
  });

  it('reports the same chance it rolls against', () => {
    const round = createRound(flatHole(), beginner, 4);
    const action = planned('near', nearTarget);
    const check = apply(round, action).events.find((event) => event.type === 'check');
    expect(check?.type === 'check' && check.chance).toBe(previewChance(round, action));
    expect(check?.type === 'check' && check.label).toBe('Release into Near fairway');
  });

  it('lands closer to the target than a Standard Shot on average', () => {
    expect(meanMiss(beginner, planned('near', nearTarget))).toBeLessThan(
      meanMiss(beginner, standard(nearTarget)),
    );
  });

  it('says whether the disc ended up in the chosen region', () => {
    const results = seeds.map((seed) =>
      apply(createRound(flatHole(), beginner, seed), planned('near', nearTarget)),
    );
    const inside = results.filter(({ events }) =>
      messagesOf(events).some((text) => text.startsWith('Landed in')),
    );
    const outside = results.filter(({ events }) =>
      messagesOf(events).some((text) => text.startsWith('Missed')),
    );
    expect(inside.length).toBeGreaterThan(0);
    expect(outside.length).toBeGreaterThan(0);
    expect(inside.length + outside.length).toBe(results.length);
  });

  it('counts a stroke and moves the lie like any throw', () => {
    const round: RoundState = createRound(flatHole(), beginner, 21);
    const { state } = apply(round, planned('near', nearTarget));
    expect(state.strokes).toBe(1);
    expect(state.lie).not.toEqual(round.lie);
  });
});
