import type { Vec3 } from '@dgrpg/course-format';
import { createRng, nextFloat, type Rng } from '@dgrpg/sim';
import {
  type BufferGeometry,
  Group,
  Mesh,
  MeshLambertMaterial,
  type Object3D,
  TetrahedronGeometry,
  Vector3,
} from 'three';
import { palette } from './palette.ts';

export type ContactPart = 'trunk' | 'canopy';

/** Bark chips are small and few; a leaf burst is bigger and floats. */
const bursts: Record<
  ContactPart,
  {
    readonly count: number;
    readonly size: number;
    readonly speed: number;
    readonly gravity: number;
    readonly seconds: number;
    readonly color: number;
  }
> = {
  trunk: { count: 10, size: 0.09, speed: 3.5, gravity: 9, seconds: 0.8, color: palette.bark },
  canopy: { count: 18, size: 0.22, speed: 2.5, gravity: 2.5, seconds: 1.4, color: palette.leaf },
};

const SWAY_SECONDS = 0.9;
const SWAY_ANGLE = 0.06;

type Particle = { readonly mesh: Mesh; readonly velocity: Vector3; readonly spin: Vector3 };
type Burst = {
  readonly particles: readonly Particle[];
  readonly material: MeshLambertMaterial;
  readonly gravity: number;
  readonly seconds: number;
  age: number;
};
type Sway = { readonly canopy: Object3D; readonly axis: Vector3; age: number };

/** A seed from the contact point, so the same throw always throws the same flecks. */
const seedFor = ([x, y, z]: Vec3): number =>
  (Math.imul(Math.round(x * 97), 73856093) ^
    Math.imul(Math.round(y * 89), 19349663) ^
    Math.imul(Math.round(z * 83), 83492791)) >>>
  0;

const randoms = (rng: Rng, count: number): readonly number[] =>
  Array.from({ length: count }).reduce<{ readonly values: readonly number[]; readonly rng: Rng }>(
    ({ values, rng: current }) => {
      const [value, next] = nextFloat(current);
      return { values: [...values, value], rng: next };
    },
    { values: [], rng },
  ).values;

/**
 * Small contact effects: bark chips off a trunk, a leaf burst and a sway in a
 * canopy. Cosmetic only. Particles are mutable by nature, so they stay inside here.
 */
export const createEffects = (findCanopy: (treeId: string) => Object3D | undefined) => {
  const group = new Group();
  group.name = 'effects';
  const shapes: Record<ContactPart, BufferGeometry> = {
    trunk: new TetrahedronGeometry(bursts.trunk.size),
    canopy: new TetrahedronGeometry(bursts.canopy.size),
  };
  let active: readonly Burst[] = [];
  let sways: readonly Sway[] = [];

  const burst = (treeId: string, part: ContactPart, point: Vec3) => {
    const spec = bursts[part];
    const values = randoms(createRng(seedFor(point)), spec.count * 6 + 2);
    const at = (index: number) => values[index] ?? 0.5;
    const material = new MeshLambertMaterial({ color: spec.color, flatShading: true, transparent: true });
    const particles = Array.from({ length: spec.count }, (_, index): Particle => {
      const base = index * 6;
      const mesh = new Mesh(shapes[part], material);
      mesh.position.set(...point);
      const direction = new Vector3(at(base) - 0.5, at(base + 1) * 0.8, at(base + 2) - 0.5).normalize();
      const velocity = direction.multiplyScalar(spec.speed * (0.4 + at(base + 3) * 0.6));
      const spin = new Vector3(at(base + 4) * 12, at(base + 5) * 12, 0);
      group.add(mesh);
      return { mesh, velocity, spin };
    });
    active = [...active, { particles, material, gravity: spec.gravity, seconds: spec.seconds, age: 0 }];

    const canopy = part === 'canopy' ? findCanopy(treeId) : undefined;
    if (canopy) {
      const axis = new Vector3(at(values.length - 2) - 0.5, 0, at(values.length - 1) - 0.5).normalize();
      sways = [...sways.filter((sway) => sway.canopy !== canopy), { canopy, axis, age: 0 }];
    }
  };

  const step = (seconds: number) => {
    active.forEach((current) => {
      current.age += seconds;
      current.material.opacity = Math.max(0, 1 - current.age / current.seconds);
      current.particles.forEach(({ mesh, velocity, spin }) => {
        velocity.y -= current.gravity * seconds;
        velocity.multiplyScalar(1 - 1.5 * seconds); // Air drag, so leaves drift.
        mesh.position.addScaledVector(velocity, seconds);
        mesh.rotation.x += spin.x * seconds;
        mesh.rotation.y += spin.y * seconds;
      });
    });
    const [done, alive] = [active.filter((b) => b.age >= b.seconds), active.filter((b) => b.age < b.seconds)];
    done.forEach((finished) => {
      finished.particles.forEach(({ mesh }) => {
        group.remove(mesh);
      });
      finished.material.dispose();
    });
    active = alive;

    sways.forEach((sway) => {
      sway.age += seconds;
      const t = Math.min(sway.age / SWAY_SECONDS, 1);
      // A damped wobble around a random horizontal axis.
      const angle = SWAY_ANGLE * (1 - t) * Math.sin(t * Math.PI * 5);
      sway.canopy.rotation.set(sway.axis.x * angle, 0, sway.axis.z * angle);
    });
    sways = sways.filter((sway) => sway.age < SWAY_SECONDS);
  };

  const dispose = () => {
    active.forEach(({ material }) => {
      material.dispose();
    });
    active = [];
    Object.values(shapes).forEach((shape) => {
      shape.dispose();
    });
  };

  return { group, burst, step, dispose };
};
