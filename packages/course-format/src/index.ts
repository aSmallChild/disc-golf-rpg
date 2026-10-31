/**
 * Course format: the shared contract for hand-built courses, the editor,
 * and any future generator. Plain, serialisable, readonly data only.
 *
 * Placeholder shape. It will be settled during the simulation prototype.
 */

export const COURSE_FORMAT_VERSION = 1;

/** Metres. x/z are ground plane, y is up (matches Three.js). */
export type Vec2 = readonly [x: number, z: number];
export type Vec3 = readonly [x: number, y: number, z: number];

export type Surface =
  | 'fairway'
  | 'rough'
  | 'tall-grass'
  | 'dry-grass'
  | 'rocky'
  | 'water'
  | 'ice'
  | 'mud'
  | 'sand'
  | 'path';

/** Row-major grid of samples. Index = row * columns + column. */
export type Grid<T> = {
  readonly columns: number;
  readonly rows: number;
  /** Metres between samples. */
  readonly cellSize: number;
  readonly values: readonly T[];
};

export type Tree = {
  readonly id: string;
  readonly position: Vec2;
  readonly trunk: { readonly radius: number; readonly height: number };
  readonly canopy: {
    /** Cone (a pine) by default. Round is a broadleaf crown: an ellipsoid between base and top. */
    readonly shape?: 'cone' | 'round';
    readonly radius: number;
    /** Height of the canopy bottom above the ground. */
    readonly base: number;
    /** Height of the canopy top above the ground. */
    readonly top: number;
    /** 0 = sparse, 1 = solid. */
    readonly density: number;
  };
};

/** A hand-drawn, selectable aim region (used by Planned Shots). */
export type Region = {
  readonly id: string;
  readonly label: string;
  /** Closed polygon on the ground plane. */
  readonly polygon: readonly Vec2[];
};

export type Hole = {
  readonly id: string;
  readonly par: number;
  readonly tee: Vec2;
  readonly basket: Vec2;
  readonly elevation: Grid<number>;
  readonly surface: Grid<Surface>;
  readonly trees: readonly Tree[];
  /** Checked in order: the first region containing a point wins. */
  readonly regions: readonly Region[];
};

export type Course = {
  readonly formatVersion: typeof COURSE_FORMAT_VERSION;
  readonly id: string;
  readonly name: string;
  readonly holes: readonly Hole[];
};

/**
 * Approximate dimensions of a standard target, in metres above the ground.
 * Shared by the simulation (contact points) and the renderer (the model).
 */
export const basketDimensions = {
  poleRadius: 0.025,
  poleHeight: 1.5,
  trayBottom: 0.6,
  trayTop: 0.82,
  trayRadiusTop: 0.33,
  trayRadiusBottom: 0.27,
  bandHeight: 1.38,
  bandRadius: 0.3,
  innerRingHeight: 1.34,
  innerRingRadius: 0.16,
  /** Where the chains meet the pole, just above the tray. */
  chainAttachHeight: 0.88,
  chainAttachRadius: 0.04,
  outerChainCount: 18,
  innerChainCount: 10,
  trayBarCount: 24,
} as const;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** Nearest-sample lookup, clamped to the grid edge. */
export const sampleGrid = <T>(grid: Grid<T>, [x, z]: Vec2): T => {
  const column = clamp(Math.round(x / grid.cellSize), 0, grid.columns - 1);
  const row = clamp(Math.round(z / grid.cellSize), 0, grid.rows - 1);
  const value = grid.values[row * grid.columns + column];
  if (value === undefined) throw new Error('Grid has fewer values than columns * rows');
  return value;
};

/** Size of the hole's playable area in metres. */
export const holeSize = (hole: Hole): Vec2 => [
  (hole.elevation.columns - 1) * hole.elevation.cellSize,
  (hole.elevation.rows - 1) * hole.elevation.cellSize,
];

/** Bilinear ground height, so objects sit on the terrain mesh rather than on grid steps. */
export const elevationAt = (hole: Hole, [x, z]: Vec2): number => {
  const { columns, rows, cellSize, values } = hole.elevation;
  const gx = clamp(x / cellSize, 0, columns - 1);
  const gz = clamp(z / cellSize, 0, rows - 1);
  const c0 = Math.min(Math.floor(gx), columns - 2);
  const r0 = Math.min(Math.floor(gz), rows - 2);
  const fx = gx - c0;
  const fz = gz - r0;
  const at = (column: number, row: number) => values[row * columns + column] ?? 0;
  const top = at(c0, r0) * (1 - fx) + at(c0 + 1, r0) * fx;
  const bottom = at(c0, r0 + 1) * (1 - fx) + at(c0 + 1, r0 + 1) * fx;
  return top * (1 - fz) + bottom * fz;
};

/** Even-odd ray casting test. */
export const pointInPolygon = ([x, z]: Vec2, polygon: readonly Vec2[]): boolean =>
  polygon.reduce((inside, [xi, zi], index) => {
    const [xj, zj] = polygon[(index + polygon.length - 1) % polygon.length] ?? [xi, zi];
    const crosses = zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi;
    return crosses ? !inside : inside;
  }, false);

export const regionAt = (hole: Hole, point: Vec2): Region | undefined =>
  hole.regions.find((region) => pointInPolygon(point, region.polygon));

/** Average of the corners: good enough to judge a hand-drawn region's distance. */
export const regionCentre = (region: Region): Vec2 => {
  const count = Math.max(region.polygon.length, 1);
  const [sx, sz] = region.polygon.reduce<Vec2>(([x, z], [px, pz]) => [x + px, z + pz], [0, 0]);
  return [sx / count, sz / count];
};

/** A trunk narrows to this fraction of its base radius at the top. */
export const TRUNK_TOP_RATIO = 0.8;

/**
 * Trunk radius at `height` metres above the tree's ground, or undefined above the trunk.
 * Shared by the simulation (contacts) and the renderer (the model), so a hit
 * on screen is exactly where the simulation put it.
 */
export const trunkRadiusAt = (tree: Tree, height: number): number | undefined =>
  height < 0 || height > tree.trunk.height
    ? undefined
    : tree.trunk.radius * (1 - (1 - TRUNK_TOP_RATIO) * (height / tree.trunk.height));

/**
 * Canopy radius at `height` metres above the tree's ground, or undefined outside it.
 * A cone runs from `base` (full radius) to `top` (a point). A round crown is an
 * ellipsoid, widest halfway between `base` and `top`.
 */
export const canopyRadiusAt = (tree: Tree, height: number): number | undefined => {
  const { base, top, radius, shape = 'cone' } = tree.canopy;
  if (height < base || height > top) return undefined;
  if (shape === 'cone') return (radius * (top - height)) / (top - base);
  const half = (top - base) / 2;
  const offset = (height - (base + half)) / half;
  return radius * Math.sqrt(Math.max(0, 1 - offset * offset));
};

/** Keeps a point inside the playable area, with a margin. */
export const clampToHole = (hole: Hole, [x, z]: Vec2, margin = 1): Vec2 => {
  const [width, depth] = holeSize(hole);
  return [clamp(x, margin, width - margin), clamp(z, margin, depth - margin)];
};
