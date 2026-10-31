import type { Hole, Vec2 } from '@dgrpg/course-format';
import { sampleGrid } from '@dgrpg/course-format';

export type CameraViewName = 'overview' | 'tee' | 'basket';

export type CameraView = {
  readonly position: readonly [x: number, y: number, z: number];
  readonly target: readonly [x: number, y: number, z: number];
};

/** Camera tilt from vertical for the overview, in radians (0 = straight top-down). */
export const CAMERA_TILT = (35 * Math.PI) / 180;

const ground = (hole: Hole, point: Vec2): number => sampleGrid(hole.elevation, point);

/** Unit vector on the ground plane from `from` toward `to`. */
const direction = ([fx, fz]: Vec2, [tx, tz]: Vec2): Vec2 => {
  const length = Math.hypot(tx - fx, tz - fz) || 1;
  return [(tx - fx) / length, (tz - fz) / length];
};

/** Pure: computes where the camera sits and looks for each named view. */
export const cameraView = (hole: Hole, name: CameraViewName): CameraView => {
  const width = (hole.elevation.columns - 1) * hole.elevation.cellSize;
  const depth = (hole.elevation.rows - 1) * hole.elevation.cellSize;
  const [dx, dz] = direction(hole.tee, hole.basket);

  switch (name) {
    case 'overview': {
      const distance = Math.max(width, depth) * 1.1;
      return {
        position: [width / 2, Math.cos(CAMERA_TILT) * distance, depth / 2 + Math.sin(CAMERA_TILT) * distance],
        target: [width / 2, 0, depth / 2],
      };
    }
    case 'tee': {
      // Behind and above the tee, looking down the fairway.
      const [tx, tz] = hole.tee;
      const y = ground(hole, hole.tee);
      return {
        position: [tx - dx * 7, y + 4, tz - dz * 7],
        target: [tx + dx * 30, y, tz + dz * 30],
      };
    }
    case 'basket': {
      // Close up, from the tee side, at roughly eye height.
      const [bx, bz] = hole.basket;
      const y = ground(hole, hole.basket);
      return {
        position: [bx - dx * 3.2, y + 1.9, bz - dz * 3.2],
        target: [bx, y + 0.9, bz],
      };
    }
  }
};
