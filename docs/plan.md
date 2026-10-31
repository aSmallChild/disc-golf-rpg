# Plan

## Decisions so far
| Topic | Decision |
|---|---|
| Engine | **Three.js** (locked in). |
| UI | **Svelte 5 + Vite** (locked in). No SvelteKit, no SSR. |
| Camera | **Tilted**. **Planned Shot** (working name, inspired by Fallout 2's aimed shots): hover selectable fairway regions, aim lines when skill allows. Costs more action points than a Standard Shot, and is unlocked by skill. |
| Simulation | **Outcome first, visuals second.** Dice decide what happens. Physics only makes it look convincing (section 2a). |
| Art style | **Low detail**, slightly cartoonish shapes (like https://3d-golf-opus.vercel.app/), **real-life muted colours**. |
| Scope order | **Single-player first**, built so multiplayer and bots can be added later (section 4). |
| Saves | **Local only** at first. No hosting until the game is ready. |

## 1. Key architecture decision

Keep the **game simulation separate from rendering**. The simulation is plain TypeScript with no engine imports. It covers:
- terrain data (height, surface, obstacles)
- disc flight and roll
- skill rolls and the feedback breakdown
- character, gear, and skill tree state

Benefits:
- The engine choice stays reversible, which matters while the 2D vs 3D question is open.
- The same code can run later on a Cloudflare Worker, so multiplayer rolls can be server-authoritative.
- Rules can be unit tested without a browser.

The renderer only draws the simulation's state and collects the player's choices (target, shot type, disc).

## 2. Representing terrain and height

The world data is the same whether we render in 2D or 3D. Each hole is made of layers:

| Layer | Data | Used for |
|---|---|---|
| Elevation | Grid of heights in metres (heightmap) | Slopes, roll direction, elevated tees, line-of-sight |
| Surface | Grid of surface types (water, rocky, dry grass, tall grass, ice, ...) | Bounce, skip, roll friction, tombstone chance, finding the disc |
| Obstacles | Objects with position, footprint, and **height** (trunk height, canopy top, density) | Collision and clearance checks for spike hyzers and overhand shots |
| Zones | Polygons for OB, mando, hazard, circle 1/2 | Rules and scoring |

The terrain data is used to work out **what the shot could run into** (obstacles along the chosen line, slopes and surfaces in the landing area). It is not used for a true physics simulation. See 2a.

## 2a. Outcome first, visuals second

The game is not a physics simulation. Skill, gear, stats, conditions, and luck decide the outcome with dice. The 3D scene then **acts out** that outcome convincingly.

### Step 1: resolve (simulation, deterministic, seeded)
1. **Release roll**: clean, early, late, or grip slip. This sets how far the actual line drifts from the aimed line.
2. **Encounters**: obstacles in the flight corridor of the actual line become encounters. Each gets a roll:
   - Tree **canopy** (leaves): pass through, slowed, deflected, or swallowed (drops below).
   - Tree **trunk**: clean miss, kick (good or bad, with a direction), or dead stop.
   - Chance depends on density, shot type (a spike hyzer avoids low canopies), skill, and luck.
3. **Landing**: region and spot, then surface rules (skip, roll, tombstone, sink, lost in tall grass).
4. Output: a list of **events** such as `release:late`, `hit:tree#12:trunk:kick-left`, `land:rough`, `roll:downhill 4m`, `final-lie`. Each event carries its reasons, for the feedback breakdown.

### Step 2: choreograph (renderer side, from the events)
- Build a flight path that passes through each event's contact point. For a trunk hit, the path really touches the trunk cylinder of that tree, on the side facing the disc. For a canopy hit, it enters the canopy volume and then drops or deflects.
- Then the disc continues in the rolled kick direction to the rolled landing spot.
- Shape the curves like real disc flight (hyzer/anhyzer fade, height arc) so they look believable, but the path only has to fit the events, not obey physics.
- Trees are modelled as two simple volumes: a **trunk** (cylinder) and a **canopy** (cone/sphere), each with its own collision tags and effects (bark chip vs leaf burst, different sounds).
- The visual path is generated from the events plus the seed, so replays and multiplayer clients see the same thing.

### Why this split
- The odds stay fully under the game design's control and are explainable in the feedback.
- No edge cases where the physics contradicts the roll.
- Bots and a future server only need step 1. Step 2 is cosmetic.

## 2b. Planned Shot (working name)
- The tilted camera shows the hole. Choosing a Planned Shot highlights **selectable regions** (fairway segments, landing zones, circle 1, basket zones) authored per hole.
- Hovering a region shows its success chance and a short breakdown, like Fallout 2's aimed shots.
- **Lines**: some shots need a line, such as a gap between trees or hyzer around a cluster. The available lines depend on skill: low skill means fewer, wider, riskier options, and higher skill unlocks tighter lines and shot shapes.
- The chosen region + line + shot type + disc becomes the `Action` sent to the simulation.

### Authoring maps
- **Immediate goal: courses are built by hand.** Full generation is a nice-to-have for later (`ideas/course-generation.md`).
- A single **course format** (versioned JSON plus image layers) is the contract. A hand-built course, the editor, and a future generator all produce the same format.
- Per hole, the format holds: heightmap (grey-scale PNG), surface map (colour-coded PNG), obstacles (trees with trunk/canopy sizes, rocks, walls), tee pads, baskets, OB/mando zones, and **hand-drawn aim regions**.
- Step 1: hand-edit the JSON and paint the PNGs in any image editor, with hot reload in the game so changes show up immediately.
- Step 2: an in-game **course editor** (Three.js scene + Svelte panels): sculpt height, paint surfaces, place trees, draw regions, play-test.

## 3. Rendering options (2D vs 3D)

Low detail fits 3D well. A **low-poly, flat-shaded** look shows hills clearly with lighting alone: no textures, trees as simple cones/cylinders, the disc as a coloured puck with a trail. Hills read better in 3D than in any 2D trick.

### 3D options
| Option | Pros | Cons |
|---|---|---|
| **Babylon.js** | TypeScript-native. Built-in heightmap ground, orthographic camera, GUI, picking (click to choose a target on terrain). Full engine. | Larger bundle than Three.js |
| **Three.js** | Huge community, lightweight, flexible | Rendering library only; you assemble the camera, input, and picking yourself |
| **Three.js + react-three-fiber** | Declarative scenes, React for the RPG menus in the same stack | Adds React; more layers to learn |
| **PlayCanvas** | Good web performance, online editor | Editor-centric workflow, less code-first |
| **Godot (web export)** | Full game engine with an editor and good 3D tools | Not TypeScript (GDScript); large web download; simulation can't be shared with a Worker as easily |

### 2D options (for comparison)
| Option | Note |
|---|---|
| **Excalibur / Phaser** | Height shown with contour lines, disc shadow offset, and a side-profile strip. Simpler to build, but slopes are less obvious. |

### Camera ideas for 3D
- Default: top-down or slightly tilted (about 60°) orthographic view, which keeps the Fallout feel.
- Planned Shot: the player clicks a target on the terrain, and the game draws the planned flight line plus a scatter ellipse.
- Replay: the camera follows the disc at a low angle so the player can see why it clipped the tree.
- A side-profile strip in the aim UI is still useful in 3D.

**Leaning**: Three.js + TypeScript + Vite (the same stack as the 3d-golf-opus reference). The user found the Three.js games better to play and look at than the Babylon.js ones.
- The game only needs a heightmap terrain mesh, click-to-target raycasting, an orthographic or tilted camera, flight lines, and instanced trees. Three.js covers all of these. Physics is our own simulation, so a built-in physics engine isn't needed.
- Pin the Three.js version (it ships breaking changes between releases).
- RPG menus go in HTML. The UI framework is still open (plain DOM, Preact, Svelte, or React).
- Suggested next step: render one hole from a heightmap in Three.js with the muted palette.

## 4. Built for multiplayer and bots later

Single-player comes first, but the code follows these rules from day one:
- **Game state is plain data** (serialisable JSON), and the simulation is `nextState = apply(state, action, rng)`. That makes it easy to save, replay, and send over a network.
- **Seeded random numbers**: all rolls come from a seeded RNG stored in the state. Results are reproducible, and a server can own the seed later.
- **Players are controllers**: a human, a bot, and a future remote player all submit the same `Action` objects through one interface. The game loop doesn't know which one it is.
- **A turn queue holds several players** even in single-player, so a bot card-mate works early.
- **Bots** use the same rules and see the same success chances as the player. Bot personalities (cautious, reckless, lucky) choose differently between options.

## 5. Saves (local)
- IndexedDB (or localStorage at first) holds the character, inventory, and course progress.
- The save format has a version number so it can be migrated later.
- Export/import of a save file, which helps with testing and backups.

## 6. Cloudflare hosting (later, when ready)
- **Client**: static build (Vite) deployed with Workers static assets.
- **Multiplayer**: Durable Objects, one per match or tournament round, running the same simulation code. Uses WebSockets for live play and HTTP for async turns.
- **Persistence**: D1 for accounts, characters, and leaderboards.

## 7. Roadmap
1. **Simulation prototype**: one hole as data (heightmap, surfaces, trees with trunk and canopy). A throw resolves into an event list with reasons. Prove spike hyzer over a canopy, a trunk kick, tombstone, and a roll down a slope.
2. **Render spike**: render that hole in Three.js with a tilted camera and the muted palette, then choreograph the event list into a convincing flight path with real tree contact.
3. **Roll system and feedback**: stats, gear, and conditions combined into a chance plus a breakdown, with golf-score skill levels (`ideas/skill-scoring.md`).
4. **Single-player loop**: 9 holes, a bot card-mate, disc loss, money, game over, local saves.
5. **Course editor**: in-game editing of height, surfaces, trees, and regions, with play-testing.
6. **Skill tree and gear**: after the ideas review.
7. **Deploy** to Cloudflare.
8. **Multiplayer**: async first, then live.
9. **Tournaments**.
10. *(Nice-to-have)* **Course generation**.

## Open questions
- None right now.
