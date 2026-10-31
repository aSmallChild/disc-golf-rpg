<script lang="ts">
import type { Hole, Vec2 } from '@dgrpg/course-format';
import { type CameraViewName, type HoleView, mountHoleView } from '@dgrpg/renderer';
import type { ThrowEvent } from '@dgrpg/sim';
import { onMount } from 'svelte';

const { hole, onGroundClick }: { hole: Hole; onGroundClick: (point: Vec2) => void } = $props();

// Never deep $state: Three.js objects must not be proxied. HoleView is held raw.
let canvas: HTMLCanvasElement;
let view = $state.raw<HoleView | undefined>(undefined);

onMount(() => {
  const mounted = mountHoleView(canvas, hole, { onGroundClick: (point) => onGroundClick(point) });
  view = mounted;
  return mounted.dispose;
});

// Thin pass-throughs so the parent can drive the scene via bind:this.
export const showView = (name: CameraViewName, lie?: Vec2) => view?.showView(name, lie);
export const setLie = (lie: Vec2) => view?.setLie(lie);
export const setAim = (lie: Vec2, target: Vec2 | undefined) => view?.setAim(lie, target);
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
