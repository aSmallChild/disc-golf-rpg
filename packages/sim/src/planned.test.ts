import type { Vec2 } from '@dgrpg/course-format';
import { describe, expect, it } from 'vitest';
import type { ThrowEvent } from './events.ts';
import { distance2 } from './geometry.ts';
import { curveDirection } from './lines.ts';
import { checkPlannedShot, plannedKindFor } from './planned.ts';
import { beginner, type Player, type ShotHeight, type ThrowLine, type ThrowType, tester } from './player.ts';
import { type Action, apply, createRound, previewChance, previewReasons, type RoundState } from './round.ts';
import { flatHole } from './test-hole.ts';

const seeds = Array.from({ length: 300 }, (_, index) => index + 1);
const nearTarget: Vec2 = [30, 95]; // 55 m from the tee, inside 'near'.
const farTarget: Vec2 = [30, 45]; // 105 m from the tee, inside 'far'.

const planned = (
  regionId: string,
  target: Vec2,
  line: ThrowLine = 'straight',
  throwType: ThrowType = 'backhand',
  height: ShotHeight = 'normal',
): Action => ({
  type: 'planned-shot',
  regionId,
  target,
  line,
  throwType,
  height,
});
const standard = (target: Vec2): Action => ({ type: 'standard-shot', target });
const messagesOf = (events: readonly ThrowEvent[]) =>
  events.flatMap((event) => (event.type === 'message' ? [event.text] : []));
const firstFlight = (events: readonly ThrowEvent[]) => events.find((event) => event.type === 'move');
const checkOf = (events: readonly ThrowEvent[]) => {
  const check = events.find((event) => event.type === 'check');
  return check?.type === 'check' ? check : undefined;
};

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
    const upshot = checkPlannedShot(hole, beginner, hole.tee, 'near', nearTarget, 'straight', 'backhand');
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
    const upshot = checkPlannedShot(hole, tester, hole.tee, 'near', nearTarget, 'hyzer', 'backhand');
    const drive = checkPlannedShot(hole, tester, hole.tee, 'far', farTarget, 'anhyzer', 'backhand');
    expect(upshot.allowed && upshot.kind).toBe('upshot');
    expect(drive.allowed && drive.kind).toBe('drive');
  });

  it('rejects locked lines, unknown regions, targets outside the region, and putts', () => {
    const hole = flatHole();
    const straightOnly: Player = { ...tester, lines: ['straight'] };
    expect(
      checkPlannedShot(hole, straightOnly, hole.tee, 'near', nearTarget, 'straight', 'backhand').allowed,
    ).toBe(true);
    expect(
      checkPlannedShot(hole, straightOnly, hole.tee, 'near', nearTarget, 'hyzer', 'backhand').allowed,
    ).toBe(false);
    expect(
      checkPlannedShot(hole, tester, hole.tee, 'nowhere', nearTarget, 'straight', 'backhand').allowed,
    ).toBe(false);
    expect(checkPlannedShot(hole, tester, hole.tee, 'near', farTarget, 'straight', 'backhand').allowed).toBe(
      false,
    );
    expect(checkPlannedShot(hole, tester, [30, 25], 'far', [30, 45], 'straight', 'backhand').allowed).toBe(
      false,
    );
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

  it('shapes RHBH lines the right way: a hyzer is released right and curves left', () => {
    for (const seed of seeds.slice(0, 50)) {
      const round = createRound(flatHole(), tester, seed);
      const bulge = (line: ThrowLine, throwType: ThrowType) => {
        const flight = firstFlight(apply(round, planned('near', nearTarget, line, throwType)).events);
        return flight?.type === 'move' ? flight.leg.fade : Number.NaN;
      };
      // The path bows out opposite the curve: + = thrower's right.
      expect(bulge('hyzer', 'backhand')).toBeGreaterThan(0);
      expect(bulge('anhyzer', 'backhand')).toBeLessThan(0);
      // A forehand mirrors the backhand.
      expect(bulge('hyzer', 'forehand')).toBeLessThan(0);
      expect(bulge('anhyzer', 'forehand')).toBeGreaterThan(0);
    }
  });

  it('names curve directions like a disc golfer would', () => {
    expect(curveDirection('hyzer', 'backhand')).toBe(-1); // RHBH hyzer finishes left.
    expect(curveDirection('anhyzer', 'backhand')).toBe(1);
    expect(curveDirection('hyzer', 'forehand')).toBe(1); // RHFH hyzer finishes right.
    expect(curveDirection('anhyzer', 'forehand')).toBe(-1);
    expect(curveDirection('straight', 'forehand')).toBe(0);
  });

  it('over-curves on a bad release: a wobbly RHBH hyzer ends up left of a clean one', () => {
    // Facing -z from the tee, the thrower's left is -x. Compare mean x of landings by release.
    const results = seeds.map((seed) =>
      apply(createRound(flatHole(), tester, seed), planned('near', nearTarget, 'hyzer', 'backhand')),
    );
    const meanX = (clean: boolean) => {
      const xs = results
        .filter(({ events }) => checkOf(events)?.success === clean)
        .map(({ state }) => state.lie[0]);
      return xs.reduce((sum, x) => sum + x, 0) / xs.length;
    };
    expect(meanX(false)).toBeLessThan(meanX(true));
  });

  it('refuses a forehand the player has not unlocked', () => {
    const hole = flatHole();
    const backhandOnly: Player = { ...tester, throwTypes: ['backhand'] };
    const check = checkPlannedShot(hole, backhandOnly, hole.tee, 'near', nearTarget, 'hyzer', 'forehand');
    expect(check.allowed).toBe(false);
    expect(
      checkPlannedShot(hole, beginner, hole.tee, 'near', nearTarget, 'straight', 'forehand').allowed,
    ).toBe(false);
  });

  it('reports the same chance it rolls against', () => {
    const round = createRound(flatHole(), tester, 4);
    const action = planned('near', nearTarget, 'hyzer', 'forehand');
    const check = apply(round, action).events.find((event) => event.type === 'check');
    expect(check?.type === 'check' && check.chance).toBe(previewChance(round, action));
    expect(check?.type === 'check' && check.label).toBe('Forehand hyzer release into Near fairway');
  });

  it('lands closer to the target than a Standard Shot on average', () => {
    expect(
      meanMiss(tester, {
        type: 'planned-shot',
        regionId: 'near',
        target: nearTarget,
        line: 'straight',
        throwType: 'backhand',
        height: 'normal',
      }),
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
