import { basketDimensions, type Vec2 } from '@dgrpg/course-format';
import { describe, expect, it } from 'vitest';
import { type BasketZone, basketZoneContact, basketZones } from './basket-zones.ts';
import type { ThrowEvent } from './events.ts';
import { legEnd } from './flight.ts';
import { distance2 } from './geometry.ts';
import { beginner, tester } from './player.ts';
import { type Action, apply, checkAction, createRound, previewChance, type RoundState } from './round.ts';
import { flatHole } from './test-hole.ts';

const seeds = Array.from({ length: 300 }, (_, index) => index + 1);
const putt = (zone: BasketZone): Action => ({ type: 'planned-putt', zone });
/** 6 m short of the basket at [30, 20]. */
const lie: Vec2 = [30, 26];
const at = (seed: number, player = tester): RoundState => ({ ...createRound(flatHole(), player, seed), lie });
const checkOf = (events: readonly ThrowEvent[]) => events.find((event) => event.type === 'check');
const lastMove = (events: readonly ThrowEvent[]) =>
  events.flatMap((event) => (event.type === 'move' ? [event.leg] : [])).at(-1);
const runs = (zone: BasketZone) => seeds.map((seed) => apply(at(seed), putt(zone)));

describe('basket zones (Big Brained Putt)', () => {
  it('are locked for a beginner, and only open inside circle 1 outside tap-in range', () => {
    expect(checkAction(at(1, beginner), putt('centre-chains')).allowed).toBe(false);
    expect(checkAction(at(1), putt('centre-chains')).allowed).toBe(true);
    const far = { ...at(1), lie: [30, 60] as const };
    expect(checkAction(far, putt('centre-chains')).allowed).toBe(false);
    const tapIn = { ...at(1), lie: [30, 21] as const };
    expect(checkAction(tapIn, putt('centre-chains')).allowed).toBe(false);
    const refused = apply(at(1, beginner), putt('pole'));
    expect(refused.events).toEqual([]);
  });

  it('rolls against the chance it previews', () => {
    for (const zone of basketZones) {
      const round = at(3);
      const check = checkOf(apply(round, putt(zone)).events);
      expect(check?.type === 'check' && check.chance).toBe(previewChance(round, putt(zone)));
    }
  });

  it('ranks the zones: lay-up safest, pole the long shot, planned centre beats a standard putt', () => {
    const chance = (zone: BasketZone) => previewChance(at(1), putt(zone)) ?? 0;
    const standard = previewChance(at(1), { type: 'standard-shot', target: [0, 0] }) ?? 0;
    expect(chance('layup')).toBeGreaterThan(chance('centre-chains'));
    expect(chance('centre-chains')).toBeGreaterThan(standard);
    expect(chance('centre-chains')).toBeGreaterThan(chance('left-chains'));
    expect(chance('left-chains')).toBe(chance('right-chains'));
    expect(chance('band')).toBeGreaterThan(chance('pole'));
  });

  it('aims at the right part of the basket', () => {
    const hole = flatHole();
    const [, bandY] = basketZoneContact(hole, lie, 'band');
    expect(bandY).toBeCloseTo(basketDimensions.bandHeight);
    const [lx] = basketZoneContact(hole, lie, 'left-chains');
    const [rx] = basketZoneContact(hole, lie, 'right-chains');
    // Facing -z toward the basket, the thrower's right is +x.
    expect(lx).toBeLessThan(rx);
    const [px, , pz] = basketZoneContact(hole, lie, 'pole');
    expect(distance2([px, pz], hole.basket)).toBeLessThan(basketDimensions.poleRadius + 0.02);
    expect(basketZoneContact(hole, lie, 'layup')[1]).toBeLessThan(0.05);
  });

  it('flies the first leg exactly to the zone contact point', () => {
    const hole = flatHole();
    for (const zone of basketZones.filter((z) => z !== 'layup')) {
      const first = apply(at(5), putt(zone)).events.find((event) => event.type === 'move');
      expect(first?.type === 'move' && legEnd(first.leg)).toEqual(basketZoneContact(hole, lie, zone));
    }
  });

  it('never holes a lay-up, and a good one leaves a tap-in', () => {
    const results = runs('layup');
    expect(results.every(({ state }) => state.status === 'playing')).toBe(true);
    const good = results.filter(({ events }) => checkOf(events)?.success);
    expect(good.length).toBeGreaterThan(250);
    for (const { state } of good) expect(distance2(state.lie, [30, 20])).toBeLessThanOrEqual(1.5);
  });

  it('holes a successful chains, band, or pole putt into the tray', () => {
    for (const zone of ['centre-chains', 'right-chains', 'band', 'pole'] as const) {
      const holed = runs(zone).filter(({ state }) => state.status === 'holed');
      expect(holed.length).toBeGreaterThan(0);
      for (const { events } of holed) {
        const end = lastMove(events);
        expect(end && legEnd(end)[1]).toBeCloseTo(basketDimensions.trayBottom, 1);
      }
    }
  });

  it('keeps side-chain misses close and on that side', () => {
    const misses = runs('left-chains').filter(({ state }) => state.status === 'playing');
    expect(misses.length).toBeGreaterThan(0);
    for (const { state } of misses) {
      expect(distance2(state.lie, [30, 20])).toBeLessThan(3);
      expect(state.lie[0]).toBeLessThan(30); // Thrower's left is -x here.
    }
  });

  it('marks a disc on top of the basket underneath it', () => {
    const onTop = runs('band').filter(({ events }) => {
      const check = checkOf(events);
      return check?.type === 'check' && check.outcome === 'On top of the basket';
    });
    expect(onTop.length).toBeGreaterThan(0);
    for (const { state } of onTop) expect(distance2(state.lie, [30, 20])).toBeLessThan(1);
  });

  it('never leaves the disc resting inside the basket footprint', () => {
    for (const zone of basketZones) {
      for (const { state } of runs(zone).filter(({ state }) => state.status === 'playing')) {
        expect(distance2(state.lie, [30, 20])).toBeGreaterThan(basketDimensions.trayRadiusTop);
      }
    }
  });
});
