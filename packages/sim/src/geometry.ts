import type { Vec2, Vec3 } from '@dgrpg/course-format';

export const add2 = ([ax, az]: Vec2, [bx, bz]: Vec2): Vec2 => [ax + bx, az + bz];
export const sub2 = ([ax, az]: Vec2, [bx, bz]: Vec2): Vec2 => [ax - bx, az - bz];
export const scale2 = ([x, z]: Vec2, k: number): Vec2 => [x * k, z * k];
export const length2 = ([x, z]: Vec2): number => Math.hypot(x, z);
export const distance2 = (a: Vec2, b: Vec2): number => length2(sub2(a, b));
export const normalize2 = (v: Vec2): Vec2 => {
  const length = length2(v);
  return length === 0 ? [0, -1] : [v[0] / length, v[1] / length];
};
/** Rotates around the up axis. Positive angles turn toward the thrower's right. */
export const rotate2 = ([x, z]: Vec2, angle: number): Vec2 => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [x * cos - z * sin, x * sin + z * cos];
};
/** The thrower's right, when facing along `forward` (x/z ground plane, y up). */
export const rightOf = ([x, z]: Vec2): Vec2 => [-z, x];

export const toVec2 = ([x, , z]: Vec3): Vec2 => [x, z];
export const toVec3 = ([x, z]: Vec2, y: number): Vec3 => [x, y, z];
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const lerp3 = ([ax, ay, az]: Vec3, [bx, by, bz]: Vec3, t: number): Vec3 => [
  lerp(ax, bx, t),
  lerp(ay, by, t),
  lerp(az, bz, t),
];
export const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

/** Even-odd centroid approximation (vertex average) is enough for hand-drawn regions. */
export const centroid = (polygon: readonly Vec2[]): Vec2 =>
  scale2(
    polygon.reduce<Vec2>((sum, point) => add2(sum, point), [0, 0]),
    1 / Math.max(polygon.length, 1),
  );
