import type { Hole } from '@dgrpg/course-format';

/** Flat 60 m × 160 m test hole for unit tests. Not exported from the package. */
export const flatHole = (): Hole => {
  const columns = 31;
  const rows = 81;
  const cellSize = 2;
  return {
    id: 'flat',
    par: 3,
    tee: [30, 150],
    basket: [30, 20],
    elevation: { columns, rows, cellSize, values: Array.from({ length: columns * rows }, () => 0) },
    surface: {
      columns,
      rows,
      cellSize,
      values: Array.from({ length: columns * rows }, () => 'fairway' as const),
    },
    trees: [],
    regions: [],
  };
};
