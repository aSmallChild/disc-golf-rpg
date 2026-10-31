<script lang="ts">
import type { Hole } from '@dgrpg/course-format';
import { type CameraViewName, type HoleView, mountHoleView } from '@dgrpg/renderer';
import { onMount } from 'svelte';

const { hole, cameraView }: { hole: Hole; cameraView: CameraViewName } = $props();

// Never deep $state: Three.js objects must not be proxied. HoleView is held raw.
let canvas: HTMLCanvasElement;
let view = $state.raw<HoleView | undefined>(undefined);

onMount(() => {
  const mounted = mountHoleView(canvas, hole);
  view = mounted;
  return mounted.dispose;
});

$effect(() => {
  view?.showView(cameraView);
});
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
