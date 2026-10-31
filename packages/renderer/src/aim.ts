import { elevationAt, type Hole, type Vec2 } from '@dgrpg/course-format';
import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Line,
  LineDashedMaterial,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
} from 'three';
import { palette } from './palette.ts';

const LINE_SAMPLES = 40;
const LIFT = 0.25;

/**
 * Target marker plus a dashed line draped over the terrain from the lie.
 * Rebuilt whenever the target changes; it's cheap at this size.
 */
export const createAimGroup = (hole: Hole, lie: Vec2, target: Vec2): Group => {
  const [lx, lz] = lie;
  const [tx, tz] = target;

  const points = Array.from({ length: LINE_SAMPLES + 1 }, (_, index) => {
    const t = index / LINE_SAMPLES;
    const x = lx + (tx - lx) * t;
    const z = lz + (tz - lz) * t;
    return [x, elevationAt(hole, [x, z]) + LIFT, z];
  }).flat();
  const lineGeometry = new BufferGeometry();
  lineGeometry.setAttribute('position', new Float32BufferAttribute(points, 3));
  const line = new Line(
    lineGeometry,
    new LineDashedMaterial({
      color: palette.aimLine,
      dashSize: 1.5,
      gapSize: 1,
      transparent: true,
      opacity: 0.8,
    }),
  );
  line.computeLineDistances();

  const ring = new Mesh(
    new RingGeometry(1.2, 1.6, 32),
    new MeshBasicMaterial({ color: palette.target, transparent: true, opacity: 0.85, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(tx, elevationAt(hole, target) + 0.08, tz);

  const group = new Group();
  group.add(line, ring);
  group.name = 'aim';
  return group;
};
