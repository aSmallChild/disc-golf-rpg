<script lang="ts">
import type { CameraViewName } from '@dgrpg/renderer';
import { createRng, rollD100 } from '@dgrpg/sim';
import { fade } from 'svelte/transition';
import GameCanvas from './GameCanvas.svelte';
import { testCourse } from './test-hole.ts';

const hole = testCourse.holes[0];

const views: readonly { readonly name: CameraViewName; readonly label: string }[] = [
  { name: 'overview', label: 'Overview' },
  { name: 'tee', label: 'Tee' },
  { name: 'basket', label: 'Basket' },
];

let cameraView = $state<CameraViewName>('overview');
let rng = $state.raw(createRng(Date.now()));
let lastRoll = $state<number | undefined>(undefined);

const roll = () => {
  const [value, next] = rollD100(rng);
  lastRoll = value;
  rng = next;
};
</script>

{#if hole}
  <GameCanvas {hole} {cameraView} />
{/if}

<aside class="panel">
  <h1>{testCourse.name}</h1>
  <p>Hole {hole?.id} · Par {hole?.par}</p>

  <div class="views" role="group" aria-label="Camera view">
    {#each views as view (view.name)}
      <button type="button" aria-pressed={cameraView === view.name} onclick={() => (cameraView = view.name)}>
        {view.label}
      </button>
    {/each}
  </div>
  <p class="hint">Drag to orbit · right-drag to pan · scroll to zoom</p>

  <button type="button" onclick={roll}>Roll d100</button>
  {#key lastRoll}
    {#if lastRoll !== undefined}
      <p class="roll" in:fade={{ duration: 200 }}>Rolled {lastRoll}</p>
    {/if}
  {/key}
</aside>

<style>
  .panel {
    position: absolute;
    top: 1rem;
    left: 1rem;
    padding: 0.75rem 1rem;
    background: var(--ui-bg);
    border: 1px solid var(--ui-border);
    border-radius: 4px;
    min-width: 12rem;
  }

  h1 {
    margin: 0 0 0.25rem;
    font-size: 1.1rem;
  }

  p {
    margin: 0.25rem 0;
    color: var(--ui-muted);
  }

  .hint {
    font-size: 0.8rem;
  }

  .roll {
    color: var(--ui-text);
  }

  .views {
    display: flex;
    gap: 0.25rem;
    margin-top: 0.5rem;
  }

  button {
    margin-top: 0.5rem;
    font: inherit;
    color: var(--ui-text);
    background: transparent;
    border: 1px solid var(--ui-border);
    padding: 0.25rem 0.75rem;
    cursor: pointer;
  }

  .views button {
    margin-top: 0;
  }

  button[aria-pressed='true'] {
    background: var(--ui-border);
  }
</style>
