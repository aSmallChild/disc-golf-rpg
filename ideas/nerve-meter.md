---
tags: [overarching-mechanic]
status: accepted
related: [luck.md, tilt-anger.md, character-stats.md, skill-scoring.md, shot-clock.md, tournaments.md, gear-chalk-bag.md, item-design-principle.md, gear-sunglasses.md, gear-hat.md]
---
# Nerve Meter

An overarching mechanic, similar to luck. Nerves rise with pressure and affect every shot.

## User's notes
Increases nerves:
- Lots of consecutive birdies or good shots, as you approach a record or a tournament win.
- Coverage (being filmed).
- Long putts.
- Shots toward OB, and putts downhill or uphill.
- Spectators.
- Missing an important putt.

Decreases nerves:
- Making an important putt.
- Sunglasses (people can't see your face), hat.
- Low quality or cheap gear (more humbling, so people won't expect as much from you).
- **Layups and safe shots**: they actively reduce nerves and also **stem the flow** (stop nerves from building).

Casual rounds have low nerves.

Added later:
- **Composure** is an attribute (a player trait), not a skill. The more composure you have, the better you manage nerves. Skills are affected by composure.
- There should be **skills that tie into these mechanics** to improve your composure.

## Suggestions
*(suggestion)* **One driver underneath: expectation × stakes.**
- **Expectation**: what people think you should do. Raised by reputation, expensive gear, a hot streak, record pace. Lowered by cheap gear, a bad reputation, being the underdog.
- **Stakes**: what the shot is worth. Raised by tournament round, final holes, being close to a record, coverage (filming), spectators, OB nearby, putt length and slope.
- Nerve for a shot = baseline + expectation × stakes, reduced by **Composure** (attribute), gear, and skills.
- This explains all of the user's sources with one rule, and the breakdown can show both parts.

*(suggestion)* **Effects: nerves change variance, not just the chance.**
- High nerves widen the aim scatter ellipse and make the VATS reticle **shake** on screen. The player sees nerves before throwing.
- Some upside: adrenaline adds a little distance on drives, but costs precision on putts and approaches. That makes nerves a trade-off instead of a pure penalty.
- Special outcomes at the extremes: **choke** (very high nerves on a putt) and **clutch** (making a high-nerve putt gives a big nerve drop and a small luck bonus for the next shot).

*(suggestion)* **Counters:**
- Gear: sunglasses, hat (user), gum, a lucky towel, a cheap "starter" disc that lowers expectation. Every item has several hooks (`item-design-principle.md`).
- Actions: a **pre-shot routine** or deep breath that lowers nerves but uses shot-clock time (`shot-clock.md`).
- Shot choice *(confirmed)*: layups and safe shots lower nerves and stop them building. Staying calm forever through safe play is fine, because it isn't a winning strategy: by not taking risks, your competitors get ahead of you.

*(suggestion)* **Composure skills** (all scale with the Composure attribute):
- **Ice in the Veins**: stakes count for less.
- **Camera Ready**: coverage stops counting (low levels: it counts half).
- **Underdog**: a bonus while expectation is low.
- **Tunnel Vision**: spectators stop counting.
- **Next Shot Only**: a streak stops raising nerves.
- **Clutch**: making a high-nerve putt gives a bigger nerve drop.
- **Breathing Routine**: the pre-shot routine works better and uses less shot-clock time.

*(suggestion)* **Golf scoring**: composure skills start above par, as in `skill-scoring.md`. At triple bogey even moderate pressure shows.

## Critique
**What makes it fun**
- It creates a natural tension arc. A round gets harder exactly when it gets exciting (a streak, the last holes, a record), which is where drama belongs.
- It gives cosmetic gear (hat, sunglasses) a real reason to exist.
- Cheap gear lowering nerves is funny and fits the tone. It also creates a good choice: better discs versus lower expectations.
- It fits progression well. A new player plays casual rounds with almost no nerves, so the mechanic appears on its own once they start doing well. It doesn't need a tutorial.
- Nerves visible in the VATS shake and the breakdown make it a challenge the player can plan around.

**Risks**
- **Punishing success.** If nerves are too strong, doing well feels bad (rubber-banding). Keep the effect moderate, mostly on variance, and always offer a counter. The player should feel pressure, not feel robbed.
- **Death spiral.** Missing an important putt raises nerves, which causes more misses. The clutch rule, the pre-shot routine, and a nerve cap break the spiral.
- **Cheap gear exploit.** If cheap gear lowers nerves too much, the best strategy is to play with junk. Make it a small bonus that shrinks as your reputation grows. Once you're famous, nobody believes the cheap-disc act.
- **Overlap with tilt**: resolved. Nerves are pressure before the shot, tilt is frustration after, and the Composure attribute resists both (`tilt-anger.md`).
- **Name clash**: resolved. The stat is now **Composure** and "nerves" is the meter.
- **Layup loophole**: not a problem (user). Safe play keeps you calm but costs strokes, and competitors pull ahead. The balancing force is the competition, so bots and opponents must reward risk-taking enough that playing safe every shot loses tournaments.
- **Too many meters.** Luck, nerve, tilt, stamina, and the shot clock all compete for attention. Show only the ones that matter for the current shot in the breakdown.

**Right sort of challenge?** Yes. It challenges decision-making (go for it or lay up, spend time on a routine, which gear to wear) rather than reflexes, which suits an RPG with indirect control. It's the right challenge as long as the player can always see the nerve level and the reasons before choosing a shot.
