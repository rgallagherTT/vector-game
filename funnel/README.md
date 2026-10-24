# FUNNEL — Stage 2: Eat the World

A 3D arcade growth game: you are a tornado. Start as a dust devil eating leaves and finish by eating whole cities on a streamed continent.
Everything is in one self-contained `index.html`. Three.js 0.160 loads from a CDN via an import map; there is no build step and there are no asset files, because every object is generated in code.

**Play:** https://rgallaghertt.github.io/vector-game/funnel/

## What's in it
- **Storm points and upgrades.** Every run earns points, which buy levels in an 11-node upgrade tree. The recommended next upgrade glows.
- **Powers.** There are 8 powers: Lightning, Downburst, Twin, Eye, Firestorm, Hail, Magnetic and Rain Band. You equip two, each has levels, and each map shows hints for them.
- **World map.** There are 9 maps: Pinecrest plus Saltmouth, Dune Sea, Frostpeak, Coral Keys, Funland, Metroplex, Sprocket Works and Launch Coast. Each one has:
  - signature objects and a special rule
  - weather and a theme tune
  - a hidden rare object and a finale moment
  - 3 missions, with stars that unlock further maps
- **Megatiers 10–13.** At these sizes the world merges in layers:
  - At Superstorm, everything on a city block merges into one object.
  - At Megastorm, blocks merge into neighbourhoods that tear out with the ground under them.
  - At Leviathan, you can eat the whole city.
  - At World-Eater, the game switches to Continent mode.
- **Modes.**
  - **Storm Clash:** up to 6 storms, where bigger storms eat smaller ones. There's a leaderboard.
  - **Co-op and versus:** split screen, and co-op storms can merge.
  - **Daily storm:** a random modifier each day.
  - **Weekly challenges.**
  - **Continent:** streamed cities in every map style, research planes, cold fronts and records, with save and resume.
- **Stormpedia.** Over 300 types, each with a 3D thumbnail and a silhouette or hint until found. Rares get a gold frame, completion earns rewards, and new finds get a "NEW!" stamp mid-run.
- **Wardrobe.** Skins, trails, banner styles and wind sounds.
- **Extras.** Highlight replay, photo mode and 50 achievements.
- **Settings.** Quality presets, colour-blind mode, haptics and control remapping.
- **Saves.** Saved in localStorage, falling back to memory if that's unavailable. Saves can be exported and imported.

## Controls
- **Move:** WASD or arrows, hold left mouse, drag on touch, or the gamepad left stick.
- **Surge:** Space.
- **Fling:** F or right mouse.
- **Powers:** Q and E.
- **Pause:** Esc or P.
- **Phone / tablet:** drag anywhere to move (a stick appears under your thumb). The big buttons sit in one thumb cluster: SURGE (it shows its cooldown), FLING (drag it to aim, release to throw), and your two powers. Settings → Touch controls can switch the buttons to the left hand, change their size, turn vibration off, and turn fullscreen off.
- **Player 2 (versus/co-op):** IJKL to move, U to surge, O to fling, Y and H for powers. All keys can be remapped in Settings.

## For Stage 3
- **Code layout.** The file opens with a manifest of `// §ANCHOR` sections. Stage 2 added `§META §UPGRADES §POWERS §MAPS §MAPGEN §MEGATIERS §SCALE §RIVALS §MISSIONS §STORMPEDIA §CONTINENT §SKINS §MODES`.
- **Tuning.** Every tunable number lives in `CONFIG`. Per-map pacing is the `growth` field on each `MAPS` entry.
- **Debug overlay.** `?debug=1` shows FPS, draw calls, triangles, origin and megatier queue state.
- **URL options:**
  - `?map=<id>` and `?mode=clash|coop|versus|daily|continent` jump straight in.
  - `?bench=continent` runs a scripted World-Eater pass across two cities and logs average, p95 and worst frame time.
- **Console helpers:**
  - `dbg.sims(n, 300, mapId)` runs headless bot runs.
  - `dbg.advance(sec)`, `dbg.tier(n)`, `dbg.spawn(id)` and `dbg.grant(points)` are for testing.

## Pacing
These are three headless bot runs per map. Each cell shows the time the bot reached Hypercane (T9).

| Map | T9 reached |
|---|---|
| Pinecrest | 3:51 – 4:36 |
| Saltmouth | 3:20 – 3:42 |
| Dune Sea | 3:01 – 3:35 |
| Frostpeak | 4:12 – 4:28 |
| Coral Keys | 3:00 – 3:43 |
| Funland | 3:29 – 3:33 |
| Sprocket Works | 4:27 |
| Launch Coast | 3:46 |

## Continent performance (World-Eater, 5 cities streamed)
These numbers come from headless CPU-side measurement:
- about 320k triangles drawn
- about 400 draw calls
- about 4.8 ms of simulation per frame

Far cities collapse into one mesh each. Loose objects far below the storm's scale aren't drawn.
