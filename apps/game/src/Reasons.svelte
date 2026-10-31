<script lang="ts">
import type { Reason } from '@dgrpg/sim';

const {
  reasons,
  totalLabel = 'Chance',
  chance,
  roll,
  success,
}: {
  reasons: readonly Reason[];
  totalLabel?: string;
  chance: number | undefined;
  roll?: number;
  success?: boolean;
} = $props();
</script>

<table>
  <tbody>
    {#each reasons as reason (reason.source)}
      <tr>
        <td>{reason.source}</td>
        <td class:good={reason.value > 0} class:bad={reason.value < 0}>
          {reason.value > 0 ? '+' : ''}{reason.value}
        </td>
      </tr>
    {/each}
    <tr class="total">
      <td>{totalLabel}</td>
      <td>{chance}%</td>
    </tr>
    {#if roll !== undefined}
      <tr>
        <td>Rolled</td>
        <td class:good={success} class:bad={!success}>{roll}</td>
      </tr>
    {/if}
  </tbody>
</table>

<style>
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9em;
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
</style>
