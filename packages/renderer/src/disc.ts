import {
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshLambertMaterial,
  type PerspectiveCamera,
  type Vector3,
} from 'three';
import { palette } from './palette.ts';

const DISC_RADIUS = 0.105;
const DISC_THICKNESS = 0.024;
const TRAIL_POINTS = 48;

/**
 * Real discs are 21 cm wide, invisible from across a hole. The disc is
 * drawn at least this many radians wide on screen so it stays readable.
 */
const MIN_ANGULAR_SIZE = 0.012;

export const createDiscMesh = (): Mesh => {
  const disc = new Mesh(
    new CylinderGeometry(DISC_RADIUS, DISC_RADIUS * 0.92, DISC_THICKNESS, 20),
    new MeshLambertMaterial({ color: palette.disc, flatShading: true }),
  );
  disc.castShadow = true;
  disc.name = 'disc';
  return disc;
};

/** Grows the disc with camera distance so it never shrinks below a readable size. */
export const keepDiscReadable = (disc: Mesh, camera: PerspectiveCamera): void => {
  const distance = camera.position.distanceTo(disc.position);
  const scale = Math.max(1, (distance * MIN_ANGULAR_SIZE) / (DISC_RADIUS * 2));
  disc.scale.setScalar(scale);
};

export type Trail = {
  readonly line: Line;
  readonly reset: (at: Vector3) => void;
  readonly push: (at: Vector3) => void;
};

/** A fixed-length line of recent disc positions. Mutable by nature, kept local. */
export const createTrail = (): Trail => {
  const positions = new Float32Array(TRAIL_POINTS * 3);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  const line = new Line(
    geometry,
    new LineBasicMaterial({ color: palette.discTrail, transparent: true, opacity: 0.55 }),
  );
  line.frustumCulled = false;
  line.name = 'disc-trail';

  const markDirty = () => {
    geometry.getAttribute('position').needsUpdate = true;
  };

  return {
    line,
    reset: (at) => {
      Array.from({ length: TRAIL_POINTS }, (_, index) => at.toArray(positions, index * 3));
      markDirty();
    },
    push: (at) => {
      positions.copyWithin(0, 3);
      at.toArray(positions, (TRAIL_POINTS - 1) * 3);
      markDirty();
    },
  };
};
