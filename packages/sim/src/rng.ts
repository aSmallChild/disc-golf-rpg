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

/** Float in [min, max). */
export const nextRange = (rng: Rng, min: number, max: number): Rolled<number> => {
  const [value, next] = nextFloat(rng);
  return [min + value * (max - min), next];
};

/** Standard normal sample (Box–Muller). */
export const nextGaussian = (rng: Rng): Rolled<number> => {
  const [u1, r1] = nextFloat(rng);
  const [u2, r2] = nextFloat(r1);
  return [Math.sqrt(-2 * Math.log(1 - u1)) * Math.cos(2 * Math.PI * u2), r2];
};

/** -1 or 1. */
export const nextSign = (rng: Rng): Rolled<number> => {
  const [value, next] = nextFloat(rng);
  return [value < 0.5 ? -1 : 1, next];
};

/** Percentile roll, 1–100. */
export const rollD100 = (rng: Rng): Rolled<number> => nextInt(rng, 1, 100);

/**
 * Picks from a table of [weight, value] entries using a d100 roll that is
 * already made, so the roll can be reported in the feedback.
 * Weights are percentages and should sum to 100; the last entry absorbs any remainder.
 */
export const pickByRoll = <T>(roll: number, table: readonly (readonly [weight: number, value: T])[]): T => {
  const last = table[table.length - 1];
  if (!last) throw new Error('pickByRoll needs at least one entry');
  const thresholds = table.map((_, index) =>
    table.slice(0, index + 1).reduce((sum, [weight]) => sum + weight, 0),
  );
  const index = thresholds.findIndex((threshold) => roll <= threshold);
  return (table[index] ?? last)[1];
};
