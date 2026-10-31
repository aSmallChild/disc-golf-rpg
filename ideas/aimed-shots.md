---
tags: [core-loop]
status: accepted
related: [shot-types.md, skill-feedback.md, luck.md, shot-clock.md, skill-tree.md]
---
# Aimed Shots: Standard Shot and Planned Shot

Two actions: **Standard Shot** and **Planned Shot**.

**Naming (decided):** "Planned Shot" is the official name under the hood (code, docs, data: `planned`). The name players see is **"Big Brained Shot"**.

Like Fallout 2's aimed shots. The player has no direct control over the throw and instead picks:
- **Target**: a spot on the fairway or a zone on the basket.
- **Shot type**: e.g. spike hyzer (see `shot-types.md`).

Each choice shows a success chance computed from stats, skills, gear, and conditions.

## User's notes
- A **Planned Shot uses more action points than a Standard Shot** (see `shot-clock.md`).
- A Planned Shot **needs to be unlocked**, or relies on a level of skill.
- It might be unlocked separately by skills for **putts, upshots, and drives**, told apart by distance.
- **The beginner starts with no Planned Shots unlocked.** For play-testing, a testing profile has every Planned Shot and line unlocked until the skill tree exists (2026-11-01).
- Tilted camera.
- The player hovers over different parts of the fairway. Regions are selectable.
- Sometimes, depending on skill, **lines** need to be aimed.
- The simulation isn't 100% accurate. Skill, conditions, and gear decide the outcome, not the visuals. If a disc goes through a tree trunk, a dice roll decides whether it kicks or collides, not physics.
- The visuals should still look convincing for what happened (e.g. a bad kick). Ideally there's a genuine collision with the tree, and the game distinguishes trunk from leaves.

## Suggestions
*(suggestion)* **Standard Shot vs Planned Shot**
- Standard Shot: pick a target point and shot type, and throw. Cheap in action points. No region breakdown, and a wider scatter. Always available.
- Planned Shot: costs more action points. Unlocks hoverable regions with their chance and reasons, aim lines (by skill), basket zones when putting, and a tighter scatter.

*(suggestion)* **Three unlocks by distance**, each in its own branch of the skill tree:
| Unlock | Distance | What planning gives you |
|---|---|---|
| Planned Putt | Inside circle 1 (≤ 10 m) | Pick a basket zone (centre chains, left/right chains, band, pole, lay up) |
| Planned Upshot | 10 m to about 80 m | Pick a landing region around the basket, and a line to it |
| Planned Drive | Beyond about 80 m | Pick a fairway region, a line (straight, hyzer, anhyzer), and the shot shape |

- Putting is unlocked first, at an easy skill level (e.g. Putting reaches Bogey from the starting Double bogey). New players get a taste of planning early. *(The beginner having none unlocked at the start is decided; this would be the first unlock.)*
- Each one improves with its skill: more regions, more lines, smaller scatter.
- The circle 2 zone (10–20 m) could count as upshot or putt. Decide during review.

*(suggestion)* Basket zones and their trade-offs:
- Centre chains: standard chance, safe.
- Left/right chains: higher chance with a matching hyzer/anhyzer line, risk of spit-out.
- Top band: low chance, fun "lands on top" outcome.
- Pole: low chance, comedic "pole-hole" or bounce-out.
- Bottom of the basket (under the cage): run-up-and-drop "jump putt" style, or a deliberate low safe shot.

*(suggestion)* Fairway targets: the player picks a landing point. The UI shows a scatter ellipse whose size depends on skill, and colours it by risk (water, OB, rough).

*(suggestion, now decided: "Big Brained Shot" for players)* **Other names considered**:
- **Planned Shot**: the user's pick. Clear and friendly.
- **Aimed Shot**: the closest to the original idea.
- **Careful Shot**: says what it costs (time) and what it gives (care).
- **Proper Shot**: funny, as if the standard one wasn't.
- **Try-Hard Shot**: jokey, suits the not-too-serious tone.
- **Overthought Shot**: jokey, and fits the nerve meter if overthinking can backfire.
- **Big Brain Shot**: very jokey, best as a skill name rather than the action.
