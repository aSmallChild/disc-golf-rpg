import type { Vec2 } from '@dgrpg/course-format';
import type { FlightLeg } from './flight.ts';

/** One modifier in a roll, for the feedback breakdown. Values are percentage points. */
export type Reason = {
  readonly source: string;
  readonly value: number;
};

/**
 * What happened during one action, in order. Plain serialisable data:
 * the UI reads the checks and messages, the renderer plays the moves.
 */
export type ThrowEvent =
  | {
      readonly type: 'check';
      readonly label: string;
      readonly chance: number;
      readonly roll: number;
      readonly outcome: string;
      readonly success: boolean;
      readonly reasons: readonly Reason[];
    }
  | { readonly type: 'move'; readonly leg: FlightLeg }
  | { readonly type: 'message'; readonly text: string }
  | { readonly type: 'out-of-bounds'; readonly replayFrom: Vec2 }
  | { readonly type: 'holed' }
  | { readonly type: 'lie'; readonly point: Vec2 };

/** Sum of reasons, clamped to a playable range. */
export const chanceFrom = (reasons: readonly Reason[], min: number, max: number): number =>
  Math.round(
    Math.min(
      Math.max(
        reasons.reduce((sum, reason) => sum + reason.value, 0),
        min,
      ),
      max,
    ),
  );
