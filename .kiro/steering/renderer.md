---
inclusion: fileMatch
fileMatchPattern: 'packages/renderer/**'
---
# Renderer (Three.js)

- The renderer only draws state and acts out simulation events. It never decides outcomes.
- Public API is functions (`mountHoleView`, etc.) returning disposers. Three.js objects stay inside this package.
- Choreography: build a believable flight path through each event's contact point. A trunk hit must visibly touch the trunk cylinder, and a canopy hit must enter the canopy volume.
- The path is derived from events + seed only, so it's deterministic.
- Trees are two named meshes: `trunk` and `canopy`.
- All colours come from `palette.ts` (real-life, muted). Low detail, flat shading, simple shapes.
- Camera is tilted (see `CAMERA_TILT`).
- Dispose geometries, materials, and the renderer on unmount.
