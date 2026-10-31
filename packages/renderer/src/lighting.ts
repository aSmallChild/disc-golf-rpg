import { DirectionalLight, HemisphereLight, type Object3D } from 'three';
import { palette } from './palette.ts';

/**
 * Sun height above the horizon. A low sun rakes across the terrain so
 * flat-shaded slopes facing it brighten and slopes facing away darken.
 * Straight overhead lights every face nearly the same and hides the hills.
 */
const SUN_ELEVATION = (30 * Math.PI) / 180;
/**
 * Sun compass direction on the ground plane. Light from the upper left of the
 * overview screen (-x, -z) matches map hillshading, which people read as
 * "hills" rather than "dents".
 */
const SUN_AZIMUTH = (-135 * Math.PI) / 180;

/** Kept low so the sun's light/dark contrast between slopes survives. */
const FILL_INTENSITY = 1;
const SUN_INTENSITY = 2.6;

/** Builds the scene lights for a hole of the given size (metres). */
export const createLights = (width: number, depth: number): readonly Object3D[] => {
  const span = Math.max(width, depth);
  const centre = { x: width / 2, z: depth / 2 };
  const reach = span; // Far enough out that the whole hole sits inside the shadow box.

  const fill = new HemisphereLight(palette.ambientSky, palette.ambientGround, FILL_INTENSITY);

  const sun = new DirectionalLight(palette.sun, SUN_INTENSITY);
  const horizontal = Math.cos(SUN_ELEVATION) * reach;
  sun.position.set(
    centre.x + Math.cos(SUN_AZIMUTH) * horizontal,
    Math.sin(SUN_ELEVATION) * reach,
    centre.z + Math.sin(SUN_AZIMUTH) * horizontal,
  );
  sun.target.position.set(centre.x, 0, centre.z);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  // The shadow box is seen from the sun, so it must fit the hole's diagonal.
  const half = Math.hypot(width, depth) / 2 + 5;
  sun.shadow.camera.left = -half;
  sun.shadow.camera.right = half;
  sun.shadow.camera.top = half;
  sun.shadow.camera.bottom = -half;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = reach * 2 + half;
  // Low sun on flat-shaded faces causes shadow acne without a bias.
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.05;

  return [fill, sun, sun.target];
};
