# FRONT ZERO — Milestone 0 audit

FRONT ZERO is built from BOUNTY RUN (`../bounty-run/index.html`) and SANDLINE (`../sandline/`). Both stay untouched on `main`; all work is on the `frontzero` branch, in this folder.

Every section in BOUNTY RUN's manifest is classified below.

| BOUNTY RUN section | Verdict | Becomes in FRONT ZERO |
|---|---|---|
| §CONFIG | **Convert** | One `CONFIG` object for engine tunables (movement, ballistics, AI, vehicles, render). Content moves to `data/*.json`. |
| §UTIL | **Keep** | Math helpers, seeded RNG, simplex/fbm/ridged noise, canvas helpers. |
| §ASSETS / §MODELS | **Keep** | Optional design pack. The bike GLBs become the speeder bike, `pip.glb` becomes Wren's recon drone. Everything has a procedural fallback. |
| §AUDIO | **Convert** | Synthesised gunfire with per-biome acoustics (canyon echo, jungle damping, city reverb), distance delay and falloff. Vehicle engines (hover whine, tank rumble, rotor thump, mech steps), radio static, an adaptive regional score. |
| §INPUT | **Convert** | First-person bindings (mouse look with pointer lock), gamepad layout, and a second split-screen player. |
| §PHYS (Rapier wrapper) | **Convert, partly rewritten** | Rapier is dropped. A first-person shooter needs capsule movement, mantle/vault probes and thousands of ray casts per second against walls with materials (penetration, destruction). A purpose-built oriented-box and cylinder world (`§COL`) is simpler and faster than wrapping Rapier for that. BOUNTY RUN's pure-JS rigid-body integrator (`FBody`) is kept and drives every vehicle. |
| §TERRAIN | **Convert** | Foundation of the biome system. Each map bakes its heightfield, surface, water and biome grids from `data/biomes.json` plus the map's JSON. |
| §REGIONS | **Convert** | The five desert regions become seven data-driven biome generators: desert, jungle, arctic, temperate forest, urban, coastal, mountain. |
| §LANDMARKS | **Convert** | Map *sites* and *structures*: towns, compounds, stations, temples, ports, dams, bridges, towers, cable cars, wrecks. The crashed ship becomes Shipgrave's wreck field. Canyons become Redcut. |
| §RENDER | **Convert** | Chunked terrain with LOD rings is kept. Sky, day cycle and post-processing are kept, with thermal, night-vision, scope, flash and damage passes added. Instanced props become biome props. |
| §TOWN | **Convert** | Procedural buildings made of destructible wall panels: adobe, wood, concrete, metal, glass. Dustwater is Kharavan's frontier town. |
| §MONORAIL | **Convert** | Moving-platform code is reused for Highpass's cable car. |
| §FX | **Keep + extend** | Particles, decals and debris are kept. Muzzle flashes, tracers, surface-matched impacts, smoke volumes that block sight, and explosions are added. No blood decals. |
| §HOVER | **Convert** | Foundation of every ground and sea vehicle: hover springs, drive, drift, boost and jumps, tuned per vehicle. |
| §BIKE | **Port** | SANDLINE's hoverbike, with its tuning, model, liveries, part wear and sounds, becomes the speeder bike. The quad, buggy and hauler are built on the same hover core with SANDLINE-style tuning. Part wear becomes vehicle part damage. |
| §RIDER | **Convert** | Procedural soldier body, drawn with instanced parts (one draw per part for every soldier on the map) and posed from keyframe tables. |
| §CAMERA | **Convert** | First-person on foot. The chase camera is kept for vehicles. |
| §WEAPONS (sidearm, auto-aim, hitscan) | **Convert** | Ballistic weapon system: projectile travel and drop, penetration, body parts, armour tiers, attachments, ammo types. Auto-aim is removed. |
| §NET (net launcher + cloth) | **Remove / Keep cloth** | The net launcher is removed. The verlet cloth is kept for flags, tarps, parachutes and camouflage netting. |
| §TRICKS / §TRICKS2 | **Convert** | Data-driven **mission event system**: campaign steps and triggers, and extraction events (supply drop, storm, boss patrol, extraction closing early). |
| §AI (outlaw chase) | **Convert** | Soldier AI: terrain-reading navigation (coarse and fine A* over the map grid), cover, perception affected by weather and camo, squad tactics, vehicle crews, gadget use, four difficulty levels. |
| §BOUNTY / §BOUNTYGEN | **Convert** | Extraction **contracts** from traders. |
| §LEGENDS | **Convert** | Elite **bosses** in extraction, and named **commanders** in the campaign. |
| §HUNT | **Convert** | Extraction raid lifecycle: deploy, loot, contracts, extraction points, death and loss. |
| §RIVALS | **Convert** | Rival **bot operator squads** in extraction, which loot, fight and hunt the player. |
| §GANGS | **Convert** | The two alliances (the Accord and the Iron Mandate), and the enemy forces guarding points of interest. |
| §COMPANION (Pip) | **Convert** | Wren's **recon drone**. Its scan becomes marking enemies, and its swarm is Wren's ultimate. |
| §FRONTIER (weather, events) | **Convert** | **Weather per biome**: rain, snow, blizzards, fog, monsoon, sandstorms, night. Weather changes play: vision, sound masking, footing. |
| Wanted posters | **Remove** | — |
| §ONFOOT | **Convert** | Folded into the first-person soldier controller. |
| §COOP | **Keep** | Split-screen co-op (two players) in every mode. |
| §HUD | **Convert** | Tactical HUD: health and armour, ammo and fire mode, compass, minimap, squad, objectives, tickets, hit markers, damage direction, kill feed, pings, gadget and ultimate meters, vehicle HUD. |
| §UI | **Convert** | Garage → **armoury** (operators, gunsmith, camos). Store → **market** and **traders**. Saloon → **stash and base**. Map → **world map** and deploy map. |
| §SAVE | **Convert** | Account, operators, weapons, blueprints, stash, extraction economy, campaign, challenges. BOUNTY RUN credits become starting credits and paint jobs become vehicle camos. Everything else is dropped. |
| §ACHIEVE | **Convert** | **Challenges** tied to classes, biomes, vehicles and extraction. |
| §DEBUG | **Convert** | `?debug=1`: FPS, draw calls, AI states, hitboxes, spawns, biome, loot tables, and keys to spawn squads, vehicles and loot, give gear, and change weather. |
| §BENCH | **Convert** | `?bench=firefight` (12 versus 12 on a map from every biome) and `?bench=warfare` (32 versus 32 with every vehicle type). |
| §MAIN | **Convert** | Boot (data loading), mode lifecycle, fixed-step loop. |

## New systems

| New section | What it is |
|---|---|
| §COL | Collision world: oriented boxes, cylinders and ramps in a spatial hash. Ray casts with materials, ground and ceiling queries, capsule movement. |
| §BUILD | Biome building kits, destructible wall panels, large structures (tower, bridge, dam, radar), cover points. |
| §FOLIAGE | Instanced vegetation with wind and distant impostors. Foliage density blocks AI sight. |
| §SOLDIER | Movement (prone, lean, slide, mantle, vault, swim), grappling hook, rappelling, parachute and wingsuit, stamina, health, downed state and revives. |
| §VIEWMODEL | First-person arms and weapons built from attachments, with keyframe animation tables. |
| §OPERATORS | Eight operators with signature gadgets, class tools and ultimates, plus deployables and drones. |
| §VEHICLES | The full roster: speeders, armour, walkers, air, sea, snow and drones. Seats, weapons, lock-ons, part damage and repair. |
| §WARFARE | Breakthrough and Conquest: 32 versus 32, squads, orders, spawning options, commander support, destructible objectives. |
| §EXTRACTION | The raid mode and its economy: stash grid, traders, market, insurance, base upgrades, crafting. |
| §CAMPAIGN | Eight missions on the world map, built from the mission event system, with checkpoints and debriefs. |
| §MODES | Team deathmatch, domination, the firing range and vehicle training. |

## Content files (`data/`)

`biomes.json`, `countries.json`, `maps/*.json` (twelve maps), `operators.json`, `weapons.json`, `attachments.json`, `items.json`, `vehicles.json`, `missions.json`, `traders.json`, `contracts.json`, `challenges.json`.

## Rewrites

- **Physics.** Rapier is replaced by §COL, as explained in the §PHYS row above.
- **Rider.** BOUNTY RUN's rider was a scene-graph puppet, which would mean about 15 draw calls per soldier. With 64 soldiers on the map that cost is too high, so soldiers are drawn as instanced parts instead.

Everything else is converted from the existing code.
