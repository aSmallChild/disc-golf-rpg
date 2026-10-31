/**
 * Skills use disc golf scoring: above par (positive) is bad, below par is good.
 * New players start above par (`ideas/skill-scoring.md`).
 */
export type GolfScore = -3 | -2 | -1 | 0 | 1 | 2 | 3;

export const GOLF_SCORES: readonly GolfScore[] = [3, 2, 1, 0, -1, -2, -3];

const labels: Record<GolfScore, string> = {
  3: 'Triple bogey',
  2: 'Double bogey',
  1: 'Bogey',
  0: 'Par',
  [-1]: 'Birdie',
  [-2]: 'Eagle',
  [-3]: 'Albatross',
};

export const golfScoreLabel = (score: number): string => {
  const clamped = Math.max(-3, Math.min(3, Math.round(score))) as GolfScore;
  return labels[clamped];
};

/** "+2", "E" (even), "-1". */
export const formatScore = (score: number): string =>
  score === 0 ? 'E' : score > 0 ? `+${score}` : `${score}`;

/** Label for a hole result relative to par, e.g. 4 strokes on a par 3 is "Bogey". */
export const holeResultLabel = (strokes: number, par: number): string =>
  strokes === 1 ? 'Ace' : golfScoreLabel(strokes - par);
