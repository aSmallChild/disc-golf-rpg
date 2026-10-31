import { describe, expect, it } from 'vitest';
import type { ThrowEvent } from './events.ts';
import { legEnd } from './flight.ts';
import { distance2 } from './geometry.ts';
import { beginner, type Player } from './player.ts';
import { apply, createRound, previewChance, type RoundState, shotKind } from './round.ts';
import { flatHole } from './test-hole.ts';
import { releaseFor, throwReasons } from './throw.ts';

const pro: Player = {
  name: 'Pro',
  skills: { driving: -3, putting: -3 },
  maxRange: 150,
  plannedShots: ['putt', 'upshot', 'drive'],
  lines: ['straight', 'hyzer', 'anhyzer'],
};

const checkOf = (events: readonly ThrowEvent[]) => events.find((event) => event.type === 'check');

const seeds = Array.from({ length: 200 }, (_, index) => index + 1);

describe('round', () => {
  it('is deterministic for the same seed and action', () => {
    const round = createRound(flatHole(), beginner, 42);
    const action = { type: 'standard-shot', target: [30, 60] } as const;
    expect(apply(round, action)).toEqual(apply(round, action));
  });

  it('does not mutate the input state', () => {
    const round = createRound(flatHole(), beginner, 7);
    const copy = JSON.parse(JSON.stringify(round));
    apply(round, { type: 'standard-shot', target: [30, 60] });
    expect(round).toEqual(copy);
  });

  it('adds one stroke per in-bounds throw and moves the lie', () => {
    const round = createRound(flatHole(), pro, 3);
    const { state, events } = apply(round, { type: 'standard-shot', target: [30, 60] });
    expect(events.some((event) => event.type === 'out-of-bounds')).toBe(false);
    expect(state.strokes).toBe(1);
    expect(state.lie).not.toEqual(round.lie);
  });

  it('lands a clean release near the target', () => {
    const results = seeds
      .map((seed) => apply(createRound(flatHole(), pro, seed), { type: 'standard-shot', target: [30, 60] }))
      .filter(({ events }) => checkOf(events)?.success);
    expect(results.length).toBeGreaterThan(50);
    for (const { state } of results) {
      // 90 m throw: scatter plus the roll-out stays well within 25 m.
      expect(distance2(state.lie, [30, 60])).toBeLessThan(25);
    }
  });

  it('ends the disc where the last move ends', () => {
    const { state, events } = apply(createRound(flatHole(), beginner, 11), {
      type: 'standard-shot',
      target: [30, 60],
    });
    const moves = events.flatMap((event) => (event.type === 'move' ? [event.leg] : []));
    const last = moves[moves.length - 1];
    expect(last).toBeDefined();
    if (!last) return;
    const [x, , z] = legEnd(last);
    expect(distance2([x, z], state.lie)).toBeLessThan(0.01);
  });

  it('gives a penalty stroke and replays from the last lie when out of bounds', () => {
    // Aim off the side of the map; some throws must go out of bounds.
    const outs = seeds
      .map((seed) => {
        const round = createRound(flatHole(), beginner, seed);
        return { round, ...apply(round, { type: 'standard-shot', target: [-40, 150] }) };
      })
      .filter(({ events }) => events.some((event) => event.type === 'out-of-bounds'));
    expect(outs.length).toBeGreaterThan(0);
    for (const { round, state } of outs) {
      expect(state.strokes).toBe(2);
      expect(state.lie).toEqual(round.lie);
    }
  });

  it('putts inside circle 1, and a tap-in is almost certain', () => {
    const near: RoundState = { ...createRound(flatHole(), beginner, 5), lie: [30, 21] };
    expect(shotKind(near)).toBe('putt');
    expect(previewChance(near, { type: 'standard-shot', target: near.hole.basket })).toBe(99);
    const holed = seeds.filter(
      (seed) =>
        apply({ ...near, rng: { seed, state: seed } }, { type: 'standard-shot', target: [0, 0] }).state
          .status === 'holed',
    );
    expect(holed.length).toBeGreaterThan(190);
  });

  it('finishes the hole and ignores actions afterwards', () => {
    const near: RoundState = { ...createRound(flatHole(), beginner, 5), lie: [30, 20.5] };
    const holed = seeds
      .map((seed) =>
        apply({ ...near, rng: { seed, state: seed } }, { type: 'standard-shot', target: [0, 0] }),
      )
      .find(({ state }) => state.status === 'holed');
    expect(holed).toBeDefined();
    if (!holed) return;
    expect(holed.events.some((event) => event.type === 'holed')).toBe(true);
    const after = apply(holed.state, { type: 'standard-shot', target: [30, 60] });
    expect(after.state).toBe(holed.state);
    expect(after.events).toEqual([]);
  });

  it('reports reasons that explain the chance', () => {
    const reasons = throwReasons(beginner, [30, 150], [30, 60]);
    expect(reasons.map((reason) => reason.source)).toEqual([
      'Standard Shot',
      'Driving skill (Double bogey)',
      'Distance 90 m of 110 m range',
    ]);
    const round = createRound(flatHole(), beginner, 1);
    const check = checkOf(apply(round, { type: 'standard-shot', target: [30, 60] }).events);
    expect(check?.type === 'check' && check.chance).toBe(
      previewChance(round, { type: 'standard-shot', target: [30, 60] }),
    );
  });

  it('classifies releases by roll', () => {
    expect(releaseFor(40, 50)).toBe('clean');
    expect(releaseFor(70, 50)).toBe('wobbly');
    expect(releaseFor(90, 50)).toBe('shank');
  });
});
