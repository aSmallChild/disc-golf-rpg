import type { Grid } from '@dgrpg/course-format';
import { BufferAttribute, type BufferGeometry, Mesh, MeshLambertMaterial, PlaneGeometry } from 'three';
import { palette } from './palette.ts';

/**
 * Lighting treats hills as this many times steeper than they are. Real fairway
 * slopes are gentle, so honest normals light every face almost the same and the
 * hills vanish. The mesh keeps its true shape; only the shading is exaggerated.
 */
const SHADE_EXAGGERATION = 4;

/** Flat, un-indexed terrain with heights scaled by `heightScale`. */
const terrainGeometry = (elevation: Grid<number>, heightScale: number): BufferGeometry => {
  const width = (elevation.columns - 1) * elevation.cellSize;
  const depth = (elevation.rows - 1) * elevation.cellSize;
  const plane = new PlaneGeometry(width, depth, elevation.columns - 1, elevation.rows - 1);
  plane.rotateX(-Math.PI / 2);
  plane.translate(width / 2, 0, depth / 2);

  const positions = plane.getAttribute('position');
  const heighted = Float32Array.from(positions.array as ArrayLike<number>, (value, index) =>
    index % 3 === 1 ? (elevation.values[Math.floor(index / 3)] ?? 0) * heightScale : value,
  );
  plane.setAttribute('position', new BufferAttribute(heighted, 3));

  // Un-indexed, so each face gets its own normal: the low-poly faceted look.
  const geometry = plane.toNonIndexed();
  geometry.computeVertexNormals();
  plane.dispose();
  return geometry;
};

/** Builds a faceted terrain mesh from an elevation grid. */
export const createTerrainMesh = (elevation: Grid<number>): Mesh => {
  const geometry = terrainGeometry(elevation, 1);
  const shading = terrainGeometry(elevation, SHADE_EXAGGERATION);
  const normals = shading.getAttribute('normal');
  geometry.setAttribute(
    'normal',
    new BufferAttribute(Float32Array.from(normals.array as ArrayLike<number>), 3),
  );
  shading.dispose();

  // Not flatShading: that derives normals from the real geometry and would undo the exaggeration.
  const mesh = new Mesh(geometry, new MeshLambertMaterial({ color: palette.fairway }));
  mesh.receiveShadow = true;
  return mesh;
};
