import { elevationAt, type Hole, pointInPolygon, type Region, type Vec2 } from '@dgrpg/course-format';
import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
} from 'three';
import { palette } from './palette.ts';

/** How the Planned Shot regions should look right now. */
export type RegionDisplay = {
  readonly visible: boolean;
  readonly hovered: string | undefined;
  readonly selected: string | undefined;
  /** Region ids the player can't plan into from the current lie. */
  readonly locked: readonly string[];
};

/** Fill resolution in metres. Fine enough to follow the terrain, coarse enough to stay cheap. */
const FILL_STEP = 1;
const FILL_LIFT = 0.12;
const OUTLINE_LIFT = 0.2;
const OUTLINE_STEP = 1;

const lifted = (hole: Hole, [x, z]: Vec2, lift: number): readonly number[] => [
  x,
  elevationAt(hole, [x, z]) + lift,
  z,
];

/**
 * Drapes the polygon over the terrain as small squares. A flat triangulation
 * would sink into hills between its corners.
 */
const fillGeometry = (hole: Hole, polygon: readonly Vec2[]): BufferGeometry => {
  const xs = polygon.map(([x]) => x);
  const zs = polygon.map(([, z]) => z);
  const minX = Math.min(...xs);
  const minZ = Math.min(...zs);
  const columns = Math.ceil((Math.max(...xs) - minX) / FILL_STEP);
  const rows = Math.ceil((Math.max(...zs) - minZ) / FILL_STEP);
  const positions = Array.from({ length: columns * rows }, (_, index) => {
    const x0 = minX + (index % columns) * FILL_STEP;
    const z0 = minZ + Math.floor(index / columns) * FILL_STEP;
    if (!pointInPolygon([x0 + FILL_STEP / 2, z0 + FILL_STEP / 2], polygon)) return [];
    const corner = (dx: number, dz: number) => lifted(hole, [x0 + dx, z0 + dz], FILL_LIFT);
    const [a, b, c, d] = [
      corner(0, 0),
      corner(0, FILL_STEP),
      corner(FILL_STEP, FILL_STEP),
      corner(FILL_STEP, 0),
    ];
    return [a, b, c, a, c, d].flat();
  }).flat();
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  return geometry;
};

/** Closed outline, sampled along each edge so it follows the ground. */
const outlineGeometry = (hole: Hole, polygon: readonly Vec2[]): BufferGeometry => {
  const points = polygon.flatMap((start, index) => {
    const end = polygon[(index + 1) % polygon.length] ?? start;
    const steps = Math.max(1, Math.ceil(Math.hypot(end[0] - start[0], end[1] - start[1]) / OUTLINE_STEP));
    return Array.from({ length: steps }, (_, step) => {
      const t = step / steps;
      return lifted(
        hole,
        [start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t],
        OUTLINE_LIFT,
      );
    });
  });
  const closed = [...points, points[0] ?? []].flat();
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(closed, 3));
  return geometry;
};

type RegionMeshes = {
  readonly region: Region;
  readonly fill: Mesh;
  readonly fillMaterial: MeshBasicMaterial;
  readonly outline: Line;
  readonly lineMaterial: LineBasicMaterial;
};

const createRegionMeshes = (hole: Hole, region: Region): RegionMeshes => {
  const fillMaterial = new MeshBasicMaterial({
    color: palette.region,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const fill = new Mesh(fillGeometry(hole, region.polygon), fillMaterial);
  fill.name = `region-fill:${region.id}`;
  const lineMaterial = new LineBasicMaterial({ color: palette.region, transparent: true, opacity: 0.6 });
  const outline = new Line(outlineGeometry(hole, region.polygon), lineMaterial);
  outline.name = `region-outline:${region.id}`;
  return { region, fill, fillMaterial, outline, lineMaterial };
};

const styleFor = (
  id: string,
  display: RegionDisplay,
): { readonly color: number; readonly fill: number; readonly outline: number } => {
  const locked = display.locked.includes(id);
  if (display.selected === id) return { color: palette.regionSelected, fill: 0.32, outline: 1 };
  if (display.hovered === id) {
    return locked
      ? { color: palette.regionLocked, fill: 0.28, outline: 0.9 }
      : { color: palette.regionHover, fill: 0.24, outline: 0.95 };
  }
  return locked
    ? { color: palette.regionLocked, fill: 0.1, outline: 0.45 }
    : { color: palette.region, fill: 0.12, outline: 0.6 };
};

/** All of a hole's aim regions as one group, restyled in place as the display changes. */
export const createRegionLayer = (
  hole: Hole,
): { readonly group: Group; readonly show: (display: RegionDisplay) => void } => {
  const meshes = hole.regions.map((region) => createRegionMeshes(hole, region));
  const group = new Group();
  group.name = 'regions';
  group.visible = false;
  meshes.forEach(({ fill, outline }) => {
    group.add(fill, outline);
  });

  const show = (display: RegionDisplay) => {
    group.visible = display.visible;
    meshes.forEach(({ region, fillMaterial, lineMaterial }) => {
      const style = styleFor(region.id, display);
      fillMaterial.color.setHex(style.color);
      fillMaterial.opacity = style.fill;
      lineMaterial.color.setHex(style.color);
      lineMaterial.opacity = style.outline;
    });
  };

  return { group, show };
};
