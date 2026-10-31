import { type Hole, sampleGrid } from '@dgrpg/course-format';
import { BoxGeometry, Mesh, MeshLambertMaterial } from 'three';
import { palette } from './palette.ts';

const TEE_WIDTH = 1.5;
const TEE_LENGTH = 3.5;
const TEE_THICKNESS = 0.12;

/** A concrete tee pad, its long side pointing at the basket. */
export const createTeePad = (hole: Hole): Mesh => {
  const [tx, tz] = hole.tee;
  const [bx, bz] = hole.basket;
  const pad = new Mesh(
    new BoxGeometry(TEE_WIDTH, TEE_THICKNESS, TEE_LENGTH),
    new MeshLambertMaterial({ color: palette.tee, flatShading: true }),
  );
  pad.position.set(tx, sampleGrid(hole.elevation, hole.tee) + TEE_THICKNESS / 2 - 0.04, tz);
  pad.rotation.y = Math.atan2(bx - tx, bz - tz);
  pad.receiveShadow = true;
  pad.castShadow = true;
  pad.name = 'tee';
  return pad;
};
