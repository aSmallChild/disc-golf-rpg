import { type Hole, pointInPolygon, type Region, type Vec2 } from '@dgrpg/course-format';
import { distance2 } from './geometry.ts';
import { lineLabels, throwTypeLabels } from './lines.ts';
import type { PlannedShotKind, Player, ShotHeight, ThrowLine, ThrowType } from './player.ts';
import { PUTT_RANGE, TAP_IN_RANGE } from './putt.ts';

/** Throws up to this length count as upshots; longer ones are drives. */
export const UPSHOT_RANGE = 80;

/** Display names. Players see "Big Brained", the code says "planned". */
export const plannedShotLabels: Record<PlannedShotKind, string> = {
  putt: 'Big Brained Putt',
  upshot: 'Big Brained Upshot',
  drive: 'Big Brained Drive',
};

export const plannedKindFor = (lie: Vec2, target: Vec2): Exclude<PlannedShotKind, 'putt'> =>
  distance2(lie, target) <= UPSHOT_RANGE ? 'upshot' : 'drive';

export type Refusal = { readonly allowed: false; readonly why: string };

export type PlannedShotCheck =
  | { readonly allowed: true; readonly region: Region; readonly kind: PlannedShotKind }
  | Refusal;

const lockedKind = (kind: PlannedShotKind): Refusal => {
  const length =
    kind === 'putt'
      ? 'putts inside circle 1'
      : kind === 'drive'
        ? `throws over ${UPSHOT_RANGE} m`
        : `throws up to ${UPSHOT_RANGE} m`;
  return { allowed: false, why: `${plannedShotLabels[kind]} (${length}) is not unlocked yet.` };
};

/**
 * Whether a Planned Shot at `target` inside region `regionId`, on `line` with `throwType` at `height`, is possible.
 * The UI uses this to explain locked regions, and `apply` uses it to reject bad actions.
 */
export const checkPlannedShot = (
  hole: Hole,
  player: Player,
  lie: Vec2,
  regionId: string,
  target: Vec2,
  line: ThrowLine,
  throwType: ThrowType,
  height: ShotHeight = 'normal',
): PlannedShotCheck => {
  const region = hole.regions.find((candidate) => candidate.id === regionId);
  if (!region) return { allowed: false, why: 'There is no such region on this hole.' };
  if (!pointInPolygon(target, region.polygon)) return { allowed: false, why: `Aim inside ${region.label}.` };
  if (distance2(lie, hole.basket) <= PUTT_RANGE) {
    return { allowed: false, why: 'Inside circle 1 you putt. Pick a basket zone instead.' };
  }
  const kind = plannedKindFor(lie, target);
  if (!player.plannedShots.includes(kind)) return lockedKind(kind);
  if (line !== 'straight' && !player.lines.includes(line)) {
    return { allowed: false, why: `You can't throw a ${lineLabels[line].toLowerCase()} line yet.` };
  }
  if (throwType !== 'backhand' && !player.throwTypes.includes(throwType)) {
    return { allowed: false, why: `You can't throw ${throwTypeLabels[throwType].toLowerCase()} yet.` };
  }
  if (height !== 'normal' && !player.shotHeights.includes(height)) {
    return { allowed: false, why: "You can't keep a disc under a low ceiling yet." };
  }
  return { allowed: true, region, kind };
};

/** Whether a Big Brained Putt is possible from `lie`. */
export const checkPlannedPutt = (
  hole: Hole,
  player: Player,
  lie: Vec2,
): { readonly allowed: true } | Refusal => {
  const distance = distance2(lie, hole.basket);
  if (distance > PUTT_RANGE) return { allowed: false, why: 'Basket zones open up inside circle 1.' };
  if (distance <= TAP_IN_RANGE) return { allowed: false, why: 'Just tap it in.' };
  if (!player.plannedShots.includes('putt')) return lockedKind('putt');
  return { allowed: true };
};
