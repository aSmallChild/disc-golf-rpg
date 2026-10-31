---
tags: [core-loop]
status: accepted
related: [shot-types.md, skill-feedback.md, luck.md]
---
# Aimed Shots

Like Fallout 2's aimed shots. The player has no direct control over the throw and instead picks:
- **Target**: a spot on the fairway or a zone on the basket.
- **Shot type**: e.g. spike hyzer (see `shot-types.md`).

Each choice shows a success chance computed from stats, skills, gear, and conditions.

User's notes (added later):
- Tilted camera.
- The player hovers over different parts of the fairway. Regions are selectable.
- Sometimes, depending on skill, **lines** need to be aimed.
- The simulation isn't 100% accurate. Skill, conditions, and gear decide the outcome, not the visuals. If a disc goes through a tree trunk, a dice roll decides whether it kicks or collides, not physics.
- The visuals should still look convincing for what happened (e.g. a bad kick). Ideally there's a genuine collision with the tree, and the game distinguishes trunk from leaves.

*(suggestion)* Basket zones and their trade-offs:
- Centre chains: standard chance, safe.
- Left/right chains: higher chance with a matching hyzer/anhyzer line, risk of spit-out.
- Top band: low chance, fun "lands on top" outcome.
- Pole: low chance, comedic "pole-hole" or bounce-out.
- Bottom of the basket (under the cage): run-up-and-drop "jump putt" style, or a deliberate low safe shot.

*(suggestion)* Fairway targets: the player picks a landing point. The UI shows a scatter ellipse whose size depends on skill, and colours it by risk (water, OB, rough).
