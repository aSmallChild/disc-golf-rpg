/** Planned Shots are unlocked separately by throw length (`ideas/aimed-shots.md`). */
export type PlannedShotKind = 'putt' | 'upshot' | 'drive';

/**
 * Placeholder character until stats and the skill tree exist.
 * Skills are golf scores: +2 (Double bogey) is bad, -2 (Eagle) is good.
 */
export type Player = {
  readonly name: string;
  readonly skills: {
    readonly driving: number;
    readonly putting: number;
  };
  /** Longest Standard Shot in metres. Will come from the Arm stat later. */
  readonly maxRange: number;
  /** Which Planned Shots are unlocked. Will come from the skill tree later. */
  readonly plannedShots: readonly PlannedShotKind[];
};

/**
 * Clearly bad, but not hopeless (`ideas/skill-scoring.md`).
 * Planned putts and upshots come early so new players get a taste of planning.
 */
export const beginner: Player = {
  name: 'You',
  skills: { driving: 2, putting: 2 },
  maxRange: 110,
  plannedShots: ['putt', 'upshot'],
};
