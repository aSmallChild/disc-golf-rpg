import { type Grid, sampleGrid, type Tree } from '@dgrpg/course-format';
import { ConeGeometry, CylinderGeometry, Group, Mesh, MeshLambertMaterial } from 'three';
import { palette } from './palette.ts';

/**
 * A tree is two separate volumes so trunk and canopy hits can be
 * choreographed and given different effects.
 */
export const createTreeGroup = (tree: Tree, elevation: Grid<number>): Group => {
  const [x, z] = tree.position;
  const groundY = sampleGrid(elevation, tree.position);

  const trunk = new Mesh(
    new CylinderGeometry(tree.trunk.radius * 0.8, tree.trunk.radius, tree.trunk.height, 7),
    new MeshLambertMaterial({ color: palette.trunk, flatShading: true }),
  );
  trunk.position.set(0, tree.trunk.height / 2, 0);
  trunk.name = 'trunk';

  const canopyHeight = tree.canopy.top - tree.canopy.base;
  const canopy = new Mesh(
    new ConeGeometry(tree.canopy.radius, canopyHeight, 8),
    new MeshLambertMaterial({ color: palette.canopy, flatShading: true }),
  );
  canopy.position.set(0, tree.canopy.base + canopyHeight / 2, 0);
  canopy.name = 'canopy';

  const group = new Group();
  group.add(trunk, canopy);
  group.position.set(x, groundY, z);
  group.name = `tree:${tree.id}`;
  group.traverse((child) => {
    child.castShadow = true;
  });
  return group;
};
