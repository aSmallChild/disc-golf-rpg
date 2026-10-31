<script lang="ts">
import type { Hole } from '@dgrpg/course-format';
import { mountHoleView } from '@dgrpg/renderer';
import { onMount } from 'svelte';

const { hole }: { hole: Hole } = $props();

// Plain variable, not $state: Three.js objects must never be proxied.
let canvas: HTMLCanvasElement;

onMount(() => mountHoleView(canvas, hole).dispose);
</script>

<canvas bind:this={canvas}></canvas>

<style>
  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
  }
</style>
