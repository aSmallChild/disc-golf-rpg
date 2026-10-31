import type { Reason } from './events.ts';
import type { ShotHeight, ThrowLine, ThrowType } from './player.ts';

export const throwLines: readonly ThrowLine[] = ['hyzer', 'straight', 'anhyzer'];
export const throwTypes: readonly ThrowType[] = ['backhand', 'forehand'];
export const shotHeights: readonly ShotHeight[] = ['normal', 'low'];

export const lineLabels: Record<ThrowLine, string> = {
  straight: 'Straight',
  hyzer: 'Hyzer',
  anhyzer: 'Anhyzer',
};

export const throwTypeLabels: Record<ThrowType, string> = {
  backhand: 'Backhand',
  forehand: 'Forehand',
};

export const shotHeightLabels: Record<ShotHeight, string> = {
  normal: 'Normal height',
  low: 'Low ceiling',
};

/**
 * Which way the disc curves, from the thrower's view (-1 = left, +1 = right).
 * Players are right-handed for now. A right-hand backhand (RHBH) hyzer curves
 * left and an anhyzer right; a forehand mirrors both.
 */
export const curveDirection = (line: ThrowLine, throwType: ThrowType): -1 | 0 | 1 => {
  if (line === 'straight') return 0;
  const backhand = line === 'hyzer' ? -1 : 1;
  return throwType === 'backhand' ? backhand : backhand === -1 ? 1 : -1;
};

/** How far a curved line bows out, as a fraction of the throw length. */
const LINE_BULGE = 0.15;

/**
 * Typical sideways bulge of the flight path as a fraction of the throw length
 * (+ = thrower's right). The path bows out opposite the curve: a disc that
 * curves left to the target is released out to the right. The throw varies it
 * a little; the aim preview draws this value.
 */
export const lineBulge = (line: ThrowLine, throwType: ThrowType): number =>
  -curveDirection(line, throwType) * LINE_BULGE;

/** Hyzers are the forgiving shape, anhyzers have to be held. */
export const lineReasons: Record<ThrowLine, readonly Reason[]> = {
  straight: [],
  hyzer: [{ source: 'Hyzer line (forgiving)', value: 5 }],
  anhyzer: [{ source: 'Anhyzer line (hard to hold)', value: -5 }],
};

/**
 * On a bad release a curved line over-curves: hyzers fade out further, anhyzers
 * turn over. The landing shifts this fraction of the throw length in the curve's direction.
 */
export const BAD_RELEASE_CURVE = 0.06;
