import { elevationAt, type Hole, TRUNK_TOP_RATIO, type Tree } from '@dgrpg/course-format';
import {
  type BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshLambertMaterial,
} from 'three';
import { palette } from './palette.ts';

/** Centred on the origin, spanning the canopy's height. */
const canopyGeometry = (tree: Tree): BufferGeometry => {
  const height = tree.canopy.top - tree.canopy.base;
  if ((tree.canopy.shape ?? 'cone') === 'cone') return new ConeGeometry(tree.canopy.radius, height, 8);
  // A chunky low-poly blob, stretched to the crown's ellipsoid.
  const crown = new IcosahedronGeometry(1, 1);
  crown.scale(tree.canopy.radius, height / 2, tree.canopy.radius);
  return crown;
};

/**
 * A tree is two separate volumes so trunk and canopy hits can be
 * choreographed and given different effects. The shapes match
 * `trunkRadiusAt` / `canopyRadiusAt`, which the simulation uses for contacts.
 */
export const createTreeGroup = (tree: Tree, hole: Hole): Group => {
  const [x, z] = tree.position;
  // Same ground height as the simulation, so contact points line up with the mesh.
  const groundY = elevationAt(hole, tree.position);

  const trunk = new Mesh(
    new CylinderGeometry(tree.trunk.radius * TRUNK_TOP_RATIO, tree.trunk.radius, tree.trunk.height, 7),
    new MeshLambertMaterial({ color: palette.trunk, flatShading: true }),
  );
  trunk.position.set(0, tree.trunk.height / 2, 0);
  trunk.name = 'trunk';

  const canopyHeight = tree.canopy.top - tree.canopy.base;
  const canopy = new Mesh(
    canopyGeometry(tree),
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
