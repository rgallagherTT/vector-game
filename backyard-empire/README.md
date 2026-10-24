# BACKYARD EMPIRE

Command an ant colony in a backyard — then the whole neighbourhood. A single self-contained `index.html` (Three.js from CDN via an import map, no build step, all art procedural).

- **Stage 1 — the colony:** a data-oriented swarm engine (typed arrays, spatial grid, think-LOD, 30 Hz fixed step with interpolated rendering), emergent pheromone trails (food / home / alarm / war fields that evaporate and diffuse), instanced ants with a vertex-shader tripod gait, a macro backyard with tilt-shift depth of field and day/night, a glass ant-farm nest you dig, queen and brood, castes, aphid herding, command markers, possession, war and raids on the red ants, disasters (rain, lawnmower, footsteps, hose, juice) and other creatures.
- **Stage 2 — the neighbourhood:** eight yards on a campaign map with aggregate off-screen simulation, trade trails and expeditions; five rival colonies (Red Legion, Weavers, Fire Court, Harvesters, Termite Mound) with truces; five playable species (black garden, leafcutter with fungus gardens, nomadic army ants, weaver, fire); nuptial flights; an evolution tree that changes stats and looks; nine giant bosses; seasons with winter hibernation; more disasters; Campaign, Skirmish, Two-player split screen, Survival and Documentary modes; photo mode, replays, colony history.

`index.html` starts with a manifest of `// §ANCHOR` sections and a `CONFIG` object with every tunable.

## Controls

Right-drag or WASD pan · wheel zoom · middle-drag or Q/E rotate · click an ant to possess it (W/S/A/D, Space to act, R to rally) · Tab nest view · 1–6 command markers (nest view: 1–9 dig and chamber tools) · P scent view · C cinematic camera · M neighbourhood map · F photo mode · Space pause · [ ] speed.

## Debug and benchmarks

- `?debug=1` — overlay (FPS, ant count, sim time per tick, pheromone stats) and Shift+key spawns: A ants, F food, E enemies, R rain, M mower, T footsteps, H hose, J juice, B blower, P pest control, K kids, D dog, Q barbecue, S spider, G boss, L nuptial flight, N next season, V evolution points, W worm, U bird, C critters, O drought, I frost.
- `?bench=swarm` (10,000 ants per colony), `?bench=forage` (5,000 foragers), `?bench=war` (four colonies × 5,000). Each logs average/worst frame time and sim tick time over 30 seconds (`BENCH_RESULT` in the console).

Saves use `localStorage` (Save panel), with export/import as JSON.
