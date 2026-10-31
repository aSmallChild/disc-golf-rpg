---
inclusion: always
---
# Product: Disc Golf RPG

Web-based, top-down, not-too-serious disc golf RPG. Hosted on the user's website via Cloudflare.

## Core pillars
- **Indirect control**: the player picks intent (target point, shot type, disc), the character's stats/skills/gear decide the outcome. Inspired by Fallout 2 aimed shots (VATS-like targeting of fairway spots or basket zones).
- **Skill tree**: skills improve chances or unlock abilities; skills unlock other skills.
- **Character stats**: Fallout SPECIAL-style, but disc-golf themed (see `ideas/character-stats.md`).
- **Luck is central**: both an attribute and a skill (concentrated luck, flukes).
- **Gear-driven**: each gear item (chalk bag, retriever stick, etc.) boosts specific chances. Higher skill = fewer negatives, bigger benefits.
- **Transparent feedback**: every skill roll reports why it succeeded or failed.
- **Dice over physics**: outcomes come from rolls, not physics. The visuals act out the roll convincingly (e.g. a bad trunk kick that really touches the trunk).
- **Conditions matter**: weather (wind, rain, snow) and ground (water, rocky, dry grass, tall grass, ice) change disc behaviour.
- **Stakes**: lost discs are gone. No discs and no money = game over.
- **Skills use golf scoring**: they start above par (bad), and good skill is below par. The start must be survivable but clearly bad, and gear can backfire at low skill. See `ideas/skill-scoring.md`.
- **Low detail look**: only enough to show the terrain and the throw.
- **Tournaments, multiplayer, and bots** (multiplayer comes later, but design for it now).

## Where things live
- `todo.md` – user's original brain dump (source of truth for intent).
- `ideas/` – one idea per file, for later tagging/categorising with the user. See `ideas/README.md`.
- `docs/plan.md` – tech options and roadmap.
- `.kiro/steering/` – persistent AI instructions.
