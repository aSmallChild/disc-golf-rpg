import { type Hole, sampleGrid } from '@dgrpg/course-format';
import {
  AmbientLight,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Mesh,
  MeshLambertMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';
import { palette } from './palette.ts';
import { createTerrainMesh } from './terrain.ts';
import { createTreeGroup } from './trees.ts';

export { palette } from './palette.ts';

export type HoleView = {
  readonly dispose: () => void;
};

/** Camera tilt from vertical, in radians (0 = straight top-down). */
const CAMERA_TILT = (35 * Math.PI) / 180;

const createBasket = (hole: Hole): Mesh => {
  const pole = new Mesh(
    new CylinderGeometry(0.05, 0.05, 1.4, 6),
    new MeshLambertMaterial({ color: palette.basket }),
  );
  pole.position.set(hole.basket[0], sampleGrid(hole.elevation, hole.basket) + 0.7, hole.basket[1]);
  pole.castShadow = true;
  return pole;
};

/**
 * Mounts a Three.js view of a hole into the given canvas.
 * Three.js is object-oriented, so this module is the boundary: it hides
 * the mutable scene behind a function and returns a disposer.
 */
export const mountHoleView = (canvas: HTMLCanvasElement, hole: Hole): HoleView => {
  const renderer = new WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;

  const scene = new Scene();
  scene.background = new Color(palette.sky);

  const width = (hole.elevation.columns - 1) * hole.elevation.cellSize;
  const depth = (hole.elevation.rows - 1) * hole.elevation.cellSize;
  const span = Math.max(width, depth);
  scene.fog = new Fog(palette.fog, span * 1.2, span * 3);

  scene.add(new HemisphereLight(palette.ambientSky, palette.ambientGround, 1.4));
  scene.add(new AmbientLight(0xffffff, 0.2));
  const sun = new DirectionalLight(palette.sun, 2);
  sun.position.set(width * 0.3, span, depth * 0.2);
  sun.target.position.set(width / 2, 0, depth / 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -span;
  sun.shadow.camera.right = span;
  sun.shadow.camera.top = span;
  sun.shadow.camera.bottom = -span;
  scene.add(sun, sun.target);

  scene.add(createTerrainMesh(hole.elevation));
  scene.add(...hole.trees.map((tree) => createTreeGroup(tree, hole.elevation)));
  scene.add(createBasket(hole));

  // Tilted camera looking down the hole from behind the tee.
  const camera = new PerspectiveCamera(45, 1, 0.1, span * 4);
  const distance = span * 1.1;
  camera.position.set(
    width / 2,
    Math.cos(CAMERA_TILT) * distance,
    depth / 2 + Math.sin(CAMERA_TILT) * distance,
  );
  camera.lookAt(width / 2, 0, depth / 2);

  const resize = () => {
    const { clientWidth, clientHeight } = canvas;
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / Math.max(clientHeight, 1);
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  renderer.setAnimationLoop(() => renderer.render(scene, camera));

  return {
    dispose: () => {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      scene.traverse((object) => {
        if (object instanceof Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => {
            material.dispose();
          });
        }
      });
      renderer.dispose();
    },
  };
};
