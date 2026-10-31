import { type Hole, pointInPolygon, type Region, type Vec2 } from '@dgrpg/course-format';
import { distance2 } from './geometry.ts';
import type { PlannedShotKind, Player } from './player.ts';
import { PUTT_RANGE } from './putt.ts';

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

export type PlannedShotCheck =
  | { readonly allowed: true; readonly region: Region; readonly kind: PlannedShotKind }
  | { readonly allowed: false; readonly why: string };

/**
 * Whether a Planned Shot at `target` inside region `regionId` is possible.
 * The UI uses this to explain locked regions, and `apply` uses it to reject bad actions.
 */
export const checkPlannedShot = (
  hole: Hole,
  player: Player,
  lie: Vec2,
  regionId: string,
  target: Vec2,
): PlannedShotCheck => {
  const region = hole.regions.find((candidate) => candidate.id === regionId);
  if (!region) return { allowed: false, why: 'There is no such region on this hole.' };
  if (!pointInPolygon(target, region.polygon)) return { allowed: false, why: `Aim inside ${region.label}.` };
  if (distance2(lie, hole.basket) <= PUTT_RANGE) {
    return { allowed: false, why: 'Inside circle 1 you putt. Basket zones come later.' };
  }
  const kind = plannedKindFor(lie, target);
  if (!player.plannedShots.includes(kind)) {
    const length = kind === 'drive' ? `throws over ${UPSHOT_RANGE} m` : `throws up to ${UPSHOT_RANGE} m`;
    return { allowed: false, why: `${plannedShotLabels[kind]} (${length}) is not unlocked yet.` };
  }
  return { allowed: true, region, kind };
};
