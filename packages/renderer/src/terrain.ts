import type { Grid } from '@dgrpg/course-format';
import { BufferAttribute, Mesh, MeshLambertMaterial, PlaneGeometry } from 'three';
import { palette } from './palette.ts';

/** Builds a flat-shaded terrain mesh from an elevation grid. */
export const createTerrainMesh = (elevation: Grid<number>): Mesh => {
  const width = (elevation.columns - 1) * elevation.cellSize;
  const depth = (elevation.rows - 1) * elevation.cellSize;
  const plane = new PlaneGeometry(width, depth, elevation.columns - 1, elevation.rows - 1);
  plane.rotateX(-Math.PI / 2);
  plane.translate(width / 2, 0, depth / 2);

  const positions = plane.getAttribute('position');
  const heighted = Float32Array.from(positions.array as ArrayLike<number>, (value, index) =>
    index % 3 === 1 ? (elevation.values[Math.floor(index / 3)] ?? 0) : value,
  );
  plane.setAttribute('position', new BufferAttribute(heighted, 3));

  // Flat shading: un-index so each face gets its own normal.
  const geometry = plane.toNonIndexed();
  geometry.computeVertexNormals();
  plane.dispose();

  const mesh = new Mesh(geometry, new MeshLambertMaterial({ color: palette.fairway, flatShading: true }));
  mesh.receiveShadow = true;
  return mesh;
};
