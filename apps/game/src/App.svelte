<script lang="ts">
import type { Vec2 } from '@dgrpg/course-format';
import type { CameraViewName } from '@dgrpg/renderer';
import {
  apply,
  beginner,
  createRound,
  distanceToBasket,
  holeResultLabel,
  previewChance,
  shotKind,
  type ThrowEvent,
} from '@dgrpg/sim';
import { fade, fly } from 'svelte/transition';
import GameCanvas from './GameCanvas.svelte';
import { testCourse } from './test-hole.ts';

const hole = testCourse.holes[0];
if (!hole) throw new Error('Test course has no holes');

const views: readonly { readonly name: CameraViewName; readonly label: string }[] = [
  { name: 'overview', label: 'Overview' },
  { name: 'lie', label: 'Disc' },
  { name: 'basket', label: 'Basket' },
];

let canvas: GameCanvas | undefined = $state();
let round = $state.raw(createRound(hole, beginner, Date.now() >>> 0));
let target = $state.raw<Vec2 | undefined>(undefined);
let lastEvents = $state.raw<readonly ThrowEvent[]>([]);
let throwing = $state(false);

const kind = $derived(shotKind(round));
const aimPoint = $derived(kind === 'putt' ? hole.basket : target);
const chance = $derived(aimPoint ? previewChance(round, aimPoint) : undefined);
const check = $derived(lastEvents.find((event) => event.type === 'check'));
const messages = $derived(lastEvents.flatMap((event) => (event.type === 'message' ? [event.text] : [])));
const canThrow = $derived(round.status === 'playing' && !throwing && aimPoint !== undefined);

const showAim = () => canvas?.setAim(round.lie, round.status === 'playing' ? aimPoint : undefined);

// Keep the aim marker in sync with the target and the lie.
$effect(() => {
  if (!throwing) showAim();
});

const onGroundClick = (point: Vec2) => {
  if (throwing || round.status !== 'playing' || kind === 'putt') return;
  target = point;
};

const doThrow = async () => {
  if (!canThrow || !aimPoint) return;
  const result = apply(round, { type: 'standard-shot', target: aimPoint });
  throwing = true;
  lastEvents = [];
  canvas?.setAim(round.lie, undefined);
  await canvas?.play(result.events);
  round = result.state;
  lastEvents = result.events;
  target = undefined;
  throwing = false;
  // A holed disc stays where the putt left it: in the tray.
  if (round.status !== 'holed') canvas?.setLie(round.lie);
  canvas?.showView(round.status === 'holed' ? 'basket' : 'lie', round.lie);
};

const playAgain = () => {
  round = createRound(hole, beginner, Date.now() >>> 0);
  lastEvents = [];
  target = undefined;
  canvas?.setLie(round.lie);
  canvas?.showView('lie', round.lie);
};
</script>

<GameCanvas bind:this={canvas} {hole} {onGroundClick} />

<aside class="panel">
  <h1>{testCourse.name}</h1>
  <p>Hole {hole.id} · Par {hole.par} · Strokes {round.strokes}</p>
  <p>{Math.round(distanceToBasket(round))} m to the basket</p>

  <div class="views" role="group" aria-label="Camera view">
    {#each views as view (view.name)}
      <button type="button" onclick={() => canvas?.showView(view.name, round.lie)}>
        {view.label}
      </button>
    {/each}
  </div>
  <p class="hint">Drag to orbit · right-drag to pan · scroll to zoom</p>

  {#if round.status === 'holed'}
    <p class="result" in:fly={{ y: 8, duration: 250 }}>
      Holed in {round.strokes}: <strong>{holeResultLabel(round.strokes, hole.par)}</strong>
    </p>
    <button type="button" onclick={playAgain}>Play again</button>
  {:else if throwing}
    <p class="status">Disc in the air…</p>
  {:else if kind === 'putt'}
    <p class="status">Inside circle 1. Standard putt: {chance}%</p>
    <button type="button" onclick={doThrow} disabled={!canThrow}>Putt</button>
  {:else if target}
    <p class="status">
      Standard Shot, {Math.round(Math.hypot(target[0] - round.lie[0], target[1] - round.lie[1]))} m: clean release
      {chance}%
    </p>
    <button type="button" onclick={doThrow} disabled={!canThrow}>Throw</button>
  {:else}
    <p class="status">Click the ground to aim.</p>
  {/if}
</aside>

{#if check && check.type === 'check'}
  <aside class="breakdown" in:fade={{ duration: 200 }}>
    <h2>{check.label}: {check.outcome}</h2>
    <table>
      <tbody>
        {#each check.reasons as reason (reason.source)}
          <tr>
            <td>{reason.source}</td>
            <td class:good={reason.value > 0} class:bad={reason.value < 0}>
              {reason.value > 0 ? '+' : ''}{reason.value}
            </td>
          </tr>
        {/each}
        <tr class="total">
          <td>Chance</td>
          <td>{check.chance}%</td>
        </tr>
        <tr>
          <td>Rolled</td>
          <td class:good={check.success} class:bad={!check.success}>{check.roll}</td>
        </tr>
      </tbody>
    </table>
    {#each messages as message (message)}
      <p class="message">{message}</p>
    {/each}
  </aside>
{/if}

<style>
  .panel,
  .breakdown {
    position: absolute;
    padding: 0.75rem 1rem;
    background: var(--ui-bg);
    border: 1px solid var(--ui-border);
    border-radius: 4px;
  }

  .panel {
    top: 1rem;
    left: 1rem;
    min-width: 14rem;
    max-width: 20rem;
  }

  .breakdown {
    top: 1rem;
    right: 1rem;
    min-width: 16rem;
    max-width: 22rem;
  }

  h1 {
    margin: 0 0 0.25rem;
    font-size: 1.1rem;
  }

  h2 {
    margin: 0 0 0.5rem;
    font-size: 1rem;
  }

  p {
    margin: 0.25rem 0;
    color: var(--ui-muted);
  }

  .hint {
    font-size: 0.8rem;
  }

  .status,
  .result,
  .message {
    color: var(--ui-text);
  }

  .message {
    margin-top: 0.5rem;
    font-style: italic;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }

  td {
    padding: 0.1rem 0;
  }

  td:last-child {
    text-align: right;
    padding-left: 1rem;
    font-variant-numeric: tabular-nums;
  }

  .total td {
    border-top: 1px solid var(--ui-border);
    padding-top: 0.25rem;
  }

  .good {
    color: var(--ui-good);
  }

  .bad {
    color: var(--ui-bad);
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

  button:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .views button {
    margin-top: 0;
  }
</style>
