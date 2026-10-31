import {
  elevationAt,
  type Hole,
  holeSize,
  pointInPolygon,
  type Region,
  type Vec2,
} from '@dgrpg/course-format';
import { chanceFrom, type Reason, type ThrowEvent } from './events.ts';
import type { FlightLeg } from './flight.ts';
import { add2, clamp, distance2, normalize2, rightOf, scale2, sub2, toVec3 } from './geometry.ts';
import {
  BAD_RELEASE_CURVE,
  curveDirection,
  lineBulge,
  lineLabels,
  lineReasons,
  throwTypeLabels,
} from './lines.ts';
import type { Player, ThrowLine, ThrowType } from './player.ts';
import { nextGaussian, nextRange, nextSign, type Rng, rollD100 } from './rng.ts';
import { golfScoreLabel } from './scoring.ts';

/** Height of the disc at release, above the ground. */
export const RELEASE_HEIGHT = 1.1;
/** Resting height of a disc on the ground (half its thickness). */
export const DISC_REST_HEIGHT = 0.012;

const SKILL_STEP = 8;

export type Release = 'clean' | 'wobbly' | 'shank';

/** How the throw was chosen. A Planned Shot names its region, line, and throw type. */
export type ThrowStyle =
  | { readonly kind: 'standard' }
  | {
      readonly kind: 'planned';
      readonly region: Region;
      readonly line: ThrowLine;
      readonly throwType: ThrowType;
    };

const standard: ThrowStyle = { kind: 'standard' };

/** A Planned Shot's scatter is this fraction of a Standard Shot's. */
const PLANNED_SCATTER = 0.6;

export type ThrowResolution = {
  readonly events: readonly ThrowEvent[];
  /** Where the disc ends up, or undefined if it went out of bounds. */
  readonly lie: Vec2 | undefined;
  readonly rng: Rng;
};

const releaseLabels: Record<Release, string> = {
  clean: 'Clean release',
  wobbly: 'Wobbly release',
  shank: 'Shanked it',
};

/** The modifiers for a throw. Pure, so the UI preview and the throw always agree. */
export const throwReasons = (
  player: Player,
  lie: Vec2,
  target: Vec2,
  style: ThrowStyle = standard,
): readonly Reason[] => {
  const requested = distance2(lie, target);
  const distance = Math.min(requested, player.maxRange);
  return [
    style.kind === 'planned'
      ? { source: 'Big Brained Shot (planned the line)', value: 80 }
      : { source: 'Standard Shot', value: 70 },
    {
      source: `Driving skill (${golfScoreLabel(player.skills.driving)})`,
      value: -player.skills.driving * SKILL_STEP,
    },
    {
      source: `Distance ${Math.round(distance)} m of ${player.maxRange} m range`,
      value: -Math.round((distance / player.maxRange) * 20),
    },
    ...(requested > player.maxRange ? [{ source: 'Aimed beyond your range', value: -10 }] : []),
    ...(style.kind === 'planned' ? lineReasons[style.line] : []),
  ];
};

export const throwChance = (player: Player, lie: Vec2, target: Vec2, style: ThrowStyle = standard): number =>
  chanceFrom(throwReasons(player, lie, target, style), 5, 95);

/** Clean if the roll is under the chance, wobbly in the next band, otherwise a shank. */
export const releaseFor = (roll: number, chance: number): Release =>
  roll <= chance ? 'clean' : roll <= chance + (100 - chance) / 2 ? 'wobbly' : 'shank';

const inBounds = (hole: Hole, [x, z]: Vec2): boolean => {
  const [width, depth] = holeSize(hole);
  return x >= 0 && z >= 0 && x <= width && z <= depth;
};

/** Ground-plane offsets [along, across] as fractions of the throw distance. */
const scatterFor = (release: Release, rng: Rng): readonly [along: number, across: number, rng: Rng] => {
  const [g1, r1] = nextGaussian(rng);
  const [g2, r2] = nextGaussian(r1);
  switch (release) {
    case 'clean':
      return [g1 * 0.05, g2 * 0.05, r2];
    case 'wobbly':
      return [g1 * 0.1 - 0.06, g2 * 0.15, r2];
    case 'shank': {
      const [short, r3] = nextRange(r2, 0.3, 0.65);
      return [-short + g1 * 0.05, g2 * 0.25, r3];
    }
  }
};

/**
 * Sideways bulge as a fraction of the flown distance (+ = right). A Standard
 * Shot's fade goes either way; a Planned Shot follows its chosen line.
 */
const fadeFor = (style: ThrowStyle, rng: Rng): readonly [fade: number, rng: Rng] => {
  if (style.kind === 'standard' || style.line === 'straight') {
    const [sign, r1] = nextSign(rng);
    const [amount, r2] = style.kind === 'planned' ? nextRange(r1, 0.01, 0.04) : nextRange(r1, 0.03, 0.1);
    return [sign * amount, r2];
  }
  const [k, r1] = nextRange(rng, 0.8, 1.2);
  return [lineBulge(style.line, style.throwType) * k, r1];
};

const shankMessages = [
  'It barely left the tee box.',
  'That one is going to haunt you.',
  'A scream of a release, in the wrong direction.',
] as const;

/**
 * Resolves a Standard or Planned Shot from `lie` toward `target` with dice.
 * The flight legs describe exactly what the renderer will show.
 */
export const resolveThrow = (
  hole: Hole,
  player: Player,
  lie: Vec2,
  target: Vec2,
  rng: Rng,
  style: ThrowStyle = standard,
): ThrowResolution => {
  const reasons = throwReasons(player, lie, target, style);
  const chance = chanceFrom(reasons, 5, 95);
  const [roll, r1] = rollD100(rng);
  const release = releaseFor(roll, chance);

  const direction = normalize2(sub2(target, lie));
  const distance = Math.min(distance2(lie, target), player.maxRange);
  const [rawAlong, rawAcross, r2] = scatterFor(release, r1);
  // Planning narrows the spread, but a shank still falls short.
  const tighten = style.kind === 'planned' ? PLANNED_SCATTER : 1;
  const along = release === 'shank' ? rawAlong : rawAlong * tighten;
  const curve = style.kind === 'planned' ? curveDirection(style.line, style.throwType) : 0;
  const overCurve = release === 'clean' ? 0 : curve * BAD_RELEASE_CURVE;
  const across = rawAcross * tighten + overCurve;
  const landing = add2(
    lie,
    add2(scale2(direction, distance * (1 + along)), scale2(rightOf(direction), distance * across)),
  );

  const [fade, r4] = fadeFor(style, r2);
  const flown = distance2(lie, landing);
  const flight: FlightLeg = {
    from: toVec3(lie, elevationAt(hole, lie) + RELEASE_HEIGHT),
    to: toVec3(landing, elevationAt(hole, landing) + DISC_REST_HEIGHT),
    apex: 2 + flown * (release === 'shank' ? 0.05 : 0.12),
    fade: fade * flown,
    until: 1,
    pace: 'throw',
  };

  const [shankPick, r5] = nextRange(r4, 0, shankMessages.length);
  const check: ThrowEvent = {
    type: 'check',
    label:
      style.kind === 'planned'
        ? `${throwTypeLabels[style.throwType]} ${lineLabels[style.line].toLowerCase()} release into ${style.region.label}`
        : 'Release',
    chance,
    roll,
    outcome: releaseLabels[release],
    success: release === 'clean',
    reasons,
  };
  const messages: readonly ThrowEvent[] =
    release === 'shank'
      ? [{ type: 'message', text: shankMessages[Math.floor(shankPick)] ?? shankMessages[0] }]
      : [];

  if (!inBounds(hole, landing)) {
    return {
      events: [
        check,
        ...messages,
        { type: 'move', leg: flight },
        { type: 'message', text: 'Out of bounds. Penalty stroke, replay from your last lie.' },
        { type: 'out-of-bounds', replayFrom: lie },
      ],
      lie: undefined,
      rng: r5,
    };
  }

  // Roll out after landing: longer downhill, shorter uphill.
  const ahead = add2(landing, scale2(direction, 3));
  const slope = (elevationAt(hole, landing) - elevationAt(hole, ahead)) / 3;
  const [baseRoll, r6] = nextRange(r5, 1, 6);
  const rollDistance = clamp(baseRoll + slope * 25, 0, 20);
  const rawEnd = add2(landing, scale2(direction, rollDistance));
  const rollEnd: Vec2 = inBounds(hole, rawEnd) ? rawEnd : landing;
  const rollLeg: FlightLeg = {
    from: flight.to,
    to: toVec3(rollEnd, elevationAt(hole, rollEnd) + DISC_REST_HEIGHT),
    apex: 0.15,
    fade: 0,
    until: 1,
    pace: 'bounce',
  };

  const regionResult: readonly ThrowEvent[] =
    style.kind === 'planned'
      ? [
          {
            type: 'message',
            text: pointInPolygon(rollEnd, style.region.polygon)
              ? `Landed in ${style.region.label}. Big brain.`
              : `Missed ${style.region.label}. So much for the plan.`,
          },
        ]
      : [];

  return {
    events: [
      check,
      ...messages,
      { type: 'move', leg: flight },
      ...(rollDistance > 0.3 ? [{ type: 'move', leg: rollLeg } as const] : []),
      ...regionResult,
      { type: 'lie', point: rollEnd },
    ],
    lie: rollEnd,
    rng: r6,
  };
};
