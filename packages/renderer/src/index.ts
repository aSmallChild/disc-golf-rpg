import { type Hole, sampleGrid } from '@dgrpg/course-format';
import {
  AmbientLight,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  LineSegments,
  Mesh,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createBasketGroup } from './basket.ts';
import { type CameraView, type CameraViewName, cameraView } from './camera-views.ts';
import { palette } from './palette.ts';
import { createTeePad } from './tee.ts';
import { createTerrainMesh } from './terrain.ts';
import { createTreeGroup } from './trees.ts';

export { CAMERA_TILT, type CameraViewName } from './camera-views.ts';
export { palette } from './palette.ts';

export type HoleView = {
  /** Smoothly moves the camera to a named view. */
  readonly showView: (name: CameraViewName) => void;
  readonly dispose: () => void;
};

const TRANSITION_SECONDS = 0.9;

const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

const toVector = ([x, y, z]: readonly [number, number, number]): Vector3 => new Vector3(x, y, z);

/**
 * Mounts a Three.js view of a hole into the given canvas.
 * Three.js is object-oriented, so this module is the boundary: it hides
 * the mutable scene behind functions and returns a disposer.
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

  const basket = createBasketGroup();
  basket.position.set(hole.basket[0], sampleGrid(hole.elevation, hole.basket), hole.basket[1]);
  scene.add(basket);
  scene.add(createTeePad(hole));

  const camera = new PerspectiveCamera(45, 1, 0.05, span * 4);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2 - 0.05; // Never go below the ground.
  controls.minDistance = 1.5;
  controls.maxDistance = span * 2;

  const applyView = (view: CameraView) => {
    camera.position.copy(toVector(view.position));
    controls.target.copy(toVector(view.target));
    controls.update();
  };
  applyView(cameraView(hole, 'overview'));

  // The only mutable state: an in-progress camera transition, if any.
  let transition: { from: CameraView; to: CameraView; startedAt: number } | undefined;
  // Dragging the camera cancels any transition so the user stays in control.
  controls.addEventListener('start', () => {
    transition = undefined;
  });

  const currentView = (): CameraView => ({
    position: camera.position.toArray(),
    target: controls.target.toArray(),
  });

  const stepTransition = (now: number) => {
    if (!transition) return;
    const t = Math.min((now - transition.startedAt) / 1000 / TRANSITION_SECONDS, 1);
    const k = easeInOut(t);
    camera.position.lerpVectors(toVector(transition.from.position), toVector(transition.to.position), k);
    controls.target.lerpVectors(toVector(transition.from.target), toVector(transition.to.target), k);
    if (t >= 1) transition = undefined;
  };

  const resize = () => {
    const { clientWidth, clientHeight } = canvas;
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / Math.max(clientHeight, 1);
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  renderer.setAnimationLoop((now) => {
    stepTransition(now);
    controls.update();
    renderer.render(scene, camera);
  });

  return {
    showView: (name) => {
      transition = { from: currentView(), to: cameraView(hole, name), startedAt: performance.now() };
    },
    dispose: () => {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      controls.dispose();
      scene.traverse((object) => {
        if (object instanceof Mesh || object instanceof LineSegments) {
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
