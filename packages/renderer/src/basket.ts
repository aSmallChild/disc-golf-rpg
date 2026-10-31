import { basketDimensions as d } from '@dgrpg/course-format';
import {
  type BufferGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshLambertMaterial,
  Quaternion,
  TorusGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { palette } from './palette.ts';

const WIRE_RADIUS = 0.005;
const CHAIN_RADIUS = 0.004;
const CHAIN_SEGMENTS = 14;

type Point = readonly [x: number, y: number, z: number];

const up = new Vector3(0, 1, 0);

/** A thin cylinder from `a` to `b`. */
const rod = (a: Point, b: Point, radius: number): BufferGeometry => {
  const start = new Vector3(...a);
  const end = new Vector3(...b);
  const span = end.clone().sub(start);
  const geometry = new CylinderGeometry(radius, radius, span.length(), 4, 1, true);
  geometry.applyQuaternion(new Quaternion().setFromUnitVectors(up, span.clone().normalize()));
  geometry.translate(...start.add(end).multiplyScalar(0.5).toArray());
  return geometry;
};

/** Consecutive points become rods: a–b, b–c, ... */
const polyline = (points: readonly Point[], radius: number): readonly BufferGeometry[] =>
  points.slice(1).map((point, index) => rod(points[index] as Point, point, radius));

const atAngle = (angle: number, radius: number, y: number): Point => [
  Math.cos(angle) * radius,
  y,
  Math.sin(angle) * radius,
];

/**
 * A chain hangs from a ring and attaches to the pole near the bottom.
 * Its profile is a parabola with the trough just outside the attachment
 * point, so the chain bows outward and is lowest close to the pole.
 */
const chainPoints = (angle: number, topRadius: number, topHeight: number): readonly Point[] => {
  const troughRadius = d.chainAttachRadius + 0.03;
  const troughHeight = d.chainAttachHeight - 0.02;
  const curvature = (topHeight - troughHeight) / (topRadius - troughRadius) ** 2;
  const heightAt = (radius: number) => troughHeight + curvature * (radius - troughRadius) ** 2;

  // Sample more densely near the top, where the parabola is steep.
  const toTrough = Array.from({ length: CHAIN_SEGMENTS + 1 }, (_, index) => {
    const t = index / CHAIN_SEGMENTS;
    const radius = topRadius - (topRadius - troughRadius) * Math.sqrt(t);
    return atAngle(angle, radius, heightAt(radius));
  });
  return [...toTrough, atAngle(angle, d.chainAttachRadius, d.chainAttachHeight)];
};

const ring = (radius: number, y: number, tube: number): BufferGeometry => {
  const geometry = new TorusGeometry(radius, tube, 4, 32);
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, y, 0);
  return geometry;
};

/** The tray as a wire cage: rings, slanted bars, and a spoked floor. */
const trayGeometry = (): BufferGeometry => {
  const trayMiddle = (d.trayBottom + d.trayTop) / 2;
  const radiusAt = (y: number) =>
    d.trayRadiusBottom +
    ((y - d.trayBottom) / (d.trayTop - d.trayBottom)) * (d.trayRadiusTop - d.trayRadiusBottom);

  const bars = Array.from({ length: d.trayBarCount }, (_, index) => {
    const angle = (index / d.trayBarCount) * Math.PI * 2;
    return rod(
      atAngle(angle, d.trayRadiusBottom, d.trayBottom),
      atAngle(angle, d.trayRadiusTop, d.trayTop),
      WIRE_RADIUS,
    );
  });

  const spokes = Array.from({ length: d.trayBarCount / 2 }, (_, index) => {
    const angle = (index / (d.trayBarCount / 2)) * Math.PI * 2;
    return rod(
      atAngle(angle, d.poleRadius, d.trayBottom),
      atAngle(angle, d.trayRadiusBottom, d.trayBottom),
      WIRE_RADIUS,
    );
  });

  return mergeGeometries([
    ...bars,
    ...spokes,
    ring(d.trayRadiusBottom, d.trayBottom, WIRE_RADIUS * 1.5),
    ring(d.trayRadiusBottom * 0.55, d.trayBottom, WIRE_RADIUS),
    ring(radiusAt(trayMiddle), trayMiddle, WIRE_RADIUS),
  ]);
};

const chainsGeometry = (): BufferGeometry => {
  const hang = (count: number, radius: number, height: number, offset: number) =>
    Array.from({ length: count }, (_, index) =>
      polyline(chainPoints(offset + (index / count) * Math.PI * 2, radius, height), CHAIN_RADIUS),
    ).flat();

  return mergeGeometries([
    ...hang(d.outerChainCount, d.bandRadius, d.bandHeight, 0),
    ...hang(d.innerChainCount, d.innerRingRadius, d.innerRingHeight, Math.PI / d.innerChainCount),
    ring(d.innerRingRadius, d.innerRingHeight, WIRE_RADIUS),
    ring(d.chainAttachRadius, d.chainAttachHeight, WIRE_RADIUS * 2),
  ]);
};

const metal = () => new MeshLambertMaterial({ color: palette.basket, flatShading: true });

/**
 * Low-poly basket built from named parts (pole, tray, rim, band, chains), so
 * basket-zone hits can be choreographed against the right part later.
 */
export const createBasketGroup = (): Group => {
  const pole = new Mesh(new CylinderGeometry(d.poleRadius, d.poleRadius, d.poleHeight, 8), metal());
  pole.position.y = d.poleHeight / 2;
  pole.name = 'pole';

  const tray = new Mesh(trayGeometry(), metal());
  tray.name = 'tray';

  const trayRim = new Mesh(new TorusGeometry(d.trayRadiusTop, 0.012, 6, 24), metal());
  trayRim.rotation.x = Math.PI / 2;
  trayRim.position.y = d.trayTop;
  trayRim.name = 'tray-rim';

  const band = new Mesh(
    new TorusGeometry(d.bandRadius, 0.025, 6, 24),
    new MeshLambertMaterial({ color: palette.basketBand, flatShading: true }),
  );
  band.rotation.x = Math.PI / 2;
  band.position.y = d.bandHeight;
  band.name = 'band';

  const chains = new Mesh(chainsGeometry(), new MeshLambertMaterial({ color: palette.chain }));
  chains.name = 'chains';

  const group = new Group();
  group.add(pole, tray, trayRim, band, chains);
  group.traverse((child) => {
    child.castShadow = child instanceof Mesh;
  });
  group.name = 'basket';
  return group;
};
