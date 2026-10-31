import { elevationAt, type Hole, type Vec2, type Vec3 } from '@dgrpg/course-format';
import { type FlightLeg, flightPoint } from '@dgrpg/sim';
import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Line,
  LineDashedMaterial,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  SphereGeometry,
} from 'three';
import { palette } from './palette.ts';

const LINE_SAMPLES = 40;
const LIFT = 0.25;

/**
 * Target marker plus a dashed line draped over the terrain from the lie.
 * `fade` bends the line sideways (metres, + = right) the same way the flight curve does.
 * Rebuilt whenever the target changes; it's cheap at this size.
 */
export const createAimGroup = (hole: Hole, lie: Vec2, target: Vec2, fade = 0): Group => {
  const [tx, tz] = target;
  const groundLeg: FlightLeg = {
    from: [lie[0], 0, lie[1]],
    to: [tx, 0, tz],
    apex: 0,
    fade,
    until: 1,
    pace: 'throw',
  };

  const points = Array.from({ length: LINE_SAMPLES + 1 }, (_, index) => {
    const [x, , z] = flightPoint(groundLeg, index / LINE_SAMPLES);
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

/**
 * A small dot on the exact point a Big Brained Putt is aimed at. Drawn on top
 * of everything so the chains don't hide it.
 */
export const createZoneMarker = (point: Vec3): Mesh => {
  const marker = new Mesh(
    new SphereGeometry(0.045, 12, 8),
    new MeshBasicMaterial({ color: palette.target, transparent: true, opacity: 0.9, depthTest: false }),
  );
  marker.position.set(...point);
  marker.renderOrder = 10;
  marker.name = 'zone-marker';
  return marker;
};
