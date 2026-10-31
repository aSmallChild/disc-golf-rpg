/** Planned Shots are unlocked separately by throw length (`ideas/aimed-shots.md`). */
export type PlannedShotKind = 'putt' | 'upshot' | 'drive';

/** Shot shapes for a Planned Shot. Which way they curve depends on the throw type (see `lines.ts`). */
export type ThrowLine = 'straight' | 'hyzer' | 'anhyzer';

/** Players are right-handed for now, so these mean RHBH and RHFH. */
export type ThrowType = 'backhand' | 'forehand';

/** A low-ceiling shot stays under branches, at the cost of distance. */
export type ShotHeight = 'normal' | 'low';

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
  /**
   * Luck, golf-scored like the skills (+2 is bad luck). For now it only sways
   * how trees treat the disc; it will touch everything a little later (`ideas/luck.md`).
   */
  readonly luck: number;
  /** Longest Standard Shot in metres. Will come from the Arm stat later. */
  readonly maxRange: number;
  /** Which Planned Shots are unlocked. Will come from the skill tree later. */
  readonly plannedShots: readonly PlannedShotKind[];
  /** Which lines a Planned Shot can take. Straight is always there. Will come from skill later. */
  readonly lines: readonly ThrowLine[];
  /** Which throw types a Planned Shot can use. Backhand is always there. */
  readonly throwTypes: readonly ThrowType[];
  /** Which heights a Planned Shot can use. Normal is always there. */
  readonly shotHeights: readonly ShotHeight[];
};

/** Clearly bad, but not hopeless (`ideas/skill-scoring.md`). Nothing planned is unlocked yet. */
export const beginner: Player = {
  name: 'You',
  skills: { driving: 2, putting: 2 },
  luck: 2,
  maxRange: 110,
  plannedShots: [],
  lines: ['straight'],
  throwTypes: ['backhand'],
  shotHeights: ['normal'],
};

/**
 * A beginner with every Planned Shot and line unlocked, for play-testing until
 * the skill tree exists. Skills stay at beginner level so the odds stay honest.
 */
export const tester: Player = {
  ...beginner,
  name: 'Tester',
  plannedShots: ['putt', 'upshot', 'drive'],
  lines: ['straight', 'hyzer', 'anhyzer'],
  throwTypes: ['backhand', 'forehand'],
  shotHeights: ['normal', 'low'],
};
