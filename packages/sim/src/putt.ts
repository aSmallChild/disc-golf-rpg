import { basketDimensions, elevationAt, type Hole, type Vec2 } from '@dgrpg/course-format';
import { chanceFrom, type Reason, type ThrowEvent } from './events.ts';
import type { FlightLeg } from './flight.ts';
import { add2, distance2, normalize2, rightOf, scale2, sub2, toVec3 } from './geometry.ts';
import type { Player } from './player.ts';
import { nextGaussian, nextRange, type Rng, rollD100 } from './rng.ts';
import { golfScoreLabel } from './scoring.ts';
import { DISC_REST_HEIGHT, RELEASE_HEIGHT } from './throw.ts';

/** Circle 1: inside this distance a Standard Shot becomes a putt at the basket. */
export const PUTT_RANGE = 10;
export const TAP_IN_RANGE = 1.5;
const SKILL_STEP = 8;

export type PuttResolution = {
  readonly events: readonly ThrowEvent[];
  readonly holed: boolean;
  readonly lie: Vec2;
  readonly rng: Rng;
};

export const puttReasons = (player: Player, lie: Vec2, basket: Vec2): readonly Reason[] => {
  const distance = distance2(lie, basket);
  if (distance <= TAP_IN_RANGE) return [{ source: 'Tap-in', value: 99 }];
  return [
    { source: 'Standard putt', value: 92 },
    {
      source: `Putting skill (${golfScoreLabel(player.skills.putting)})`,
      value: -player.skills.putting * SKILL_STEP,
    },
    { source: `Distance ${distance.toFixed(1)} m`, value: -Math.round(Math.max(0, distance - 2) * 7) },
  ];
};

export const puttChance = (player: Player, lie: Vec2, basket: Vec2): number =>
  chanceFrom(puttReasons(player, lie, basket), 3, 99);

/** Resolves a putt at the centre of the chains. */
export const resolvePutt = (hole: Hole, player: Player, lie: Vec2, rng: Rng): PuttResolution => {
  const basket = hole.basket;
  const reasons = puttReasons(player, lie, basket);
  const chance = chanceFrom(reasons, 3, 99);
  const [roll, r1] = rollD100(rng);
  const success = roll <= chance;
  const ground = elevationAt(hole, basket);
  const direction = normalize2(sub2(basket, lie));
  const distance = distance2(lie, basket);
  const release = toVec3(lie, elevationAt(hole, lie) + RELEASE_HEIGHT);

  // Aim point on the near side of the chains, at chain height.
  const chainsPoint = toVec3(
    sub2(basket, scale2(direction, basketDimensions.innerRingRadius * 0.6)),
    ground + (basketDimensions.chainAttachHeight + basketDimensions.innerRingHeight) / 2,
  );
  const toChains: FlightLeg = {
    from: release,
    to: chainsPoint,
    apex: 0.1 + distance * 0.04,
    fade: 0,
    until: 1,
    pace: 'putt',
  };

  const check = (outcome: string): ThrowEvent => ({
    type: 'check',
    label: 'Putt',
    chance,
    roll,
    outcome,
    success,
    reasons,
  });

  if (success) {
    const inTray = toVec3(basket, ground + basketDimensions.trayBottom + DISC_REST_HEIGHT * 2);
    return {
      events: [
        check('In the chains'),
        { type: 'move', leg: toChains },
        { type: 'move', leg: { from: chainsPoint, to: inTray, apex: 0, fade: 0, until: 1, pace: 'drop' } },
        { type: 'message', text: 'Chains! That sound never gets old.' },
        { type: 'holed' },
      ],
      holed: true,
      lie: basket,
      rng: r1,
    };
  }

  // Near misses spit out of the chains; bad misses never reach them.
  const spitOut = roll - chance <= 15;
  const [g1, r2] = nextGaussian(r1);
  const [g2, r3] = nextGaussian(r2);
  const [bounce, r4] = nextRange(r3, 0.8, 2.2);
  const missBy = spitOut ? bounce : bounce + distance * 0.2;
  const rawLanding = add2(
    basket,
    add2(
      scale2(direction, (spitOut ? -1 : 1) * missBy * (0.5 + Math.abs(g1) * 0.5)),
      scale2(rightOf(direction), g2 * missBy),
    ),
  );
  // Never rest inside the basket footprint.
  const landing =
    distance2(rawLanding, basket) < basketDimensions.trayRadiusTop + 0.2
      ? add2(basket, scale2(direction, -(basketDimensions.trayRadiusTop + 0.4)))
      : rawLanding;
  const landed = toVec3(landing, elevationAt(hole, landing) + DISC_REST_HEIGHT);

  const legs: readonly FlightLeg[] = spitOut
    ? [toChains, { from: chainsPoint, to: landed, apex: 0.3, fade: 0, until: 1, pace: 'bounce' }]
    : [{ from: release, to: landed, apex: 0.2 + distance * 0.05, fade: g2 * 0.3, until: 1, pace: 'putt' }];

  return {
    events: [
      check(spitOut ? 'Spit out' : 'Missed'),
      ...legs.map((leg): ThrowEvent => ({ type: 'move', leg })),
      {
        type: 'message',
        text: spitOut ? 'Hit chains and fell out. Brutal.' : 'Not even close to the chains.',
      },
      { type: 'lie', point: landing },
    ],
    holed: false,
    lie: landing,
    rng: r4,
  };
};
