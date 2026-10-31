import { elevationAt, type Hole, type Vec2, type Vec3 } from '@dgrpg/course-format';
import { DISC_REST_HEIGHT, type ThrowEvent } from '@dgrpg/sim';

import {
  Color,
  Fog,
  type Group,
  Light,
  Line,
  LineSegments,
  Mesh,
  PCFShadowMap,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createAimGroup, createZoneMarker } from './aim.ts';
import { createBasketGroup } from './basket.ts';
import { type CameraView, type CameraViewName, cameraView } from './camera-views.ts';
import { createDiscMesh, createTrail, keepDiscReadable } from './disc.ts';
import { createEffects } from './effects.ts';
import { createLights } from './lighting.ts';
import { palette } from './palette.ts';
import { positionAt, type Timeline, timeline } from './playback.ts';
import { createRegionLayer, type RegionDisplay } from './regions.ts';
import { createTeePad } from './tee.ts';
import { createTerrainMesh } from './terrain.ts';
import { createTreeGroup } from './trees.ts';

type TreeContact = Extract<ThrowEvent, { readonly type: 'contact' }>;

export { CAMERA_TILT, type CameraViewName } from './camera-views.ts';
export { palette } from './palette.ts';
export type { RegionDisplay } from './regions.ts';

export type HoleViewOptions = {
  /** Called with the ground point when the player clicks (not drags) the terrain. */
  readonly onGroundClick?: (point: Vec2) => void;
  /**
   * Called as the pointer moves: the ground point under it (or undefined off the
   * terrain) and the pointer's position in the canvas, for tooltips.
   */
  readonly onGroundHover?: (
    point: Vec2 | undefined,
    screen: { readonly x: number; readonly y: number },
  ) => void;
};

export type HoleView = {
  /** Smoothly moves the camera to a named view. `lie` is used by the 'lie' view. */
  readonly showView: (name: CameraViewName, lie?: Vec2) => void;
  /** Places the disc at rest on the ground. */
  readonly setLie: (lie: Vec2) => void;
  /** Shows the aim marker and line, or hides them with `undefined`. `fade` curves the line (metres, + = right). */
  readonly setAim: (lie: Vec2, target: Vec2 | undefined, fade?: number) => void;
  /** Marks the point a Big Brained Putt is aimed at, or clears it with `undefined`. */
  readonly setPuttZone: (point: Vec3 | undefined) => void;
  /** Shows, hides, and highlights the Planned Shot regions. */
  readonly showRegions: (display: RegionDisplay) => void;
  /** Plays a throw's moves. Resolves when the disc comes to rest. */
  readonly play: (events: readonly ThrowEvent[]) => Promise<void>;
  readonly dispose: () => void;
};

const TRANSITION_SECONDS = 0.9;
/** Pointer travel (px) below which a press counts as a click, not a camera drag. */
const CLICK_TOLERANCE = 6;
const FOLLOW_STRENGTH = 0.08;
/** How close the disc gets to a contact point before its effect fires (m). More than one frame of travel. */
const CONTACT_REACH = 1;
/** Keyboard pan speed, in camera-to-target distances per second. */
const PAN_SPEED = 0.9;

const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

const toVector = ([x, y, z]: readonly [number, number, number]): Vector3 => new Vector3(x, y, z);

const disposeObject = (object: { traverse: (fn: (child: unknown) => void) => void }) => {
  object.traverse((child) => {
    if (child instanceof Light) child.dispose();
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
  renderer.shadowMap.type = PCFShadowMap;

  const scene = new Scene();
  scene.background = new Color(palette.sky);

  const width = (hole.elevation.columns - 1) * hole.elevation.cellSize;
  const depth = (hole.elevation.rows - 1) * hole.elevation.cellSize;
  const span = Math.max(width, depth);
  scene.fog = new Fog(palette.fog, span * 1.2, span * 3);

  scene.add(...createLights(width, depth));

  const terrain = createTerrainMesh(hole.elevation);
  scene.add(terrain);
  scene.add(...hole.trees.map((tree) => createTreeGroup(tree, hole)));

  const basket = createBasketGroup();
  basket.position.set(hole.basket[0], elevationAt(hole, hole.basket), hole.basket[1]);
  scene.add(basket);
  scene.add(createTeePad(hole));

  const regions = createRegionLayer(hole);
  scene.add(regions.group);

  const effects = createEffects((treeId) =>
    scene.getObjectByName(`tree:${treeId}`)?.getObjectByName('canopy'),
  );
  scene.add(effects.group);

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
  let playback:
    | { plan: Timeline; startedAt: number; done: () => void; contacts: readonly TreeContact[] }
    | undefined;
  let aim: Group | undefined;
  let zoneMarker: Mesh | undefined;

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
      // Follow by sliding the camera and its target together, so the view angle never swings.
      const follow = disc.position.clone().sub(controls.target).multiplyScalar(FOLLOW_STRENGTH);
      controls.target.add(follow);
      camera.position.add(follow);
      // Fire each tree contact's effect as the disc reaches it.
      const [next, ...later] = playback.contacts;
      if (next && disc.position.distanceTo(new Vector3(...next.point)) < CONTACT_REACH) {
        effects.burst(next.treeId, next.part, next.point);
        playback = { ...playback, contacts: later };
      }
    }
    if (elapsed >= playback.plan.seconds) {
      const { done } = playback;
      playback = undefined;
      done();
    }
  };

  // Click (not drag) on the terrain reports a ground point; moving reports hover.
  const raycaster = new Raycaster();
  const groundAt = (clientX: number, clientY: number): Vec2 | undefined => {
    const rect = canvas.getBoundingClientRect();
    const pointer = new Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(terrain, false)[0];
    return hit ? [hit.point.x, hit.point.z] : undefined;
  };
  let pressedAt: Vector2 | undefined;
  const onPointerDown = (event: PointerEvent) => {
    pressedAt = event.button === 0 ? new Vector2(event.clientX, event.clientY) : undefined;
  };
  const onPointerUp = (event: PointerEvent) => {
    const start = pressedAt;
    pressedAt = undefined;
    if (!start || !options.onGroundClick) return;
    if (start.distanceTo(new Vector2(event.clientX, event.clientY)) > CLICK_TOLERANCE) return;
    const point = groundAt(event.clientX, event.clientY);
    if (point) options.onGroundClick(point);
  };
  const onPointerMove = (event: PointerEvent) => {
    if (!options.onGroundHover || event.buttons !== 0) return; // No hover while dragging the camera.
    const rect = canvas.getBoundingClientRect();
    options.onGroundHover(groundAt(event.clientX, event.clientY), {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  };
  const onPointerLeave = () => options.onGroundHover?.(undefined, { x: 0, y: 0 });
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', onPointerLeave);

  // Keyboard panning (WASD / arrows) along the ground, relative to where the camera faces.
  const panKeys: Record<string, readonly [forward: number, right: number]> = {
    KeyW: [1, 0],
    ArrowUp: [1, 0],
    KeyS: [-1, 0],
    ArrowDown: [-1, 0],
    KeyA: [0, -1],
    ArrowLeft: [0, -1],
    KeyD: [0, 1],
    ArrowRight: [0, 1],
  };
  const heldKeys = new Set<string>();
  const isTyping = (target: EventTarget | null) =>
    target instanceof HTMLElement &&
    (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
  const onKeyDown = (event: KeyboardEvent) => {
    if (!(event.code in panKeys) || isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey)
      return;
    event.preventDefault(); // Arrows would otherwise scroll the page.
    heldKeys.add(event.code);
  };
  const onKeyUp = (event: KeyboardEvent) => {
    heldKeys.delete(event.code);
  };
  const onBlur = () => heldKeys.clear();
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  const stepKeyboardPan = (seconds: number) => {
    if (heldKeys.size === 0) return;
    const [forward, right] = [...heldKeys].reduce(
      ([f, r], code) => {
        const [df, dr] = panKeys[code] ?? [0, 0];
        return [f + df, r + dr];
      },
      [0, 0],
    );
    if (forward === 0 && right === 0) return;
    transition = undefined; // The player took the camera.
    const facing = new Vector3().subVectors(controls.target, camera.position).setY(0);
    if (facing.lengthSq() < 1e-6) camera.getWorldDirection(facing).setY(0);
    facing.normalize();
    const side = new Vector3(-facing.z, 0, facing.x);
    // Faster when zoomed out, so a pan always feels like the same screen speed.
    const speed = Math.max(camera.position.distanceTo(controls.target), 5) * PAN_SPEED;
    const move = facing
      .multiplyScalar(forward)
      .add(side.multiplyScalar(right))
      .normalize()
      .multiplyScalar(speed * seconds);
    camera.position.add(move);
    controls.target.add(move);
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

  let lastFrame: number | undefined;
  renderer.setAnimationLoop((now) => {
    // Clamp the step so a backgrounded tab doesn't jump the camera on return.
    const seconds = lastFrame === undefined ? 0 : Math.min((now - lastFrame) / 1000, 0.1);
    lastFrame = now;
    stepTransition(now);
    stepKeyboardPan(seconds);
    stepPlayback(now);
    effects.step(seconds);
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
    showRegions: regions.show,
    setAim: (lie, target, fade = 0) => {
      if (aim) {
        scene.remove(aim);
        disposeObject(aim);
        aim = undefined;
      }
      if (target) {
        aim = createAimGroup(hole, lie, target, fade);
        scene.add(aim);
      }
    },
    setPuttZone: (point) => {
      if (zoneMarker) {
        scene.remove(zoneMarker);
        disposeObject(zoneMarker);
        zoneMarker = undefined;
      }
      if (point) {
        zoneMarker = createZoneMarker(point);
        scene.add(zoneMarker);
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
        const contacts = events.flatMap((event) => (event.type === 'contact' ? [event] : []));
        playback = { plan, startedAt: performance.now(), done: resolve, contacts };
      }),
    dispose: () => {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      controls.dispose();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      effects.dispose();
      disposeObject(scene);
      renderer.dispose();
    },
  };
};
