<script lang="ts">
import { createRng, rollD100 } from '@dgrpg/sim';
import { fade } from 'svelte/transition';
import GameCanvas from './GameCanvas.svelte';
import { testCourse } from './test-hole.ts';

const hole = testCourse.holes[0];

let rng = $state.raw(createRng(Date.now()));
let lastRoll = $state<number | undefined>(undefined);

const roll = () => {
  const [value, next] = rollD100(rng);
  lastRoll = value;
  rng = next;
};
</script>

{#if hole}
  <GameCanvas {hole} />
{/if}

<aside class="panel">
  <h1>{testCourse.name}</h1>
  <p>Hole {hole?.id} · Par {hole?.par}</p>
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

  .roll {
    color: var(--ui-text);
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
</style>
