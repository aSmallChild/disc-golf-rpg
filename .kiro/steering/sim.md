---
inclusion: fileMatch
fileMatchPattern: 'packages/{sim,bots}/**'
---
# Simulation and Bots

- No DOM, no Three.js, no Svelte, no `Date.now()`, no `Math.random()`. Code must run in Node, the browser, and a future Cloudflare Worker.
- All randomness comes from `Rng` in `rng.ts`, passed explicitly and returned as `[value, nextRng]`.
- The core shape is `apply(state, action) -> { state, events }`. State and events are serialisable plain data.
- Outcomes are decided by dice, never by physics. A throw resolves into an event list (release, trunk/canopy encounters, landing, roll).
- Every roll records its **reasons** (each modifier with its source and value) for the feedback breakdown.
- Skills use golf scoring: above par is bad, below par is good (`ideas/skill-scoring.md`).
- Bots submit the same `Action` objects as humans, and see the same chances.
- Every rule gets unit tests with fixed seeds.
