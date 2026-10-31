import {
  COURSE_FORMAT_VERSION,
  type Course,
  type Hole,
  type Region,
  type Tree,
  type Vec2,
} from '@dgrpg/course-format';

/** Temporary hand-built hole for the boilerplate. Replaced by files in /courses. */
const columns = 41;
const rows = 81;
const cellSize = 2;

const hill = (column: number, row: number): number => {
  const dx = column - 28;
  const dz = row - 35;
  return 6 * Math.exp(-(dx * dx + dz * dz) / 120);
};

/** Tall, narrow conifer: branches almost to the ground, so there's no getting under it. */
const pine = (id: string, position: Vec2): Tree => ({
  id,
  position,
  trunk: { radius: 0.3, height: 6 },
  canopy: { shape: 'cone', radius: 3.5, base: 1.5, top: 17, density: 0.75 },
});

/** Broad, open crown with a clear trunk under it: a low-ceiling shot can sneak beneath. */
const oak = (id: string, position: Vec2): Tree => ({
  id,
  position,
  trunk: { radius: 0.45, height: 6 },
  canopy: { shape: 'round', radius: 6.5, base: 3.2, top: 13, density: 0.5 },
});

const trees: readonly Tree[] = [
  pine('pine-1', [30, 70]),
  oak('oak-1', [46, 92]),
  pine('pine-2', [22, 110]),
  oak('oak-2', [54, 54]),
  pine('pine-3', [18, 40]),
  oak('oak-3', [32, 132]),
  pine('pine-4', [62, 128]),
];

/** Hand-drawn rings are octagons: enough to read as round, still easy to edit by hand. */
const octagon = ([cx, cz]: Vec2, radius: number): readonly Vec2[] =>
  Array.from({ length: 8 }, (_, index) => {
    const angle = (index * Math.PI) / 4 + Math.PI / 8;
    return [cx + Math.cos(angle) * radius, cz + Math.sin(angle) * radius] as const;
  });

/** Checked in order, so the small regions come before the ones they overlap. */
const regions: readonly Region[] = [
  { id: 'circle-1', label: 'Circle 1', polygon: octagon([40, 12], 10) },
  { id: 'hill', label: 'Top of the hill', polygon: octagon([56, 70], 9) },
  {
    id: 'short',
    label: 'Short of the basket',
    polygon: [
      [26, 24],
      [54, 24],
      [56, 44],
      [24, 44],
    ],
  },
  {
    id: 'left',
    label: 'Left of the pines',
    polygon: [
      [4, 46],
      [15, 46],
      [17, 100],
      [6, 100],
    ],
  },
  {
    id: 'centre',
    label: 'Fairway centre',
    polygon: [
      [28, 48],
      [47, 48],
      [45, 100],
      [32, 100],
    ],
  },
  {
    id: 'layup',
    label: 'Lay-up short',
    polygon: [
      [28, 106],
      [52, 106],
      [52, 126],
      [28, 126],
    ],
  },
];

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
  regions,
};

export const testCourse: Course = {
  formatVersion: COURSE_FORMAT_VERSION,
  id: 'test',
  name: 'Test Course',
  holes: [hole],
};
