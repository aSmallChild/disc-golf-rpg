---
inclusion: fileMatch
fileMatchPattern: 'apps/{game,editor}/**'
---
# UI (Svelte 5)

- Svelte 5 runes only (`$state`, `$derived`, `$props`, `$effect`). No legacy `export let` or stores syntax.
- Never put Three.js objects in `$state`. Use plain variables or `$state.raw` for large immutable sim state.
- `GameCanvas.svelte` is the only component that mounts the renderer.
- Components send actions to the simulation and render state. No game rules in components.
- Colours and fonts come from CSS variables in `src/theme.css`.
- Use Svelte transitions/tweens for feedback (rolls, unlocks, mishaps).
- Static SPA. No SvelteKit, no SSR.
