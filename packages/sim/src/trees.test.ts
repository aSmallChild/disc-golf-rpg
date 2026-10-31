import { type Hole, type Tree, trunkRadiusAt, type Vec2 } from '@dgrpg/course-format';
import { describe, expect, it } from 'vitest';
import { DISC_RADIUS } from './disc.ts';
import type { ThrowEvent } from './events.ts';
import { type FlightLeg, flightPoint, legEnd } from './flight.ts';
import { distance2, toVec2 } from './geometry.ts';
import { type Player, tester } from './player.ts';
import { type Action, apply, createRound, previewReasons } from './round.ts';
import { flatHole } from './test-hole.ts';
import { rangeFor } from './throw.ts';
import { trunkReasons } from './trees.ts';

const seeds = Array.from({ length: 200 }, (_, index) => index + 1);

const pro: Player = { ...tester, name: 'Pro', skills: { driving: -3, putting: -3 }, maxRange: 150 };

const tree = (id: string, position: Vec2, trunk: Tree['trunk'], canopy: Tree['canopy']): Tree => ({
  id,
  position,
  trunk,
  canopy,
});
/** Something that never gets in the way. */
const noCanopy: Tree['canopy'] = { radius: 0.01, base: 99, top: 100, density: 0 };
const withTrees = (...trees: readonly Tree[]): Hole => ({ ...flatHole(), trees });

const checksOf = (events: readonly ThrowEvent[], label: string) =>
  events.flatMap((event) => (event.type === 'check' && event.label === label ? [event] : []));
const movesOf = (events: readonly ThrowEvent[]) =>
  events.flatMap((event) => (event.type === 'move' ? [event.leg] : []));
const messagesOf = (events: readonly ThrowEvent[]) =>
  events.flatMap((event) => (event.type === 'message' ? [event.text] : []));
const throwAt = (hole: Hole, player: Player, action: Action) =>
  seeds.map((seed) => apply(createRound(hole, player, seed), action));
const standard = (target: Vec2): Action => ({ type: 'standard-shot', target });
const planned = (target: Vec2, height: 'normal' | 'low'): Action => ({
  type: 'planned-shot',
  regionId: 'near',
  target,
  line: 'straight',
  throwType: 'backhand',
  height,
});

describe('tree encounters', () => {
  // A fat trunk 40 m out on the line from the tee [30, 150] to [30, 60].
  const wall = tree('wall', [30, 110], { radius: 8, height: 40 }, noCanopy);

  it('rolls for a trunk hit, and the disc visibly touches the bark', () => {
    const hits = throwAt(withTrees(wall), pro, standard([30, 60])).filter(
      ({ events }) => checksOf(events, 'Trunk').length > 0,
    );
    expect(hits.length).toBeGreaterThan(seeds.length * 0.4);
    for (const { events } of hits) {
      const moves = movesOf(events);
      const interrupted = moves.find((leg) => leg.end !== undefined);
      expect(interrupted).toBeDefined();
      if (!interrupted?.end) continue;
      const contact = legEnd(interrupted);
      expect(contact).toEqual(interrupted.end);
      // The disc's edge is on the trunk surface at that height.
      const radius = trunkRadiusAt(wall, contact[1]) ?? 0;
      expect(distance2(toVec2(contact), wall.position)).toBeCloseTo(radius + DISC_RADIUS, 6);
      // The next leg starts at the contact point.
      const next = moves[moves.indexOf(interrupted) + 1];
      expect(next?.from).toEqual(contact);
    }
  });

  it('never leaves the disc resting inside a trunk', () => {
    for (const { state } of throwAt(withTrees(wall), pro, standard([30, 60]))) {
      expect(distance2(state.lie, wall.position)).toBeGreaterThanOrEqual(
        wall.trunk.radius + DISC_RADIUS - 1e-9,
      );
    }
  });

  it('ends the disc where the last move ends, even after a kick', () => {
    for (const { state, events } of throwAt(withTrees(wall), pro, standard([30, 60]))) {
      if (events.some((event) => event.type === 'out-of-bounds')) continue;
      const last = movesOf(events).at(-1);
      expect(last && distance2(toVec2(legEnd(last)), state.lie)).toBeLessThan(0.01);
    }
  });

  it('reports every possible trunk outcome with its reason', () => {
    const outcomes = new Set(
      throwAt(withTrees(wall), pro, standard([30, 60])).flatMap(({ events }) =>
        checksOf(events, 'Trunk').map((check) => (check.type === 'check' ? check.outcome : '')),
      ),
    );
    expect([...outcomes].sort()).toEqual(['Bad kick', 'Dead stop', 'Good kick']);
  });

  it('lets sparse leaves through and stops dense ones', () => {
    const crown = (density: number) =>
      tree(
        'crown',
        [30, 110],
        { radius: 0.05, height: 0.2 },
        { shape: 'round', radius: 15, base: 0.5, top: 60, density },
      );
    const passRate = (density: number) => {
      const checks = throwAt(withTrees(crown(density)), pro, standard([30, 60])).flatMap(({ events }) =>
        checksOf(events, 'Canopy'),
      );
      expect(checks.length).toBeGreaterThan(0);
      return checks.filter((check) => check.type === 'check' && check.success).length / checks.length;
    };
    expect(passRate(0)).toBeGreaterThan(0.8);
    expect(passRate(1)).toBeLessThan(0.2);
  });

  it('drops a swallowed disc under the tree', () => {
    const dense = tree(
      'dense',
      [30, 110],
      { radius: 0.05, height: 0.2 },
      { radius: 12, base: 0.5, top: 50, density: 1 },
    );
    const swallowed = throwAt(withTrees(dense), pro, standard([30, 60])).filter(({ events }) =>
      checksOf(events, 'Canopy').some((check) => check.type === 'check' && check.outcome === 'Swallowed'),
    );
    expect(swallowed.length).toBeGreaterThan(0);
    for (const { state } of swallowed) expect(distance2(state.lie, dense.position)).toBeLessThan(14);
  });

  it("doesn't hit the tree you are standing under", () => {
    const shade = tree(
      'shade',
      [30, 152],
      { radius: 0.3, height: 3 },
      { shape: 'round', radius: 6, base: 0.5, top: 9, density: 1 },
    );
    for (const { events } of throwAt(withTrees(shade), pro, standard([30, 60]))) {
      expect(checksOf(events, 'Canopy')).toEqual([]);
      expect(checksOf(events, 'Trunk')).toEqual([]);
    }
  });

  it('stops a rolling disc against a trunk', () => {
    // A stump just past the target: too short for the flight, right in the roll's path.
    const stump = tree('stump', [30, 57], { radius: 1, height: 0.3 }, noCanopy);
    const stopped = throwAt(withTrees(stump), pro, standard([30, 60])).filter(({ events }) =>
      messagesOf(events).includes('Rolled up against a trunk.'),
    );
    expect(stopped.length).toBeGreaterThan(0);
    for (const { state } of stopped) {
      expect(distance2(state.lie, stump.position)).toBeGreaterThanOrEqual(
        stump.trunk.radius + DISC_RADIUS - 1e-9,
      );
    }
  });

  it('is deterministic with trees', () => {
    const round = createRound(withTrees(wall), pro, 77);
    expect(apply(round, standard([30, 60]))).toEqual(apply(round, standard([30, 60])));
  });
});

describe('putts and trees', () => {
  const lie: Vec2 = [30, 26]; // 6 m short of the basket at [30, 20].
  const at = (hole: Hole, seed: number) => ({ ...createRound(hole, pro, seed), lie });
  const putts = (hole: Hole, action: Action) => seeds.map((seed) => apply(at(hole, seed), action));
  const centre: Action = { type: 'planned-putt', zone: 'centre-chains' };
  const standardPutt: Action = { type: 'standard-shot', target: [30, 20] };

  it('never holes through a trunk in the way', () => {
    const post = tree('post', [30, 23], { radius: 0.5, height: 5 }, noCanopy);
    for (const action of [standardPutt, centre]) {
      for (const { state, events } of putts(withTrees(post), action)) {
        expect(state.status).toBe('playing');
        expect(checksOf(events, 'Trunk')).toHaveLength(1);
        expect(distance2(state.lie, post.position)).toBeGreaterThanOrEqual(
          post.trunk.radius + DISC_RADIUS - 1e-9,
        );
      }
    }
  });

  it('can still hole through sparse leaves, and reports them', () => {
    const bush = tree(
      'bush',
      [30, 23],
      { radius: 0.01, height: 0.05 },
      { shape: 'round', radius: 2, base: 0.3, top: 4, density: 0 },
    );
    const results = putts(withTrees(bush), centre);
    expect(results.every(({ events }) => checksOf(events, 'Canopy').length === 1)).toBe(true);
    expect(results.some(({ state }) => state.status === 'holed')).toBe(true);
  });

  it("doesn't change putts when no tree is near the line", () => {
    const far = tree('far', [55, 140], { radius: 0.5, height: 5 }, noCanopy);
    const round = at(flatHole(), 9);
    expect(apply({ ...round, hole: withTrees(far) }, centre).events).toEqual(apply(round, centre).events);
  });
});

describe('luck and contact effects', () => {
  it('lets luck sway the bark: bad luck is listed and lowers the kick chance', () => {
    const unlucky = trunkReasons({ ...tester, luck: 2 });
    const lucky = trunkReasons({ ...tester, luck: -2 });
    expect(unlucky.map((reason) => reason.source)).toContain('Luck (Double bogey)');
    const total = (reasons: readonly { readonly value: number }[]) =>
      reasons.reduce((sum, r) => sum + r.value, 0);
    expect(total(lucky)).toBeGreaterThan(total(unlucky));
    expect(trunkReasons({ ...tester, luck: 0 }).map((reason) => reason.source)).not.toContain('Luck (Par)');
  });

  it('marks every tree contact for the renderer, at the contact point', () => {
    const wall = tree('wall', [30, 110], { radius: 8, height: 40 }, noCanopy);
    const hits = throwAt(withTrees(wall), pro, standard([30, 60])).filter(
      ({ events }) => checksOf(events, 'Trunk').length > 0,
    );
    expect(hits.length).toBeGreaterThan(0);
    for (const { events } of hits) {
      const contact = events.find((event) => event.type === 'contact');
      const interrupted = movesOf(events).find((leg) => leg.end !== undefined);
      expect(contact?.type === 'contact' && contact.part).toBe('trunk');
      expect(contact?.type === 'contact' && contact.point).toEqual(interrupted?.end);
    }
  });
});

describe('low-ceiling shots', () => {
  // A broad crown 6 m right of the line, branches from 3 m up. The trunk is clear of the line.
  const oak = tree(
    'oak',
    [36, 120],
    { radius: 0.4, height: 4 },
    { shape: 'round', radius: 8, base: 3, top: 12, density: 1 },
  );
  const target: Vec2 = [30, 95];

  it('stays under branches that a normal shot flies into', () => {
    const canopyHits = (height: 'normal' | 'low') =>
      throwAt(withTrees(oak), tester, planned(target, height)).filter(
        ({ events }) => checksOf(events, 'Canopy').length > 0,
      ).length;
    expect(canopyHits('normal')).toBeGreaterThan(seeds.length / 2);
    expect(canopyHits('low')).toBe(0);
  });

  it('flies low the whole way', () => {
    const round = createRound(withTrees(), tester, 5);
    const flight = movesOf(apply(round, planned(target, 'low')).events)[0] as FlightLeg;
    const peak = Math.max(...Array.from({ length: 21 }, (_, index) => flightPoint(flight, index / 20)[1]));
    expect(peak).toBeLessThan(2.5);
  });

  it('costs range and a little chance, and says so', () => {
    const round = createRound(withTrees(), tester, 1);
    const reasons = previewReasons(round, planned(target, 'low'));
    expect(reasons.map((reason) => reason.source)).toContain('Low ceiling (hard to keep down)');
    expect(
      rangeFor(tester, {
        kind: 'planned',
        region: round.hole.regions[0] as never,
        line: 'straight',
        throwType: 'backhand',
        height: 'low',
      }),
    ).toBe(Math.round(tester.maxRange * 0.75));
  });

  it('is locked until the player can throw it', () => {
    const round = createRound(withTrees(), { ...tester, shotHeights: ['normal'] }, 1);
    expect(apply(round, planned(target, 'low')).events).toEqual([]);
  });
});
