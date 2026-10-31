<script lang="ts">
import { regionAt, regionCentre, type Vec2 } from '@dgrpg/course-format';
import type { CameraViewName } from '@dgrpg/renderer';
import {
  type Action,
  apply,
  type BasketZone,
  basketZoneBlurb,
  basketZoneContact,
  basketZoneLabel,
  basketZones,
  checkAction,
  createRound,
  distanceToBasket,
  holeResultLabel,
  lineFade,
  lineLabels,
  previewChance,
  previewReasons,
  shotKind,
  type ThrowEvent,
  type ThrowLine,
  tester,
  throwLines,
} from '@dgrpg/sim';
import { fade, fly } from 'svelte/transition';
import GameCanvas from './GameCanvas.svelte';
import Reasons from './Reasons.svelte';
import { testCourse } from './test-hole.ts';

const hole = testCourse.holes[0];
if (!hole) throw new Error('Test course has no holes');

/** Every Planned Shot and line unlocked for play-testing, until the skill tree exists. */
const player = tester;

const views: readonly { readonly name: CameraViewName; readonly label: string }[] = [
  { name: 'overview', label: 'Overview' },
  { name: 'lie', label: 'Disc' },
  { name: 'basket', label: 'Basket' },
];

type Mode = 'standard' | 'planned';
type PuttChoice = BasketZone | 'standard';
type Screen = { readonly x: number; readonly y: number };

let canvas: GameCanvas | undefined = $state();
let round = $state.raw(createRound(hole, player, Date.now() >>> 0));
let mode = $state<Mode>('standard');
let line = $state<ThrowLine>('straight');
/** Standard Shot target. */
let target = $state.raw<Vec2 | undefined>(undefined);
/** Planned Shot choice: a region and the clicked point inside it. */
let planned = $state.raw<{ readonly regionId: string; readonly target: Vec2 } | undefined>(undefined);
let puttChoice = $state<PuttChoice>('standard');
let hoveredPutt = $state<PuttChoice | undefined>(undefined);
let hover = $state.raw<{ readonly point: Vec2; readonly screen: Screen } | undefined>(undefined);
let lastEvents = $state.raw<readonly ThrowEvent[]>([]);
let throwing = $state(false);

const kind = $derived(shotKind(round));
const playing = $derived(round.status === 'playing' && !throwing);
const planning = $derived(mode === 'planned' && kind === 'throw');
const distanceTo = (point: Vec2) => Math.round(Math.hypot(point[0] - round.lie[0], point[1] - round.lie[1]));

const puttAction = (choice: PuttChoice): Action =>
  choice === 'standard'
    ? { type: 'standard-shot', target: hole.basket }
    : { type: 'planned-putt', zone: choice };
const plannedAt = (regionId: string, point: Vec2, shape: ThrowLine = line): Action => ({
  type: 'planned-shot',
  regionId,
  target: point,
  line: shape,
});

const action = $derived.by((): Action | undefined => {
  if (kind === 'putt') return puttAction(puttChoice);
  if (mode === 'planned') return planned && plannedAt(planned.regionId, planned.target);
  return target && { type: 'standard-shot', target };
});
const chance = $derived(action ? previewChance(round, action) : undefined);
const aimPoint = $derived(
  kind === 'putt' ? hole.basket : action?.type === 'standard-shot' ? target : planned?.target,
);
/** Planned Shots preview their line's curve; Standard Shots are drawn straight. */
const aimFade = $derived(planning && planned ? lineFade[line] * distanceTo(planned.target) : 0);

/** Regions the player can't plan into from here, judged at each region's centre. */
const locked = $derived(
  hole.regions
    .filter((region) => !checkAction(round, plannedAt(region.id, regionCentre(region), 'straight')).allowed)
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
    distance: distanceTo(hover.point),
    why: verdict.allowed ? undefined : verdict.why,
    chance: previewChance(round, hovered),
    reasons: previewReasons(round, hovered),
  };
});

const zonesCheck = $derived(checkAction(round, { type: 'planned-putt', zone: 'centre-chains' }));
const puttShown = $derived(hoveredPutt ?? puttChoice);
const puttLabel = (choice: PuttChoice) => (choice === 'standard' ? 'Standard putt' : basketZoneLabel(choice));

const check = $derived(lastEvents.find((event) => event.type === 'check'));
const messages = $derived(lastEvents.flatMap((event) => (event.type === 'message' ? [event.text] : [])));
const canThrow = $derived(playing && action !== undefined && chance !== undefined);
const plannedName = $derived(
  planned && hole.regions.find((region) => region.id === planned?.regionId)?.label,
);

// Keep the aim marker, putt zone marker, and regions in sync with the choice and the lie.
$effect(() => {
  if (!throwing) canvas?.setAim(round.lie, round.status === 'playing' ? aimPoint : undefined, aimFade);
});
$effect(() => {
  const showZone = playing && kind === 'putt' && puttShown !== 'standard';
  canvas?.setPuttZone(showZone ? basketZoneContact(hole, round.lie, puttShown) : undefined);
});
$effect(() => {
  canvas?.showRegions({
    visible: planning && playing,
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

const choosePutt = (choice: PuttChoice) => {
  puttChoice = choice;
  // The zone marker is tiny, so look at the basket while choosing.
  if (choice !== 'standard') canvas?.showView('basket', round.lie);
};

const onGroundHover = (point: Vec2 | undefined, screen: Screen) => {
  hover = point ? { point, screen } : undefined;
};

const onGroundClick = (point: Vec2) => {
  if (!playing || kind === 'putt') return;
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
  puttChoice = 'standard';
  hoveredPutt = undefined;
  throwing = false;
  // A holed disc stays where the putt left it: in the tray.
  if (round.status !== 'holed') canvas?.setLie(round.lie);
  canvas?.showView(round.status === 'holed' ? 'basket' : 'lie', round.lie);
};

const playAgain = () => {
  round = createRound(hole, player, Date.now() >>> 0);
  lastEvents = [];
  target = undefined;
  planned = undefined;
  puttChoice = 'standard';
  canvas?.setLie(round.lie);
  canvas?.showView('lie', round.lie);
};
</script>

<GameCanvas bind:this={canvas} {hole} {onGroundClick} {onGroundHover} />

<aside class="panel">
  <h1>{testCourse.name}</h1>
  <p>Hole {hole.id} · Par {hole.par} · Strokes {round.strokes}</p>
  <p>{Math.round(distanceToBasket(round))} m to the basket</p>
  <p class="hint">Testing profile: every Big Brained Shot and line unlocked.</p>

  <div class="row" role="group" aria-label="Camera view">
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
    <p class="status">Inside circle 1.</p>
    <div class="choices" role="group" aria-label="Putt">
      <button
        type="button"
        class:active={puttChoice === 'standard'}
        onclick={() => choosePutt('standard')}
        onpointerenter={() => (hoveredPutt = 'standard')}
        onpointerleave={() => (hoveredPutt = undefined)}
      >
        <span>Standard putt</span><span>{previewChance(round, puttAction('standard'))}%</span>
      </button>
      {#if zonesCheck.allowed}
        {#each basketZones as zone (zone)}
          <button
            type="button"
            class:active={puttChoice === zone}
            onclick={() => choosePutt(zone)}
            onpointerenter={() => (hoveredPutt = zone)}
            onpointerleave={() => (hoveredPutt = undefined)}
          >
            <span>{basketZoneLabel(zone)}</span><span>{previewChance(round, puttAction(zone))}%</span>
          </button>
        {/each}
      {:else}
        <p class="hint">Big Brained Putt: {zonesCheck.why}</p>
      {/if}
    </div>
    <div class="preview">
      <h3>{puttLabel(puttShown)}</h3>
      {#if puttShown !== 'standard'}
        <p class="hint">{basketZoneBlurb(puttShown)}</p>
      {/if}
      <Reasons
        reasons={previewReasons(round, puttAction(puttShown))}
        chance={previewChance(round, puttAction(puttShown))}
      />
    </div>
    <button type="button" onclick={doThrow} disabled={!canThrow}>Putt: {puttLabel(puttChoice)}</button>
  {:else}
    <div class="row" role="group" aria-label="Shot">
      <button type="button" class:active={mode === 'standard'} onclick={() => setMode('standard')}>
        Standard Shot
      </button>
      <button type="button" class:active={mode === 'planned'} onclick={() => setMode('planned')}>
        Big Brained Shot
      </button>
    </div>
    {#if mode === 'planned'}
      <div class="row" role="group" aria-label="Line">
        {#each throwLines as shape (shape)}
          <button
            type="button"
            class:active={line === shape}
            disabled={shape !== 'straight' && !player.lines.includes(shape)}
            onclick={() => (line = shape)}
          >
            {lineLabels[shape]}
          </button>
        {/each}
      </div>
    {/if}
    {#if mode === 'standard' && target}
      <p class="status">Standard Shot, {distanceTo(target)} m: clean release {chance}%</p>
      <button type="button" onclick={doThrow} disabled={!canThrow}>Throw</button>
    {:else if mode === 'standard'}
      <p class="status">Click the ground to aim.</p>
    {:else if planned}
      <p class="status">
        {lineLabels[line]} into {plannedName}, {distanceTo(planned.target)} m: clean release {chance}%
      </p>
      <button type="button" onclick={doThrow} disabled={!canThrow}>Throw</button>
    {:else}
      <p class="status">Hover a region to weigh it up, click inside it to pick your spot.</p>
    {/if}
  {/if}
</aside>

{#if hoverInfo}
  <div class="tooltip" style:left="{hoverInfo.screen.x + 18}px" style:top="{hoverInfo.screen.y + 18}px">
    <h3>{hoverInfo.region.label} · {hoverInfo.distance} m · {lineLabels[line]}</h3>
    {#if hoverInfo.why}
      <p class="bad">{hoverInfo.why}</p>
    {:else}
      <Reasons reasons={hoverInfo.reasons} totalLabel="Clean release" chance={hoverInfo.chance} />
    {/if}
  </div>
{/if}

{#if check && check.type === 'check'}
  <aside class="breakdown" in:fade={{ duration: 200 }}>
    <h2>{check.label}: {check.outcome}</h2>
    <Reasons reasons={check.reasons} chance={check.chance} roll={check.roll} success={check.success} />
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
    max-height: calc(100% - 2rem);
    overflow-y: auto;
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

  h3 {
    margin: 0 0 0.35rem;
    font-size: 0.9rem;
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

  .bad {
    color: var(--ui-bad);
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

  button.active {
    background: var(--ui-active);
    border-color: var(--ui-text);
  }

  .row {
    display: flex;
    gap: 0.25rem;
    margin-top: 0.5rem;
  }

  .row button {
    margin-top: 0;
  }

  .choices {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    margin-top: 0.5rem;
  }

  .choices button {
    margin-top: 0;
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    font-variant-numeric: tabular-nums;
  }

  .preview {
    margin-top: 0.6rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--ui-border);
    font-size: 0.9rem;
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
</style>
