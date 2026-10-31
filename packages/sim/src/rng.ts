/**
 * Seeded, serialisable, pure RNG (mulberry32).
 * Every function returns the value plus the next RNG state; nothing is mutated.
 */

export type Rng = {
  readonly seed: number;
  readonly state: number;
};

export type Rolled<T> = readonly [value: T, rng: Rng];

export const createRng = (seed: number): Rng => ({ seed: seed >>> 0, state: seed >>> 0 });

/** Float in [0, 1). */
export const nextFloat = (rng: Rng): Rolled<number> => {
  const state = (rng.state + 0x6d2b79f5) >>> 0;
  const a = Math.imul(state ^ (state >>> 15), state | 1);
  const b = a ^ (a + Math.imul(a ^ (a >>> 7), a | 61));
  const value = ((b ^ (b >>> 14)) >>> 0) / 4294967296;
  return [value, { ...rng, state }];
};

/** Integer in [min, max], inclusive. */
export const nextInt = (rng: Rng, min: number, max: number): Rolled<number> => {
  const [value, next] = nextFloat(rng);
  return [min + Math.floor(value * (max - min + 1)), next];
};

/** Percentile roll, 1–100. */
export const rollD100 = (rng: Rng): Rolled<number> => nextInt(rng, 1, 100);
