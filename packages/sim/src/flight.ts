import type { Vec2, Vec3 } from '@dgrpg/course-format';
import { lerp3, normalize2, rightOf, sub2, toVec2 } from './geometry.ts';

/**
 * One visible movement of the disc. The simulation uses the same curve to
 * find tree encounters, and the renderer replays it exactly, so a trunk hit
 * on screen is where the simulation says it was.
 */
export type FlightLeg = {
  readonly from: Vec3;
  /** Where the leg would land if nothing got in the way. */
  readonly to: Vec3;
  /** Height of the arc above the straight line, in metres. */
  readonly apex: number;
  /** Sideways bulge in metres (+ = thrower's right). Cosmetic curve, also used for encounters. */
  readonly fade: number;
  /** Fraction of the curve actually flown (1 unless something interrupted it). */
  readonly until: number;
  /**
   * Exact end point when interrupted (e.g. the trunk surface). The curve is
   * bent smoothly toward it so the disc visibly touches the contact point.
   */
  readonly end?: Vec3;
  readonly pace: 'throw' | 'putt' | 'glance' | 'bounce' | 'drop';
};

const basePoint = (leg: FlightLeg, u: number): Vec3 => {
  const [x, y, z] = lerp3(leg.from, leg.to, u);
  const bulge = 4 * u * (1 - u);
  const [rx, rz] = rightOf(normalize2(sub2(toVec2(leg.to), toVec2(leg.from))));
  return [x + rx * leg.fade * bulge, y + leg.apex * bulge, z + rz * leg.fade * bulge];
};

/** Position along the leg, t in [0, 1] of the flown part. */
export const flightPoint = (leg: FlightLeg, t: number): Vec3 => {
  const u = t * leg.until;
  const point = basePoint(leg, u);
  if (!leg.end) return point;
  const [ex, ey, ez] = basePoint(leg, leg.until);
  const k = t * t;
  return [
    point[0] + (leg.end[0] - ex) * k,
    point[1] + (leg.end[1] - ey) * k,
    point[2] + (leg.end[2] - ez) * k,
  ];
};

export const legEnd = (leg: FlightLeg): Vec3 => flightPoint(leg, 1);

/** Ground-plane length of the flown part, for pacing the animation. */
export const legLength = (leg: FlightLeg): number => {
  const steps = 12;
  return Array.from({ length: steps }, (_, index) => {
    const a = flightPoint(leg, index / steps);
    const b = flightPoint(leg, (index + 1) / steps);
    return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  }).reduce((sum, value) => sum + value, 0);
};

export const groundDirection = (from: Vec2, to: Vec2): Vec2 => normalize2(sub2(to, from));
