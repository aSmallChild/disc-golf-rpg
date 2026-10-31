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
};

/** Clearly bad, but not hopeless (`ideas/skill-scoring.md`). */
export const beginner: Player = {
  name: 'You',
  skills: { driving: 2, putting: 2 },
  maxRange: 110,
};
