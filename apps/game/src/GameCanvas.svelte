<script lang="ts">
import type { Hole, Vec2, Vec3 } from '@dgrpg/course-format';
import { type CameraViewName, type HoleView, mountHoleView, type RegionDisplay } from '@dgrpg/renderer';
import type { ThrowEvent } from '@dgrpg/sim';
import { onMount } from 'svelte';

type Screen = { readonly x: number; readonly y: number };

const {
  hole,
  onGroundClick,
  onGroundHover,
}: {
  hole: Hole;
  onGroundClick: (point: Vec2) => void;
  onGroundHover: (point: Vec2 | undefined, screen: Screen) => void;
} = $props();

// Never deep $state: Three.js objects must not be proxied. HoleView is held raw.
let canvas: HTMLCanvasElement;
let view = $state.raw<HoleView | undefined>(undefined);

onMount(() => {
  const mounted = mountHoleView(canvas, hole, {
    onGroundClick: (point) => onGroundClick(point),
    onGroundHover: (point, screen) => onGroundHover(point, screen),
  });
  view = mounted;
  return mounted.dispose;
});

// Thin pass-throughs so the parent can drive the scene via bind:this.
export const showView = (name: CameraViewName, lie?: Vec2) => view?.showView(name, lie);
export const setLie = (lie: Vec2) => view?.setLie(lie);
export const setAim = (lie: Vec2, target: Vec2 | undefined, fade = 0) => view?.setAim(lie, target, fade);
export const setPuttZone = (point: Vec3 | undefined) => view?.setPuttZone(point);
export const showRegions = (display: RegionDisplay) => view?.showRegions(display);
export const play = (events: readonly ThrowEvent[]) => view?.play(events) ?? Promise.resolve();
</script>

<canvas bind:this={canvas}></canvas>

<style>
  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
    touch-action: none;
  }
</style>
