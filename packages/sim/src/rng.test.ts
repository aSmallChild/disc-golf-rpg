import { describe, expect, it } from 'vitest';
import { createRng, nextFloat, rollD100 } from './rng.ts';

const take = (count: number, seed: number): number[] =>
  Array.from({ length: count }).reduce<{ rng: ReturnType<typeof createRng>; values: number[] }>(
    ({ rng, values }) => {
      const [value, next] = rollD100(rng);
      return { rng: next, values: [...values, value] };
    },
    { rng: createRng(seed), values: [] },
  ).values;

describe('rng', () => {
  it('is deterministic for the same seed', () => {
    expect(take(20, 42)).toEqual(take(20, 42));
  });

  it('differs between seeds', () => {
    expect(take(20, 1)).not.toEqual(take(20, 2));
  });

  it('does not mutate the input state', () => {
    const rng = createRng(7);
    nextFloat(rng);
    expect(rng).toEqual(createRng(7));
  });

  it('keeps d100 rolls within 1–100', () => {
    const values = take(1000, 123);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...values)).toBeLessThanOrEqual(100);
  });
});
