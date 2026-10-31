---
inclusion: always
---
# Coding Standards

## Repo layout (pnpm monorepo)
```
apps/game/              Svelte 5 + Vite SPA (menus, mounts the renderer)
apps/editor/            (later) course editor
packages/sim/           pure simulation: rolls, RNG, actions -> events
packages/course-format/ course types, version, helpers (shared contract)
packages/renderer/      Three.js scene, terrain, camera, choreography
packages/bots/          bot players (sim only)
courses/                hand-built course data
```
Dependency direction: `game -> renderer, sim, course-format`; `renderer -> course-format`; `sim -> course-format`; `bots -> sim`. Never import upwards (e.g. `sim` must never import `renderer` or Svelte).

Packages export TypeScript source directly (`"exports": { ".": "./src/index.ts" }`). No per-package build step.

## Toolchain
- Node 26 (`.nvmrc`), pnpm 12 workspaces.
- TypeScript 6 (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`). TS 7 is blocked until svelte-check supports it.
- Vitest (root `vitest.config.ts`, projects = `packages/*`). Tests sit next to source as `*.test.ts`.
- Biome for lint + format. Markdown is excluded so docs and ideas aren't reformatted.
- Commands: `pnpm dev`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format`, `pnpm build`.

## Functional programming (user preference)
- Prefer pure functions and plain readonly data (`type` + `readonly`). No classes in our own code.
- No mutation of inputs. Return new values (`{ ...state, x }`, `map`/`filter`/`reduce`).
- Pass state explicitly. Stateful things (like the RNG) return `[value, nextState]` tuples.
- Use `const` everywhere. Local mutation only when unavoidable for performance, and kept inside a function.
- Side effects (DOM, Three.js, storage, time) live at the edges in thin modules that expose functions and return disposers.
- Three.js is object-oriented by nature. Contain it in `packages/renderer` behind functions like `mountHoleView(canvas, hole) -> { dispose }`.
- Prefer discriminated unions over flags or inheritance.

## General
- Explicit, readable names. Small modules with one job.
- Comments explain *why*, not *what*.
- Don't add dependencies without a reason. Pin `three` exactly.
