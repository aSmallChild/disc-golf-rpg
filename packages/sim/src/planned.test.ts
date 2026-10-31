import type { Vec2 } from '@dgrpg/course-format';
import { describe, expect, it } from 'vitest';
import type { ThrowEvent } from './events.ts';
import { distance2 } from './geometry.ts';
import { checkPlannedShot, plannedKindFor } from './planned.ts';
import { beginner, type Player, type ThrowLine, tester } from './player.ts';
import { type Action, apply, createRound, previewChance, previewReasons, type RoundState } from './round.ts';
import { flatHole } from './test-hole.ts';

const seeds = Array.from({ length: 300 }, (_, index) => index + 1);
const nearTarget: Vec2 = [30, 95]; // 55 m from the tee, inside 'near'.
const farTarget: Vec2 = [30, 45]; // 105 m from the tee, inside 'far'.

const planned = (regionId: string, target: Vec2, line: ThrowLine = 'straight'): Action => ({
  type: 'planned-shot',
  regionId,
  target,
  line,
});
const standard = (target: Vec2): Action => ({ type: 'standard-shot', target });
const messagesOf = (events: readonly ThrowEvent[]) =>
  events.flatMap((event) => (event.type === 'message' ? [event.text] : []));
const firstFlight = (events: readonly ThrowEvent[]) => events.find((event) => event.type === 'move');

/** Mean distance from the target over many seeds. */
const meanMiss = (player: Player, action: Action & { readonly target: Vec2 }): number => {
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

  it('are all locked for a beginner, and say why', () => {
    const hole = flatHole();
    const upshot = checkPlannedShot(hole, beginner, hole.tee, 'near', nearTarget, 'straight');
    expect(upshot.allowed).toBe(false);
    expect(!upshot.allowed && upshot.why).toContain('Big Brained Upshot');
    const round = createRound(hole, beginner, 9);
    const result = apply(round, planned('near', nearTarget));
    expect(result.state).toBe(round);
    expect(result.events).toEqual([]);
    expect(previewChance(round, planned('near', nearTarget))).toBeUndefined();
    expect(previewReasons(round, planned('near', nearTarget))).toEqual([]);
  });

  it('are all open to the testing profile, at both lengths', () => {
    const hole = flatHole();
    const upshot = checkPlannedShot(hole, tester, hole.tee, 'near', nearTarget, 'hyzer');
    const drive = checkPlannedShot(hole, tester, hole.tee, 'far', farTarget, 'anhyzer');
    expect(upshot.allowed && upshot.kind).toBe('upshot');
    expect(drive.allowed && drive.kind).toBe('drive');
  });

  it('rejects locked lines, unknown regions, targets outside the region, and putts', () => {
    const hole = flatHole();
    const straightOnly: Player = { ...tester, lines: ['straight'] };
    expect(checkPlannedShot(hole, straightOnly, hole.tee, 'near', nearTarget, 'straight').allowed).toBe(true);
    expect(checkPlannedShot(hole, straightOnly, hole.tee, 'near', nearTarget, 'hyzer').allowed).toBe(false);
    expect(checkPlannedShot(hole, tester, hole.tee, 'nowhere', nearTarget, 'straight').allowed).toBe(false);
    expect(checkPlannedShot(hole, tester, hole.tee, 'near', farTarget, 'straight').allowed).toBe(false);
    expect(checkPlannedShot(hole, tester, [30, 25], 'far', [30, 45], 'straight').allowed).toBe(false);
  });

  it('gives a better release chance than a Standard Shot, with the reason listed', () => {
    const round = createRound(flatHole(), tester, 1);
    const plannedChance = previewChance(round, planned('near', nearTarget)) ?? 0;
    const standardChance = previewChance(round, standard(nearTarget)) ?? 0;
    expect(plannedChance - standardChance).toBe(10);
    expect(previewReasons(round, planned('near', nearTarget))[0]?.source).toContain('Big Brained Shot');
  });

  it('makes hyzers easier and anhyzers harder, and lists the line as a reason', () => {
    const round = createRound(flatHole(), tester, 1);
    const chanceOf = (line: ThrowLine) => previewChance(round, planned('near', nearTarget, line)) ?? 0;
    expect(chanceOf('hyzer') - chanceOf('straight')).toBe(5);
    expect(chanceOf('straight') - chanceOf('anhyzer')).toBe(5);
    expect(previewReasons(round, planned('near', nearTarget, 'hyzer')).map((r) => r.source)).toContain(
      'Hyzer line (forgiving)',
    );
  });

  it('curves the flight left on a hyzer and right on an anhyzer', () => {
    for (const seed of seeds.slice(0, 50)) {
      const round = createRound(flatHole(), tester, seed);
      const hyzer = firstFlight(apply(round, planned('near', nearTarget, 'hyzer')).events);
      const anhyzer = firstFlight(apply(round, planned('near', nearTarget, 'anhyzer')).events);
      expect(hyzer?.type === 'move' && hyzer.leg.fade).toBeLessThan(0);
      expect(anhyzer?.type === 'move' && anhyzer.leg.fade).toBeGreaterThan(0);
    }
  });

  it('reports the same chance it rolls against', () => {
    const round = createRound(flatHole(), tester, 4);
    const action = planned('near', nearTarget, 'hyzer');
    const check = apply(round, action).events.find((event) => event.type === 'check');
    expect(check?.type === 'check' && check.chance).toBe(previewChance(round, action));
    expect(check?.type === 'check' && check.label).toBe('Hyzer release into Near fairway');
  });

  it('lands closer to the target than a Standard Shot on average', () => {
    expect(
      meanMiss(tester, { type: 'planned-shot', regionId: 'near', target: nearTarget, line: 'straight' }),
    ).toBeLessThan(meanMiss(tester, { type: 'standard-shot', target: nearTarget }));
  });

  it('says whether the disc ended up in the chosen region', () => {
    const results = seeds.map((seed) =>
      apply(createRound(flatHole(), tester, seed), planned('near', nearTarget)),
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
    const round: RoundState = createRound(flatHole(), tester, 21);
    const { state } = apply(round, planned('near', nearTarget));
    expect(state.strokes).toBe(1);
    expect(state.lie).not.toEqual(round.lie);
  });
});
