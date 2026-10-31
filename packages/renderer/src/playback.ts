import { type FlightLeg, flightPoint, legLength, type ThrowEvent } from '@dgrpg/sim';

/** Metres per second for each kind of movement. */
const speeds: Record<FlightLeg['pace'], number> = {
  throw: 26,
  putt: 7,
  glance: 12,
  bounce: 5,
  drop: 2.5,
};

const MIN_LEG_SECONDS = 0.18;

export type TimedLeg = {
  readonly leg: FlightLeg;
  readonly startsAt: number;
  readonly seconds: number;
};

export type Timeline = {
  readonly legs: readonly TimedLeg[];
  readonly seconds: number;
};

/** Pure: lays the event's moves end to end in time. */
export const timeline = (events: readonly ThrowEvent[]): Timeline =>
  events
    .flatMap((event) => (event.type === 'move' ? [event.leg] : []))
    .reduce<Timeline>(
      (acc, leg) => {
        const seconds = Math.max(legLength(leg) / speeds[leg.pace], MIN_LEG_SECONDS);
        return {
          legs: acc.legs.concat({ leg, startsAt: acc.seconds, seconds }),
          seconds: acc.seconds + seconds,
        };
      },
      { legs: [], seconds: 0 },
    );

const easeFor = (pace: FlightLeg['pace']) => (t: number) => {
  switch (pace) {
    case 'throw':
      return 1 - (1 - t) ** 1.6; // Fast off the hand, slowing as it glides.
    case 'putt':
      return 1 - (1 - t) ** 1.3;
    case 'glance':
    case 'bounce':
      return 1 - (1 - t) ** 2; // Skids to a stop.
    case 'drop':
      return t * t; // Falls.
  }
};

/** Pure: where the disc is at `elapsed` seconds into the timeline. */
export const positionAt = (
  plan: Timeline,
  elapsed: number,
): readonly [number, number, number] | undefined => {
  const current = plan.legs.find(({ startsAt, seconds }) => elapsed < startsAt + seconds) ?? plan.legs.at(-1);
  if (!current) return undefined;
  const t = Math.min(Math.max((elapsed - current.startsAt) / current.seconds, 0), 1);
  return flightPoint(current.leg, easeFor(current.leg.pace)(t));
};
