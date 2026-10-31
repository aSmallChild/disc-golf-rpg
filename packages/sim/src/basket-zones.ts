import { basketDimensions as d, elevationAt, type Hole, type Vec2, type Vec3 } from '@dgrpg/course-format';
import { DISC_REST_HEIGHT, RELEASE_HEIGHT } from './disc.ts';
import { chanceFrom, type Reason, type ThrowEvent } from './events.ts';
import type { FlightLeg } from './flight.ts';
import { add2, distance2, normalize2, rightOf, scale2, sub2, toVec3 } from './geometry.ts';
import type { Player } from './player.ts';
import type { PuttResolution } from './putt.ts';
import { nextGaussian, nextRange, type Rng, rollD100 } from './rng.ts';
import { golfScoreLabel } from './scoring.ts';

/** Where a Big Brained Putt is aimed on (or under) the basket. */
export type BasketZone = 'centre-chains' | 'left-chains' | 'right-chains' | 'band' | 'pole' | 'layup';

export const basketZones: readonly BasketZone[] = [
  'centre-chains',
  'left-chains',
  'right-chains',
  'band',
  'pole',
  'layup',
];

type ZoneSpec = {
  readonly label: string;
  /** One line on the trade-off, for the UI. */
  readonly blurb: string;
  readonly base: number;
  /** Misses within this many points of the chance count as near misses. */
  readonly nearMiss: number;
};

const zones: Record<BasketZone, ZoneSpec> = {
  'centre-chains': { label: 'Centre chains', blurb: 'The safe target.', base: 92, nearMiss: 15 },
  'left-chains': {
    label: 'Left chains',
    blurb: 'A little harder, but a miss stays close on the left.',
    base: 88,
    nearMiss: 35,
  },
  'right-chains': {
    label: 'Right chains',
    blurb: 'A little harder, but a miss stays close on the right.',
    base: 88,
    nearMiss: 35,
  },
  band: { label: 'Top band', blurb: 'It might slide in. It might sit on top.', base: 45, nearMiss: 25 },
  pole: { label: 'Pole', blurb: 'Pole hole or bust.', base: 35, nearMiss: 0 },
  layup: { label: 'Lay up', blurb: 'Drop it short for a tap-in.', base: 97, nearMiss: 0 },
};

export const basketZoneLabel = (zone: BasketZone): string => zones[zone].label;
export const basketZoneBlurb = (zone: BasketZone): string => zones[zone].blurb;

const PLANNED_PUTT_BONUS = 8;
const SKILL_STEP = 8;
const LAYUP_SHORT = 0.9;

/** The modifiers for a Big Brained Putt at `zone`. Pure, so the preview and the putt agree. */
export const plannedPuttReasons = (
  player: Player,
  lie: Vec2,
  basket: Vec2,
  zone: BasketZone,
): readonly Reason[] => {
  const distance = distance2(lie, basket);
  const spec = zones[zone];
  if (zone === 'layup') {
    return [
      { source: 'Lay up under the basket', value: spec.base },
      { source: `Distance ${distance.toFixed(1)} m`, value: -Math.round(distance) },
    ];
  }
  return [
    { source: spec.label, value: spec.base },
    { source: 'Big Brained Putt (planned)', value: PLANNED_PUTT_BONUS },
    {
      source: `Putting skill (${golfScoreLabel(player.skills.putting)})`,
      value: -player.skills.putting * SKILL_STEP,
    },
    { source: `Distance ${distance.toFixed(1)} m`, value: -Math.round(Math.max(0, distance - 2) * 7) },
  ];
};

export const plannedPuttChance = (player: Player, lie: Vec2, basket: Vec2, zone: BasketZone): number =>
  chanceFrom(plannedPuttReasons(player, lie, basket, zone), 3, 99);

/**
 * The point on the basket the putt is aimed at. Shared by the putt's flight
 * and the renderer's zone marker, so the marker sits exactly where the disc goes.
 */
export const basketZoneContact = (hole: Hole, lie: Vec2, zone: BasketZone): Vec3 => {
  const basket = hole.basket;
  const ground = elevationAt(hole, basket);
  const toward = normalize2(sub2(basket, lie));
  const right = rightOf(toward);
  const near = (back: number, side = 0): Vec2 =>
    add2(sub2(basket, scale2(toward, back)), scale2(right, side));
  switch (zone) {
    case 'centre-chains':
      return toVec3(near(0.1), ground + 1.11);
    case 'left-chains':
      return toVec3(near(0.12, -0.18), ground + 1.1);
    case 'right-chains':
      return toVec3(near(0.12, 0.18), ground + 1.1);
    case 'band':
      return toVec3(near(d.bandRadius), ground + d.bandHeight);
    case 'pole':
      return toVec3(near(d.poleRadius + 0.012), ground + 1.0);
    case 'layup': {
      const spot = near(LAYUP_SHORT);
      return toVec3(spot, elevationAt(hole, spot) + DISC_REST_HEIGHT);
    }
  }
};

/** The flight a Big Brained Putt aims to fly: from the hand to the zone. */
export const basketZoneLeg = (hole: Hole, lie: Vec2, zone: BasketZone): FlightLeg => ({
  from: toVec3(lie, elevationAt(hole, lie) + RELEASE_HEIGHT),
  to: basketZoneContact(hole, lie, zone),
  apex: (zone === 'layup' ? 0.15 : 0.1) + distance2(lie, hole.basket) * 0.04,
  fade: 0,
  until: 1,
  pace: 'putt',
});

/** Resolves a Big Brained Putt with dice. Every zone has its own outcomes. */
export const resolvePlannedPutt = (
  hole: Hole,
  player: Player,
  lie: Vec2,
  zone: BasketZone,
  rng: Rng,
): PuttResolution => {
  const basket = hole.basket;
  const ground = elevationAt(hole, basket);
  const reasons = plannedPuttReasons(player, lie, basket, zone);
  const chance = chanceFrom(reasons, 3, 99);
  const [roll, r1] = rollD100(rng);
  const success = roll <= chance;
  const near = !success && roll - chance <= zones[zone].nearMiss;
  const [a, r2] = nextRange(r1, 0, 1);
  const [g, r3] = nextGaussian(r2);

  const toward = normalize2(sub2(basket, lie));
  const right = rightOf(toward);
  const distance = distance2(lie, basket);
  const toContact = basketZoneLeg(hole, lie, zone);
  const contact = toContact.to;
  const inTray = toVec3(basket, ground + d.trayBottom + DISC_REST_HEIGHT * 2);
  const drop: FlightLeg = { from: contact, to: inTray, apex: 0, fade: 0, until: 1, pace: 'drop' };

  /** A ground spot `along` metres past the basket (negative = short) and `side` metres right. */
  const spot = (along: number, side: number): Vec2 => {
    const raw = add2(basket, add2(scale2(toward, along), scale2(right, side)));
    // Never rest inside the basket's footprint.
    return distance2(raw, basket) < d.trayRadiusTop + 0.2
      ? add2(basket, scale2(toward, -(d.trayRadiusTop + 0.4)))
      : raw;
  };
  const onGround = (point: Vec2): Vec3 => toVec3(point, elevationAt(hole, point) + DISC_REST_HEIGHT);

  const check = (outcome: string): ThrowEvent => ({
    type: 'check',
    label: `Big Brained Putt: ${zones[zone].label}`,
    chance,
    roll,
    outcome,
    success,
    reasons,
  });
  const holed = (outcome: string, text: string): PuttResolution => ({
    events: [
      check(outcome),
      { type: 'move', leg: toContact },
      { type: 'move', leg: drop },
      { type: 'message', text },
      { type: 'holed' },
    ],
    holed: true,
    lie: basket,
    rng: r3,
  });
  const restsAt = (
    outcome: string,
    text: string,
    legs: readonly FlightLeg[],
    landing: Vec2,
  ): PuttResolution => ({
    events: [
      check(outcome),
      ...legs.map((leg): ThrowEvent => ({ type: 'move', leg })),
      { type: 'message', text },
      { type: 'lie', point: landing },
    ],
    holed: false,
    lie: landing,
    rng: r3,
  });
  const bounceTo = (landing: Vec2, apex = 0.3): FlightLeg => ({
    from: contact,
    to: onGround(landing),
    apex,
    fade: 0,
    until: 1,
    pace: 'bounce',
  });

  switch (zone) {
    case 'layup': {
      // A lay-up never touches the basket: it flies straight to the ground short of it.
      const landing = success
        ? spot(-(LAYUP_SHORT - 0.3 + a * 0.6), g * 0.2)
        : spot(-(1.8 + a * 1.2), g * 0.6);
      const leg: FlightLeg = { ...toContact, to: onGround(landing) };
      return success
        ? restsAt('Laid up', 'Tap-in range. Sensible.', [leg], landing)
        : restsAt('Laid up too short', 'Short and to the side. Not quite a tap-in.', [leg], landing);
    }
    case 'centre-chains':
    case 'left-chains':
    case 'right-chains': {
      if (success) return holed('In the chains', 'Chains! That sound never gets old.');
      const side = zone === 'left-chains' ? -1 : zone === 'right-chains' ? 1 : Math.sign(g) || 1;
      if (zone === 'centre-chains') {
        const landing = near
          ? spot(-(0.8 + a * 1.4), g * 1.2)
          : spot(1 + a * 1.5 + distance * 0.2, g * (1 + distance * 0.1));
        return near
          ? restsAt('Spit out', 'Hit chains and fell out. Brutal.', [toContact, bounceTo(landing)], landing)
          : restsAt(
              'Missed',
              'Not even close to the chains.',
              [{ ...toContact, to: onGround(landing), fade: g * 0.3 }],
              landing,
            );
      }
      // Side chains: a miss glances off the edge and stays on that side.
      const landing = near ? spot(-0.3, side * (0.6 + a * 0.9)) : spot(0.5 + a, side * (1 + a));
      return restsAt(
        near ? 'Spit out' : 'Glanced off the edge',
        near
          ? 'Caught the edge of the chains and dropped out.'
          : 'Clipped the side of the cage. At least it stayed close.',
        [toContact, bounceTo(landing, 0.2)],
        landing,
      );
    }
    case 'band': {
      if (success) return holed('Slid in off the band', 'Off the band and in. Ugly, but it counts.');
      if (near) {
        // Resting on top doesn't count: the lie is marked underneath the basket.
        const onTop = toVec3(basket, ground + d.bandHeight + 0.03);
        const below = spot(-(d.trayRadiusTop + 0.15), 0);
        return restsAt(
          'On top of the basket',
          "On top of the basket. Doesn't count, mark it underneath.",
          [toContact, { from: contact, to: onTop, apex: 0.05, fade: 0, until: 1, pace: 'bounce' }],
          below,
        );
      }
      const landing = spot(1 + a * 2, g);
      return restsAt(
        'Bounced off the band',
        'Clanged off the band and away.',
        [toContact, bounceTo(landing, 0.5)],
        landing,
      );
    }
    case 'pole': {
      if (success) return holed('Pole hole!', 'Pole hole! Everyone saw that.');
      const landing = spot(-(1 + a * 2.5), g * 0.8);
      return restsAt(
        'Bounced off the pole',
        'Pinged off the pole and back at you.',
        [toContact, bounceTo(landing, 0.4)],
        landing,
      );
    }
  }
};
