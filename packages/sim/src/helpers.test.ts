import { describe, expect, it } from 'vitest';
import { chanceFrom } from './events.ts';
import { type FlightLeg, flightPoint, legEnd } from './flight.ts';
import { createRng, nextGaussian, nextRange, pickByRoll } from './rng.ts';
import { formatScore, golfScoreLabel, holeResultLabel } from './scoring.ts';

describe('rng helpers', () => {
  it('keeps ranges in bounds', () => {
    const values = Array.from({ length: 500 }).reduce<{
      rng: ReturnType<typeof createRng>;
      values: number[];
    }>(
      ({ rng, values }) => {
        const [value, next] = nextRange(rng, 2, 5);
        return { rng: next, values: [...values, value] };
      },
      { rng: createRng(9), values: [] },
    ).values;
    expect(Math.min(...values)).toBeGreaterThanOrEqual(2);
    expect(Math.max(...values)).toBeLessThan(5);
  });

  it('produces finite gaussian samples', () => {
    const [value] = nextGaussian(createRng(1));
    expect(Number.isFinite(value)).toBe(true);
  });

  it('picks from a weighted table by roll', () => {
    const table = [
      [50, 'a'],
      [30, 'b'],
      [20, 'c'],
    ] as const;
    expect(pickByRoll(1, table)).toBe('a');
    expect(pickByRoll(50, table)).toBe('a');
    expect(pickByRoll(51, table)).toBe('b');
    expect(pickByRoll(81, table)).toBe('c');
    expect(pickByRoll(100, table)).toBe('c');
  });
});

describe('scoring', () => {
  it('labels golf scores', () => {
    expect(golfScoreLabel(2)).toBe('Double bogey');
    expect(golfScoreLabel(-1)).toBe('Birdie');
    expect(formatScore(0)).toBe('E');
    expect(formatScore(2)).toBe('+2');
  });

  it('labels hole results', () => {
    expect(holeResultLabel(1, 3)).toBe('Ace');
    expect(holeResultLabel(3, 3)).toBe('Par');
    expect(holeResultLabel(4, 3)).toBe('Bogey');
    expect(holeResultLabel(8, 3)).toBe('+5');
  });
});

describe('flight', () => {
  const leg: FlightLeg = { from: [0, 1, 0], to: [0, 0, -10], apex: 3, fade: 2, until: 1, pace: 'throw' };

  it('starts and ends at the leg endpoints', () => {
    expect(flightPoint(leg, 0)).toEqual([0, 1, 0]);
    const [x, y, z] = legEnd(leg);
    expect([x, y, z].map((value) => Math.round(value * 1000) / 1000)).toEqual([0, 0, -10]);
  });

  it('bends exactly to an interrupted end point', () => {
    const end = [0.5, 2, -5] as const;
    const [x, y, z] = flightPoint({ ...leg, until: 0.5, end }, 1);
    expect([x, y, z].map((value) => Math.round(value * 1000) / 1000)).toEqual([0.5, 2, -5]);
  });

  it('arcs above the straight line', () => {
    expect(flightPoint(leg, 0.5)[1]).toBeGreaterThan(0.5 + 2.9);
  });
});

describe('chanceFrom', () => {
  it('sums and clamps', () => {
    expect(
      chanceFrom(
        [
          { source: 'a', value: 70 },
          { source: 'b', value: 40 },
        ],
        5,
        95,
      ),
    ).toBe(95);
    expect(
      chanceFrom(
        [
          { source: 'a', value: 10 },
          { source: 'b', value: -40 },
        ],
        5,
        95,
      ),
    ).toBe(5);
  });
});
