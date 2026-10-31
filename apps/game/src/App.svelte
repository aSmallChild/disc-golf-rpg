<script lang="ts">
import { regionAt, regionCentre, type Vec2 } from '@dgrpg/course-format';
import type { CameraViewName } from '@dgrpg/renderer';
import {
  type Action,
  apply,
  beginner,
  checkAction,
  createRound,
  distanceToBasket,
  holeResultLabel,
  previewChance,
  previewReasons,
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

type Mode = 'standard' | 'planned';
type Screen = { readonly x: number; readonly y: number };

let canvas: GameCanvas | undefined = $state();
let round = $state.raw(createRound(hole, beginner, Date.now() >>> 0));
let mode = $state<Mode>('standard');
/** Standard Shot target. */
let target = $state.raw<Vec2 | undefined>(undefined);
/** Planned Shot choice: a region and the clicked point inside it. */
let planned = $state.raw<{ readonly regionId: string; readonly target: Vec2 } | undefined>(undefined);
let hover = $state.raw<{ readonly point: Vec2; readonly screen: Screen } | undefined>(undefined);
let lastEvents = $state.raw<readonly ThrowEvent[]>([]);
let throwing = $state(false);

const kind = $derived(shotKind(round));
const planning = $derived(mode === 'planned' && kind === 'throw');

const action = $derived.by((): Action | undefined => {
  if (kind === 'putt') return { type: 'standard-shot', target: hole.basket };
  if (mode === 'planned') return planned && { type: 'planned-shot', ...planned };
  return target && { type: 'standard-shot', target };
});
const chance = $derived(action ? previewChance(round, action) : undefined);
const aimPoint = $derived(action?.target);

const plannedAt = (regionId: string, point: Vec2): Action => ({
  type: 'planned-shot',
  regionId,
  target: point,
});

/** Regions the player can't plan into from here, judged at each region's centre. */
const locked = $derived(
  hole.regions
    .filter((region) => !checkAction(round, plannedAt(region.id, regionCentre(region))).allowed)
    .map((region) => region.id),
);

const hoveredRegion = $derived(planning && hover ? regionAt(hole, hover.point) : undefined);
const hoverInfo = $derived.by(() => {
  if (!hover || !hoveredRegion) return undefined;
  const hovered = plannedAt(hoveredRegion.id, hover.point);
  const verdict = checkAction(round, hovered);
  return {
    region: hoveredRegion,
    screen: hover.screen,
    distance: Math.round(Math.hypot(hover.point[0] - round.lie[0], hover.point[1] - round.lie[1])),
    why: verdict.allowed ? undefined : verdict.why,
    chance: previewChance(round, hovered),
    reasons: previewReasons(round, hovered),
  };
});

const check = $derived(lastEvents.find((event) => event.type === 'check'));
const messages = $derived(lastEvents.flatMap((event) => (event.type === 'message' ? [event.text] : [])));
const canThrow = $derived(
  round.status === 'playing' && !throwing && action !== undefined && chance !== undefined,
);
const plannedName = $derived(
  planned && hole.regions.find((region) => region.id === planned?.regionId)?.label,
);

const showAim = () => canvas?.setAim(round.lie, round.status === 'playing' ? aimPoint : undefined);

// Keep the aim marker and the regions in sync with the choice and the lie.
$effect(() => {
  if (!throwing) showAim();
});
$effect(() => {
  canvas?.showRegions({
    visible: planning && !throwing && round.status === 'playing',
    hovered: hoveredRegion?.id,
    selected: planned?.regionId,
    locked,
  });
});

const setMode = (next: Mode) => {
  mode = next;
  target = undefined;
  planned = undefined;
};

const onGroundHover = (point: Vec2 | undefined, screen: Screen) => {
  hover = point ? { point, screen } : undefined;
};

const onGroundClick = (point: Vec2) => {
  if (throwing || round.status !== 'playing' || kind === 'putt') return;
  if (mode === 'standard') {
    target = point;
    return;
  }
  const region = regionAt(hole, point);
  // Locked regions only explain themselves (in the tooltip); they can't be picked.
  planned =
    region && checkAction(round, plannedAt(region.id, point)).allowed
      ? { regionId: region.id, target: point }
      : undefined;
};

const doThrow = async () => {
  if (!canThrow || !action) return;
  const result = apply(round, action);
  throwing = true;
  lastEvents = [];
  canvas?.setAim(round.lie, undefined);
  await canvas?.play(result.events);
  round = result.state;
  lastEvents = result.events;
  target = undefined;
  planned = undefined;
  throwing = false;
  // A holed disc stays where the putt left it: in the tray.
  if (round.status !== 'holed') canvas?.setLie(round.lie);
  canvas?.showView(round.status === 'holed' ? 'basket' : 'lie', round.lie);
};

const playAgain = () => {
  round = createRound(hole, beginner, Date.now() >>> 0);
  lastEvents = [];
  target = undefined;
  planned = undefined;
  canvas?.setLie(round.lie);
  canvas?.showView('lie', round.lie);
};
</script>

<GameCanvas bind:this={canvas} {hole} {onGroundClick} {onGroundHover} />

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
  <p class="hint">Drag to orbit · right-drag or WASD/arrows to pan · scroll to zoom</p>

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
  {:else}
    <div class="modes" role="group" aria-label="Shot">
      <button type="button" class:active={mode === 'standard'} onclick={() => setMode('standard')}>
        Standard Shot
      </button>
      <button type="button" class:active={mode === 'planned'} onclick={() => setMode('planned')}>
        Big Brained Shot
      </button>
    </div>
    {#if mode === 'standard' && target}
      <p class="status">
        Standard Shot, {Math.round(Math.hypot(target[0] - round.lie[0], target[1] - round.lie[1]))} m: clean release
        {chance}%
      </p>
      <button type="button" onclick={doThrow} disabled={!canThrow}>Throw</button>
    {:else if mode === 'standard'}
      <p class="status">Click the ground to aim.</p>
    {:else if planned}
      <p class="status">Big Brained Shot into {plannedName}: clean release {chance}%</p>
      <button type="button" onclick={doThrow} disabled={!canThrow}>Throw</button>
    {:else}
      <p class="status">Hover a region to weigh it up, click inside it to pick your spot.</p>
    {/if}
  {/if}
</aside>

{#if hoverInfo}
  <div class="tooltip" style:left="{hoverInfo.screen.x + 18}px" style:top="{hoverInfo.screen.y + 18}px">
    <h3>{hoverInfo.region.label} · {hoverInfo.distance} m</h3>
    {#if hoverInfo.why}
      <p class="bad">{hoverInfo.why}</p>
    {:else}
      <table>
        <tbody>
          {#each hoverInfo.reasons as reason (reason.source)}
            <tr>
              <td>{reason.source}</td>
              <td class:good={reason.value > 0} class:bad={reason.value < 0}>
                {reason.value > 0 ? '+' : ''}{reason.value}
              </td>
            </tr>
          {/each}
          <tr class="total">
            <td>Clean release</td>
            <td>{hoverInfo.chance}%</td>
          </tr>
        </tbody>
      </table>
    {/if}
  </div>
{/if}

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

  .modes {
    display: flex;
    gap: 0.25rem;
    margin-top: 0.75rem;
  }

  .modes button {
    margin-top: 0;
  }

  .modes button.active {
    background: var(--ui-active);
    border-color: var(--ui-text);
  }

  .tooltip {
    position: absolute;
    pointer-events: none;
    max-width: 18rem;
    padding: 0.5rem 0.75rem;
    background: var(--ui-bg);
    border: 1px solid var(--ui-border);
    border-radius: 4px;
    font-size: 0.85rem;
  }

  h3 {
    margin: 0 0 0.35rem;
    font-size: 0.9rem;
  }
</style>
