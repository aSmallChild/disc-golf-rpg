import {
  canopyRadiusAt,
  elevationAt,
  type Hole,
  type Tree,
  trunkRadiusAt,
  type Vec2,
  type Vec3,
} from '@dgrpg/course-format';
import { DISC_RADIUS, DISC_REST_HEIGHT } from './disc.ts';
import { chanceFrom, type Reason, type ThrowEvent } from './events.ts';
import { type FlightLeg, flightPoint, legLength } from './flight.ts';
import { add2, distance2, length2, normalize2, rotate2, scale2, sub2, toVec2, toVec3 } from './geometry.ts';
import type { Player } from './player.ts';
import { nextFloat, nextGaussian, nextSign, type Rng, rollD100 } from './rng.ts';
import { golfScoreLabel } from './scoring.ts';

export type TreePart = 'trunk' | 'canopy';

/** Metres between samples along a flight when looking for trees. Thinner than any trunk. */
const SAMPLE_SPACING = 0.2;
const BISECT_STEPS = 12;
/** How far into the leaves the disc gets before the canopy reacts, so the hit reads on screen. */
const CANOPY_DEPTH = 0.4;
/** After this many trees in one throw, the disc just lands where it's going. */
const MAX_ENCOUNTERS = 3;
const DEG = Math.PI / 180;

const bothParts: readonly TreePart[] = ['trunk', 'canopy'];

/** Which part of `tree` the disc at `point` is touching, if any. The trunk wins: it's solid. */
export const treePartAt = (
  hole: Hole,
  tree: Tree,
  [x, y, z]: Vec3,
  parts: readonly TreePart[] = bothParts,
): TreePart | undefined => {
  const height = y - elevationAt(hole, tree.position);
  const away = Math.hypot(x - tree.position[0], z - tree.position[1]);
  const trunk = trunkRadiusAt(tree, height);
  if (parts.includes('trunk') && trunk !== undefined && away <= trunk + DISC_RADIUS) return 'trunk';
  const canopy = canopyRadiusAt(tree, height);
  if (parts.includes('canopy') && canopy !== undefined && away <= canopy) return 'canopy';
  return undefined;
};

export type Contact = {
  readonly tree: Tree;
  readonly part: TreePart;
  /** Fraction of the leg flown when the contact happens. */
  readonly t: number;
  /** Where the disc's centre is at contact. On a trunk, its edge touches the bark. */
  readonly point: Vec3;
};

/**
 * The first tree the leg runs into, skipping trees in `ignore`. Uses the same
 * curve the renderer plays, so the contact on screen is exactly this one.
 */
export const findContact = (
  hole: Hole,
  leg: FlightLeg,
  ignore: readonly string[] = [],
  parts: readonly TreePart[] = bothParts,
): Contact | undefined => {
  const trees = hole.trees.filter((tree) => !ignore.includes(tree.id));
  if (trees.length === 0) return undefined;
  const length = Math.max(legLength(leg), 0.01);
  const steps = Math.max(8, Math.ceil(length / SAMPLE_SPACING));
  const hitAt = (t: number) =>
    trees.flatMap((tree) => {
      const part = treePartAt(hole, tree, flightPoint(leg, t), parts);
      return part ? [{ tree, part }] : [];
    })[0];

  const step = Array.from({ length: steps }, (_, index) => index + 1).find((index) => hitAt(index / steps));
  if (step === undefined) return undefined;
  const hit = hitAt(step / steps);
  if (!hit) return undefined;
  const { tree, part } = hit;

  // Narrow down to the moment the disc first touches the part.
  const [, touch] = Array.from({ length: BISECT_STEPS }).reduce<readonly [number, number]>(
    ([lo, hi]) => {
      const mid = (lo + hi) / 2;
      return treePartAt(hole, tree, flightPoint(leg, mid), [part]) ? [lo, mid] : [mid, hi];
    },
    [(step - 1) / steps, step / steps],
  );

  if (part === 'canopy') {
    const t = Math.min(touch + CANOPY_DEPTH / length, 1);
    return { tree, part, t, point: flightPoint(leg, t) };
  }
  // Put the disc's edge exactly on the bark, on the side it came from.
  const at = flightPoint(leg, touch);
  const outward = sub2(toVec2(at), tree.position);
  const incoming = normalize2(sub2(toVec2(leg.to), toVec2(leg.from)));
  const facing = length2(outward) > 1e-6 ? normalize2(outward) : scale2(incoming, -1);
  const radius = trunkRadiusAt(tree, at[1] - elevationAt(hole, tree.position)) ?? tree.trunk.radius;
  return {
    tree,
    part,
    t: touch,
    point: toVec3(add2(tree.position, scale2(facing, radius + DISC_RADIUS)), at[1]),
  };
};

/** Pushes a resting spot out of any trunk it overlaps. */
export const clearOfTrunks = (hole: Hole, point: Vec2): Vec2 =>
  hole.trees.reduce<Vec2>((spot, tree) => {
    const clearance = tree.trunk.radius + DISC_RADIUS;
    const offset = sub2(spot, tree.position);
    if (length2(offset) >= clearance) return spot;
    const away = length2(offset) > 1e-6 ? normalize2(offset) : ([1, 0] as const);
    return add2(tree.position, scale2(away, clearance));
  }, point);

export const canopyReasons = (player: Player, tree: Tree): readonly Reason[] => [
  {
    source: `Gaps in the leaves (${Math.round(tree.canopy.density * 100)}% dense)`,
    value: Math.round((1 - tree.canopy.density) * 100),
  },
  { source: `Driving skill (${golfScoreLabel(player.skills.driving)})`, value: -player.skills.driving * 4 },
];

/** A trunk always gets touched; the dice decide how the bark sends the disc back. */
export const trunkReasons = (): readonly Reason[] => [{ source: 'Luck of the bounce', value: 30 }];

export type TreeFlight = {
  /** The checks, messages, and moves that play the leg out, ending on the ground. */
  readonly events: readonly ThrowEvent[];
  readonly end: Vec2;
  /** Whether a tree stopped or turned the disc. False if it flew clean (or only through leaves). */
  readonly interrupted: boolean;
  readonly rng: Rng;
};

type Outcome = { readonly label: string; readonly success: boolean; readonly text: string };

const canopyOutcome = (success: boolean, swallowed: boolean): Outcome =>
  success
    ? { label: 'Through the leaves', success, text: 'Threaded the branches.' }
    : swallowed
      ? { label: 'Swallowed', success, text: 'The tree ate it. Down it comes.' }
      : { label: 'Deflected', success, text: 'Clipped the branches and got knocked off line.' };

const trunkOutcome = (success: boolean, dead: boolean): Outcome =>
  success
    ? { label: 'Good kick', success, text: 'Kicked off the trunk and kept going. Lucky.' }
    : dead
      ? { label: 'Dead stop', success, text: 'Straight into the trunk. Dropped like a stone.' }
      : { label: 'Bad kick', success, text: 'Kicked off the trunk the wrong way.' };

/**
 * Plays a flight leg through the hole's trees. Each tree the curve touches is a
 * dice roll with reasons. Leaves can let the disc through; anything else ends
 * the leg at the contact point and starts a new one from there.
 */
export const flyThroughTrees = (
  hole: Hole,
  player: Player,
  leg: FlightLeg,
  rng: Rng,
  parts: readonly TreePart[] = bothParts,
): TreeFlight => {
  // A disc thrown from under a tree doesn't hit that tree on the way out.
  const overhead = hole.trees.filter((tree) => treePartAt(hole, tree, leg.from)).map((tree) => tree.id);
  const onGround = (point: Vec2): Vec3 => toVec3(point, elevationAt(hole, point) + DISC_REST_HEIGHT);

  const fly = (
    current: FlightLeg,
    ignore: readonly string[],
    encounters: number,
    events: readonly ThrowEvent[],
    rng: Rng,
    interrupted: boolean,
  ): TreeFlight => {
    const contact = encounters < MAX_ENCOUNTERS ? findContact(hole, current, ignore, parts) : undefined;
    if (!contact) {
      const [x, , z] = flightPoint(current, 1);
      return { events: [...events, { type: 'move', leg: current }], end: [x, z], interrupted, rng };
    }

    const { tree, part, point } = contact;
    const reasons = part === 'canopy' ? canopyReasons(player, tree) : trunkReasons();
    const chance = chanceFrom(reasons, 5, 95);
    const [roll, r1] = rollD100(rng);
    const success = roll <= chance;
    // Failures split by how badly they missed, so the one roll explains everything.
    const worse = roll > chance + (100 - chance) / 2;
    const outcome = part === 'canopy' ? canopyOutcome(success, worse) : trunkOutcome(success, worse);
    const check: ThrowEvent = {
      type: 'check',
      label: part === 'canopy' ? 'Canopy' : 'Trunk',
      chance,
      roll,
      outcome: outcome.label,
      success,
      reasons,
    };
    const message: ThrowEvent = { type: 'message', text: outcome.text };

    if (part === 'canopy' && success) {
      return fly(current, [...ignore, tree.id], encounters + 1, [...events, check, message], r1, interrupted);
    }

    const flown: FlightLeg = { ...current, until: contact.t * current.until, end: point };
    const incoming = normalize2(sub2(toVec2(current.to), toVec2(current.from)));
    const remaining = distance2(toVec2(point), toVec2(current.to));
    const [side, r2] = nextSign(r1);
    const [a, r3] = nextFloat(r2);
    const [g, r4] = nextGaussian(r3);
    const from = toVec2(point);

    const glance = (degrees: number, distance: number, apex: number): FlightLeg => {
      const heading = rotate2(incoming, side * degrees * DEG);
      return {
        from: point,
        to: onGround(clearOfTrunks(hole, add2(from, scale2(heading, distance)))),
        apex,
        fade: 0,
        until: 1,
        pace: 'glance',
      };
    };
    const drop = (spot: Vec2): FlightLeg => ({
      from: point,
      to: onGround(clearOfTrunks(hole, spot)),
      apex: 0.1,
      fade: 0,
      until: 1,
      pace: 'drop',
    });

    const next: FlightLeg =
      part === 'canopy'
        ? worse
          ? drop(add2(from, scale2(incoming, g * 0.6)))
          : glance(25 + a * 45, remaining * (0.15 + a * 0.25) + 1, 0.6)
        : success
          ? glance(10 + a * 20, remaining * (0.3 + a * 0.3) + 2, 1.2)
          : worse
            ? drop(sub2(tree.position, scale2(incoming, tree.trunk.radius + DISC_RADIUS + 0.3 + a * 0.5)))
            : glance(70 + a * 90, 3 + a * 9, 0.8);

    return fly(
      next,
      [tree.id],
      encounters + 1,
      [...events, { type: 'move', leg: flown }, check, message],
      r4,
      true,
    );
  };

  return fly(leg, overhead, 0, [], rng, false);
};
