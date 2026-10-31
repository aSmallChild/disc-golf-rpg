---
tags: [design-principle]
status: accepted
related: [nerve-meter.md, luck.md, tilt-anger.md, gear-sunglasses.md, gear-hat.md, gear-chalk-bag.md, gear-disc-retriever.md]
---
# Every Item Matters

## User's notes
- Overarching mechanics (luck, nerves, composure, tilt, conditions) exist so that **every little thing can affect the game**.
- **No purely cosmetic items.**
- Every item ties into the mechanics, ideally in **more than one way**.
- Example: sunglasses improve accuracy in the sun, decrease accuracy at night, and calm nerves because people can't see your face.

## Suggestions
*(suggestion)* **Rules of thumb for designing an item**
- At least two hooks, at least one of them conditional (time of day, weather, surface, stakes).
- Where possible, one downside or situation where it hurts (sunglasses at night). Trade-offs make gear a decision rather than a straight upgrade.
- Each hook connects to an existing mechanic: luck, nerves, composure, tilt, the shot clock, expectation (`nerve-meter.md`), weather, surfaces, or a skill.
- Skill level scales the item: low skill brings out the downside, high skill brings out the upside (`skill-scoring.md`).

*(suggestion)* **Item card format** (also usable in the UI tooltip):
```
Sunglasses (cheap)
  + Accuracy in bright sun
  - Accuracy at dusk/night
  + Nerves: hides your face
  + Expectation: cheap, so lowers it a little
```

*(suggestion)* **Loadout**: pick gear before the round. Swapping mid-round costs shot-clock time. Conditions change during a round, so the choice matters, without per-shot micromanagement.

## Critique
- **Fun**: every pickup becomes a small puzzle ("is this worth carrying today?"), and comedic items still pull their weight. It fits the RPG well, since gear is how progression shows.
- **Risk: complexity.** Lots of small conditional modifiers become noise. Keep the number of hooks per item to two or three, and show only the hooks that apply to the current shot in the breakdown.
- **Risk: effects too small to notice.** An item that gives +1% is effectively cosmetic. Each hook should be large enough to change a decision at least sometimes.
- **Risk: micromanagement.** Swapping gear every shot would be tedious. The loadout rule above prevents that.
- **Right challenge?** Yes. It's a planning challenge (read the conditions, build a loadout), which suits a game where you don't control the throw directly.
