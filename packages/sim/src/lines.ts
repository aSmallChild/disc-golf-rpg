import type { Reason } from './events.ts';
import type { ThrowLine } from './player.ts';

export const throwLines: readonly ThrowLine[] = ['hyzer', 'straight', 'anhyzer'];

export const lineLabels: Record<ThrowLine, string> = {
  straight: 'Straight',
  hyzer: 'Hyzer',
  anhyzer: 'Anhyzer',
};

/**
 * Typical sideways bulge as a fraction of the throw length (+ = thrower's right).
 * The throw varies it a little; the aim preview draws this value.
 */
export const lineFade: Record<ThrowLine, number> = {
  straight: 0,
  hyzer: -0.15,
  anhyzer: 0.15,
};

/** Hyzers are the forgiving shape, anhyzers have to be held. */
export const lineReasons: Record<ThrowLine, readonly Reason[]> = {
  straight: [],
  hyzer: [{ source: 'Hyzer line (forgiving)', value: 5 }],
  anhyzer: [{ source: 'Anhyzer line (hard to hold)', value: -5 }],
};

/** On a bad release a curved line over-curves: hyzers fade out, anhyzers turn over. */
export const BAD_RELEASE_CURVE = 0.06;
