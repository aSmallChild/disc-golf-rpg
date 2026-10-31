import { elevationAt, type Hole, holeSize, type Vec2 } from '@dgrpg/course-format';

export type CameraViewName = 'overview' | 'tee' | 'basket' | 'lie';

export type CameraView = {
  readonly position: readonly [x: number, y: number, z: number];
  readonly target: readonly [x: number, y: number, z: number];
};

/** Camera tilt from vertical for the overview, in radians (0 = straight top-down). */
export const CAMERA_TILT = (35 * Math.PI) / 180;

/** Unit vector on the ground plane from `from` toward `to`. */
const direction = ([fx, fz]: Vec2, [tx, tz]: Vec2): Vec2 => {
  const length = Math.hypot(tx - fx, tz - fz) || 1;
  return [(tx - fx) / length, (tz - fz) / length];
};

/** Behind `from`, looking toward `toward`. Higher and further back for longer shots. */
const behind = (hole: Hole, from: Vec2, toward: Vec2): CameraView => {
  const [dx, dz] = direction(from, toward);
  const [fx, fz] = from;
  const y = elevationAt(hole, from);
  const distance = Math.hypot(toward[0] - fx, toward[1] - fz);
  const back = Math.min(4 + distance * 0.06, 12);
  const up = Math.min(2.5 + distance * 0.03, 6);
  const ahead = Math.min(Math.max(distance * 0.6, 4), 40);
  return {
    position: [fx - dx * back, y + up, fz - dz * back],
    target: [fx + dx * ahead, y, fz + dz * ahead],
  };
};

/** Pure: computes where the camera sits and looks for each named view. */
export const cameraView = (hole: Hole, name: CameraViewName, lie: Vec2 = hole.tee): CameraView => {
  const [width, depth] = holeSize(hole);
  switch (name) {
    case 'overview': {
      const distance = Math.max(width, depth) * 1.1;
      return {
        position: [width / 2, Math.cos(CAMERA_TILT) * distance, depth / 2 + Math.sin(CAMERA_TILT) * distance],
        target: [width / 2, 0, depth / 2],
      };
    }
    case 'tee':
      return behind(hole, hole.tee, hole.basket);
    case 'lie':
      return behind(hole, lie, hole.basket);
    case 'basket': {
      // Close up, from the tee side, at roughly eye height.
      const [dx, dz] = direction(hole.tee, hole.basket);
      const [bx, bz] = hole.basket;
      const y = elevationAt(hole, hole.basket);
      return {
        position: [bx - dx * 3.2, y + 1.9, bz - dz * 3.2],
        target: [bx, y + 0.9, bz],
      };
    }
  }
};
