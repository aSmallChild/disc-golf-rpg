import { elevationAt, type Hole, type Vec2 } from '@dgrpg/course-format';
import { DISC_REST_HEIGHT, type ThrowEvent } from '@dgrpg/sim';
import {
  AmbientLight,
  Color,
  DirectionalLight,
  Fog,
  type Group,
  HemisphereLight,
  Line,
  LineSegments,
  Mesh,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createAimGroup } from './aim.ts';
import { createBasketGroup } from './basket.ts';
import { type CameraView, type CameraViewName, cameraView } from './camera-views.ts';
import { createDiscMesh, createTrail, keepDiscReadable } from './disc.ts';
import { palette } from './palette.ts';
import { positionAt, type Timeline, timeline } from './playback.ts';
import { createTeePad } from './tee.ts';
import { createTerrainMesh } from './terrain.ts';
import { createTreeGroup } from './trees.ts';

export { CAMERA_TILT, type CameraViewName } from './camera-views.ts';
export { palette } from './palette.ts';

export type HoleViewOptions = {
  /** Called with the ground point when the player clicks (not drags) the terrain. */
  readonly onGroundClick?: (point: Vec2) => void;
};

export type HoleView = {
  /** Smoothly moves the camera to a named view. `lie` is used by the 'lie' view. */
  readonly showView: (name: CameraViewName, lie?: Vec2) => void;
  /** Places the disc at rest on the ground. */
  readonly setLie: (lie: Vec2) => void;
  /** Shows the aim marker and line, or hides them with `undefined`. */
  readonly setAim: (lie: Vec2, target: Vec2 | undefined) => void;
  /** Plays a throw's moves. Resolves when the disc comes to rest. */
  readonly play: (events: readonly ThrowEvent[]) => Promise<void>;
  readonly dispose: () => void;
};

const TRANSITION_SECONDS = 0.9;
/** Pointer travel (px) below which a press counts as a click, not a camera drag. */
const CLICK_TOLERANCE = 6;
const FOLLOW_STRENGTH = 0.08;

const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

const toVector = ([x, y, z]: readonly [number, number, number]): Vector3 => new Vector3(x, y, z);

const disposeObject = (object: { traverse: (fn: (child: unknown) => void) => void }) => {
  object.traverse((child) => {
    if (child instanceof Mesh || child instanceof LineSegments || child instanceof Line) {
      child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        material.dispose();
      });
    }
  });
};

/**
 * Mounts a Three.js view of a hole into the given canvas.
 * Three.js is object-oriented, so this module is the boundary: it hides
 * the mutable scene behind functions and returns a disposer.
 */
export const mountHoleView = (
  canvas: HTMLCanvasElement,
  hole: Hole,
  options: HoleViewOptions = {},
): HoleView => {
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

  const terrain = createTerrainMesh(hole.elevation);
  scene.add(terrain);
  scene.add(...hole.trees.map((tree) => createTreeGroup(tree, hole.elevation)));

  const basket = createBasketGroup();
  basket.position.set(hole.basket[0], elevationAt(hole, hole.basket), hole.basket[1]);
  scene.add(basket);
  scene.add(createTeePad(hole));

  const disc = createDiscMesh();
  const trail = createTrail();
  trail.line.visible = false;
  scene.add(disc, trail.line);

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

  // The only mutable state lives here: camera transition, playback, aim.
  let transition: { from: CameraView; to: CameraView; startedAt: number } | undefined;
  let playback: { plan: Timeline; startedAt: number; done: () => void } | undefined;
  let aim: Group | undefined;

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

  const stepPlayback = (now: number) => {
    if (!playback) return;
    const elapsed = (now - playback.startedAt) / 1000;
    const point = positionAt(playback.plan, elapsed);
    if (point) {
      disc.position.set(...point);
      trail.push(disc.position);
      controls.target.lerp(disc.position, FOLLOW_STRENGTH);
    }
    if (elapsed >= playback.plan.seconds) {
      const { done } = playback;
      playback = undefined;
      done();
    }
  };

  // Click (not drag) on the terrain reports a ground point.
  const raycaster = new Raycaster();
  let pressedAt: Vector2 | undefined;
  const onPointerDown = (event: PointerEvent) => {
    pressedAt = event.button === 0 ? new Vector2(event.clientX, event.clientY) : undefined;
  };
  const onPointerUp = (event: PointerEvent) => {
    const start = pressedAt;
    pressedAt = undefined;
    if (!start || !options.onGroundClick) return;
    if (start.distanceTo(new Vector2(event.clientX, event.clientY)) > CLICK_TOLERANCE) return;
    const rect = canvas.getBoundingClientRect();
    const pointer = new Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(terrain, false)[0];
    if (hit) options.onGroundClick([hit.point.x, hit.point.z]);
  };
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);

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
    stepPlayback(now);
    controls.update();
    keepDiscReadable(disc, camera);
    renderer.render(scene, camera);
  });

  const setLie = (lie: Vec2) => {
    disc.position.set(lie[0], elevationAt(hole, lie) + DISC_REST_HEIGHT, lie[1]);
    trail.line.visible = false;
  };
  setLie(hole.tee);

  return {
    showView: (name, lie) => {
      transition = { from: currentView(), to: cameraView(hole, name, lie), startedAt: performance.now() };
    },
    setLie,
    setAim: (lie, target) => {
      if (aim) {
        scene.remove(aim);
        disposeObject(aim);
        aim = undefined;
      }
      if (target) {
        aim = createAimGroup(hole, lie, target);
        scene.add(aim);
      }
    },
    play: (events) =>
      new Promise<void>((resolve) => {
        const plan = timeline(events);
        if (plan.legs.length === 0) {
          resolve();
          return;
        }
        transition = undefined;
        const start = positionAt(plan, 0);
        if (start) disc.position.set(...start);
        trail.reset(disc.position);
        trail.line.visible = true;
        playback = { plan, startedAt: performance.now(), done: resolve };
      }),
    dispose: () => {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      controls.dispose();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      disposeObject(scene);
      renderer.dispose();
    },
  };
};
