# Next: Throw, Aim Regions, Putting

Working plan for roadmap items 1–3 (from the chat on 2026-10-31). Basket model is done; this is what comes next.
Status markers: **[done]** code exists, **[todo]** not started.

## Progress (2026-10-31)
- **[done]** Standard Shot: click to aim, release roll (clean / wobbly / shank), scatter, roll-out on slopes, out of bounds off the map edge (+1 penalty, replay from last lie). `sim/src/throw.ts`.
- **[done]** Standard putt inside circle 1 (10 m): in / spit out / miss, tap-in under 1.5 m. `sim/src/putt.ts`.
- **[done]** `apply(state, action) -> { state, events }` in `sim/src/round.ts`, with 23 unit tests on fixed seeds.
- **[done]** Disc mesh (grows with camera distance so it stays visible), trail, flight playback following the sim's curve, camera follows the disc then settles behind the new lie.
- **[done]** Roll breakdown panel: every reason, chance, roll, outcome, flavour text. Hole result in golf terms.
- **[done] (2026-11-01) Tree encounters** (`sim/src/trees.ts`). The flight curve is sampled every 0.2 m against each tree's trunk and canopy, using the shared shape helpers `trunkRadiusAt` / `canopyRadiusAt` in `course-format` that the renderer's models also use.
  - **Canopy**: pass through (chance = gaps in the leaves, minus driving skill), else deflected (glances off line) or swallowed (drops under the tree). The disc is 0.4 m into the leaves when it reacts.
  - **Trunk**: touching a trunk is always a hit (the release roll already decided the line). The roll decides good kick (keeps going, slightly off line), bad kick (sideways or back), or dead stop (drops at the base). The interrupted leg ends with the disc's edge exactly on the bark.
  - One roll per encounter, failures split by how badly they missed, up to 3 trees per throw. The tree you're standing under is ignored. Rolling discs stop against trunks. A disc never rests inside a trunk.
  - The roll breakdown lists every check and message in order.
  - Putts don't check trees yet.
- **[done] (2026-11-01) Low-ceiling Planned Shots** (`Player.shotHeights`): low apex to stay under branches, 75% range, −5 to the release, longer roll-out.
- **[done] (2026-11-01) Tree shapes**: `canopy.shape` is `'cone'` (pine, the default) or `'round'` (broadleaf crown, an ellipsoid with a clear trunk under it). Optional field, so no format version bump. Test hole trees are now bigger (pines to 17 m, oaks 6.5 m crowns), and the disc's minimum on-screen size is smaller so it no longer looks oversized next to them.
- **[done] (2026-11-01)** Planned Shots ("Big Brained Shot") for throws, first slice:
  - `Action` gains `{ type: 'planned-shot', regionId, target }`. `checkPlannedShot` (`sim/src/planned.ts`) rejects unknown regions, targets outside the region, putt range, and locked kinds, and says why.
  - Upshot (≤ 80 m) vs drive (> 80 m) by throw length. `Player.plannedShots` lists unlocks. The beginner has none (user decision); the `tester` profile has everything and is what the game uses for now.
  - Effect: +10 to the release chance (listed as a reason), 0.6× scatter (a shank still falls short), and a message saying whether the disc ended up in the chosen region.
  - Renderer draws regions draped on the terrain (`renderer/src/regions.ts`), with hover, selected, and locked styles.
  - UI: Standard / Big Brained toggle; hovering a region shows its chance and reasons, or why it's locked; clicking inside picks the exact spot.
  - Test hole has six hand-drawn regions.
- **[done] (2026-11-01)** Aim lines for Planned Shots (`sim/src/lines.ts`): straight / hyzer / anhyzer, plus backhand / forehand. Players are right-handed for now (RHBH / RHFH). Unlocked per player (`Player.lines`, `Player.throwTypes`). Hyzer +5 (forgiving), anhyzer −5 (hard to hold).
  - `curveDirection(line, throwType)`: an RHBH hyzer finishes left, an RHBH anhyzer right, and a forehand mirrors both.
  - The flight path bows out opposite the curve (an RHBH hyzer is released out right and curves back left). A bad release over-curves in the curve's direction. The aim preview draws the same shape.
- **[done] (2026-11-01)** Big Brained Putt with basket zones (`sim/src/basket-zones.ts`), inside circle 1 outside tap-in range:
  - Centre chains (base 92, best planned odds), left/right chains (88, misses stay close on that side), top band (45, slides in, or sits on top and is marked underneath), pole (35, pole hole or bounces back), lay-up (97, never holed, leaves a tap-in).
  - Planned bonus +8, then putting skill and distance like a standard putt. The first leg ends exactly on `basketZoneContact`, which the renderer also uses for the zone marker.
  - UI: zone list with chances, hover for the breakdown, picking a zone moves to the basket view.
- **[todo]** Action point cost for Planned Shots (needs the shot clock).

## Already written (not yet wired up or tested)
- **[done]** `packages/course-format/src/index.ts`
  - `Vec3` type.
  - `basketDimensions` moved here so sim and renderer share one set of sizes (the renderer's basket model now reads it).
  - `holeSize`, `elevationAt` (bilinear, so objects sit on the mesh), `pointInPolygon`, `regionAt`, `clampToHole`.
- **[done]** `packages/sim/src/rng.ts`: `nextRange`, `nextGaussian`, `nextSign`, `pickByRoll` (picks from a weighted table using a d100 roll that's already been made, so the roll can be reported).
- **[done]** `packages/sim/src/scoring.ts`: golf-score labels (`Triple bogey` ... `Albatross`), `formatScore` ("+2", "E"), `holeResultLabel`.
- **[done]** `packages/sim/src/geometry.ts`: small pure vector helpers.
- **[done]** `packages/sim/src/flight.ts`: `FlightLeg` + `flightPoint`. One curve definition shared by the sim (to find tree encounters) and the renderer (to animate), so a trunk hit on screen is exactly where the sim said.
- **[todo]** Unit tests for all of the above (sim steering requires tests with fixed seeds).

## Core design (applies to all three)
- `apply(state, action) -> { state, events }` in `packages/sim/src/round.ts`.
- `RoundState`: hole, disc lie, strokes, rng, status (`aiming` | `holed`), plus a nerve/tilt placeholder later.
- `Action`: `{ type: 'throw', target: Vec2, shot: ShotType }` and `{ type: 'putt', zone: BasketZone }`. Bots will submit the same objects.
- `ThrowEvent` list per action. Each event has a `kind`, a `FlightLeg` where the disc moves, and **reasons** (`{ source, value }[]`) for the feedback breakdown.
- Character for now: a fixed beginner profile with golf-score skills (e.g. Driving +2, Approach +2, Putting +2). Starts above par per `ideas/skill-scoring.md`. No stats UI yet.

## 1. Throw a disc
### Simulation (`packages/sim/src/throw.ts`)
1. **Shot types** (first pass): `drive`, `approach`, `spike-hyzer`, `layup`. Each has max range, scatter, apex height, and tags (spike hyzer has a high apex, lands steep, more tombstone, less roll).
2. **Chance**: base by shot type and distance vs. max range, plus skill modifier (golf score × 8%), minus distance overreach. Every term is recorded as a reason.
3. **Release roll** (d100 vs chance): `clean` / `wobbly` / `shank`. Sets scatter size and direction.
4. **Actual landing** = aimed target + scatter (gaussian, scaled by release result and distance), clamped to the hole.
5. **Fade**: cosmetic sideways bulge (random sign at low skill, consistent at high), used by both encounter checks and the animation.
6. **Tree encounters**: sample the flight curve; any sample inside a canopy volume or trunk cylinder is an encounter. Each gets a d100:
   - **Canopy**: pass through (chance falls with density) / deflect / swallowed (drops below the canopy).
   - **Trunk**: clean miss / kick (rolled direction and distance, good or bad) / dead stop at the trunk.
   - The first non-miss encounter interrupts the leg: `until` = fraction where it happened, `end` = the contact point **on the trunk surface** (so the disc visibly touches it), then a new `bounce` or `drop` leg follows.
7. **Landing**: skip/roll leg along the slope (from `elevationAt`), with tombstone chance (higher for spike hyzer, lower uphill). Surfaces come later; everything is fairway for now.
8. **Out of bounds**: off the edge of the map = OB, +1 stroke, replay from the previous lie. (Proper OB zones come with the course format.)

### Renderer (`packages/renderer/src/disc.ts`, `choreography.ts`)
- Disc mesh: flat cylinder, muted orange/red from the palette, with a faint fading trail.
- `playEvents(events)`: animates each `FlightLeg` with `flightPoint`, pacing by `legLength` and `pace` (throw fast, putt slower, drop with gravity ease).
- Contact effects: **bark chips** (small brown flecks) on trunk hits, **leaf burst** (green flecks) on canopy hits, a small puff on landing.
- Camera follows the disc at a low angle during the throw, then settles behind the new lie.

### UI (`apps/game`)
- Click the ground (raycast onto the terrain) to set a target. A marker plus a dashed preview line shows the planned shot.
- Shot-type buttons. "Throw" button.
- Result panel: the roll breakdown (each reason + value), the rolled number vs the chance, and a short flavour line ("Wobbly release, clipped the pine and kicked left").
- Stroke counter and hole result using `holeResultLabel`.

## 2. Aim regions (Planned Shot)
- A **Standard Shot** just picks a target and throws. A **Planned Shot** costs more action points (see `ideas/shot-clock.md`) and unlocks region selection, the per-region chance breakdown, and aim lines.
- Planned Shots are unlocked by skill, separately for putts, upshots, and drives (by distance). For the prototype, the beginner profile has Planned Putt and Planned Upshot unlocked so both can be tested.
- Hand-drawn polygons in the test hole (`regions` array): e.g. "Left of the pine", "Fairway centre", "Short of the hill", "Circle 1".
- Renderer draws each region as a flat translucent overlay just above the terrain (draped on the heightmap), outlined.
- **Hover**: raycast the pointer to the ground, find the region with `regionAt`, highlight it, and show a tooltip: success chance + top reasons.
- **Click**: selects the region, and the target becomes the region's centroid (or the clicked point inside it).
- **Lines** (later in this step): at higher skill, show 1–3 suggested lines (straight, hyzer, anhyzer) as curves to the region. Picking one sets the fade direction. Low skill gets only the straight line.
- The chance shown on hover uses the same sim function as the throw, so the preview and the result always agree.

## 3. Putting
- Inside circle 1 (10 m) the action becomes **putt**, with basket zones:
  - `centre-chains`: best chance, safe.
  - `left-chains` / `right-chains`: better with a matching curve, risk of spit-out.
  - `band`: low chance, can land on top.
  - `pole`: pole hole or a bounce out.
  - `layup`: drop short under the basket, near-certain tap-in next stroke, and (later) lowers nerves.
- Putt roll outcomes: `in` / `spit-out` / `cage-bounce` / `on-top` / `short` / `long`. Distance and slope modify the chance.
- Choreography uses the named basket parts: contact point on the chains (disc slows, chains wobble), the band, or the pole, using `basketDimensions` from `course-format`.
- UI: when in range, the camera moves to the basket view and the zones become hoverable on the basket itself, each with its chance and reasons.

## Build order
1. Tests for the code already written.
2. `round.ts` + `throw.ts` with tests (fixed seeds) for: clean shot lands near target, trunk kick produces a contact point on the trunk surface, OB adds a stroke.
3. Disc mesh + choreography for a plain throw (no trees), then trees.
4. Click-to-target + result panel.
5. Regions + hover.
6. Putting.

## Known issues to fix along the way
- The sun's shadow map covers the whole hole at 2048 px, so small objects (the basket) cast blurry blob shadows. Fix: tighten the shadow camera around the action, or use a second shadow-casting light near the camera.
- From the tee the hill hides the basket. That's fine (a blind shot), but a Planned Shot needs a way to see the target (e.g. a basket marker visible through terrain).
