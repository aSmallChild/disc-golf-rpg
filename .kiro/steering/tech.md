---
inclusion: always
---
# Tech

See `docs/plan.md` for options and reasoning. Update this file when the user makes decisions.

## Decided
- **Rendering: Three.js** (locked in by the user). Pinned to an exact version; upgrade on purpose.
- TypeScript 6 + Vite, pnpm monorepo, Node 26. Layout and toolchain in `coding-standards.md`.
- **UI: Svelte 5 on plain Vite** (locked in). No SvelteKit, no SSR. Static SPA.
  - The Three.js scene is a plain TS module mounted by a single `GameCanvas` component in `onMount`. HTML menus are layered over the canvas.
  - Never put Three.js objects in `$state` (deep proxies). Use plain modules or `$state.raw`.
  - The game loop (`requestAnimationFrame`) runs outside Svelte.
  - A small store module bridges simulation state to components, so the UI layer stays swappable.
  - Use Svelte's built-in transitions/tweens for UI feedback. The palette lives in shared CSS variables.
- Art: **low detail**. Only enough to show the terrain and the throw. Never add realism or decorative detail.
  - Slightly cartoonish shapes (reference: https://3d-golf-opus.vercel.app/), but **real-life colours**, not vibrant. Muted greens, browns, and greys. The game has a harsh "low skill, bad luck" side, and the palette must allow for that.
  - Keep the palette in one place so weather or mood can shift it (e.g. overcast or rain desaturates).
- Single-player first, but always code for future multiplayer and bots:
  - Game state is serialisable plain data. The simulation is `apply(state, action, rng)`.
  - All randomness comes from a seeded RNG stored in the state.
  - Humans, bots, and remote players all submit actions through one controller interface.
- Saves are local only (IndexedDB/localStorage) and versioned. No hosting until the user says the game is ready.
- The game simulation (terrain, flight, rolls) has no engine imports.
- **Outcome first, visuals second** (see `docs/plan.md` 2a):
  - The simulation resolves a throw into a list of events with dice (release, encounters with tree trunk/canopy, landing, roll). It never uses physics to decide an outcome.
  - The renderer choreographs a believable flight path that passes through each event's contact point, with real visual contact with the tree's trunk or canopy volume.
  - Trees have separate trunk and canopy volumes with different effects.
  - The visual path comes from the events + seed, so it is deterministic.
- **Camera: tilted.** VATS-style aiming with hoverable regions and, depending on skill, aimable lines.
- **Courses are built by hand first.** One versioned course format is shared by hand-edited files, the in-game editor, and any future generator. Aim regions are hand-drawn per hole. Generation is a nice-to-have, so don't build it unless asked.
- Eventual deploy target: Cloudflare (Workers static assets, Durable Objects, D1).

## Not decided
- Nothing tech-level pending. Add new open questions here.
