/**
 * Course format: the shared contract for hand-built courses, the editor,
 * and any future generator. Plain, serialisable, readonly data only.
 *
 * Placeholder shape. It will be settled during the simulation prototype.
 */

export const COURSE_FORMAT_VERSION = 1;

/** Metres. x/z are ground plane, y is up (matches Three.js). */
export type Vec2 = readonly [x: number, z: number];

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
    readonly radius: number;
    /** Height of the canopy bottom above the ground. */
    readonly base: number;
    /** Height of the canopy top above the ground. */
    readonly top: number;
    /** 0 = sparse, 1 = solid. */
    readonly density: number;
  };
};

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
  readonly regions: readonly Region[];
};

export type Course = {
  readonly formatVersion: typeof COURSE_FORMAT_VERSION;
  readonly id: string;
  readonly name: string;
  readonly holes: readonly Hole[];
};

/** Nearest-sample lookup, clamped to the grid edge. */
export const sampleGrid = <T>(grid: Grid<T>, [x, z]: Vec2): T => {
  const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max);
  const column = clamp(Math.round(x / grid.cellSize), grid.columns - 1);
  const row = clamp(Math.round(z / grid.cellSize), grid.rows - 1);
  const value = grid.values[row * grid.columns + column];
  if (value === undefined) throw new Error('Grid has fewer values than columns * rows');
  return value;
};
