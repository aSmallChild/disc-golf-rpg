import { COURSE_FORMAT_VERSION, type Course, type Hole, type Tree } from '@dgrpg/course-format';

/** Temporary hand-built hole for the boilerplate. Replaced by files in /courses. */
const columns = 41;
const rows = 81;
const cellSize = 2;

const hill = (column: number, row: number): number => {
  const dx = column - 28;
  const dz = row - 35;
  return 6 * Math.exp(-(dx * dx + dz * dz) / 120);
};

const trees: readonly Tree[] = [
  [30, 70],
  [46, 92],
  [22, 110],
  [54, 54],
  [18, 40],
].map(([x, z], index) => ({
  id: `t${index}`,
  position: [x ?? 0, z ?? 0] as const,
  trunk: { radius: 0.35, height: 4 },
  canopy: { radius: 3, base: 2.5, top: 10, density: 0.6 },
}));

const hole: Hole = {
  id: 'test-1',
  par: 3,
  tee: [40, 150],
  basket: [40, 12],
  elevation: {
    columns,
    rows,
    cellSize,
    values: Array.from({ length: columns * rows }, (_, index) =>
      hill(index % columns, Math.floor(index / columns)),
    ),
  },
  surface: {
    columns,
    rows,
    cellSize,
    values: Array.from({ length: columns * rows }, () => 'fairway' as const),
  },
  trees,
  regions: [],
};

export const testCourse: Course = {
  formatVersion: COURSE_FORMAT_VERSION,
  id: 'test',
  name: 'Test Course',
  holes: [hole],
};
