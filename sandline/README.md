# SANDLINE

A long-distance hoverbike rally raid in a single file, `index.html`. It was converted from [BOUNTY RUN](../bounty-run/), which is unchanged. There's no build step. Three.js 0.160 and Rapier 0.12 load from jsDelivr through an import map.

## Run it

Serve the **parent** folder over HTTP: the bikes come from BOUNTY RUN's design pack at `../bounty-run/design/`, and ES modules won't load from `file://`. For example:

```bash
cd vector-game && python3 -m http.server 8080
# open http://localhost:8080/sandline/
```

If the design pack is missing, the game uses procedural bikes. If Rapier can't load, a pure-JS integrator takes over.

## What you do

Enter rallies at **Race Control** in any town. Each stage is a 20–40 km open route: start gate → waypoints → finish arch. There's no track.

- **Navigation.** The **roadbook** (right) lists notes by distance from the start. Each note gives the cap to hold, a tulip diagram and danger marks. Your **trip meter** counts the distance you actually ride, so cutting your own line makes it drift; correct it with `[` and `]`. Waypoints are **WPV** (visible flag, 120 m radius) or **WPM** (hidden, 70 m). Missing one costs 2–3 minutes.
- **Endurance.** Hover-pad heat, thruster wear, sand-filter clogging and impact damage all count. Refuel zones have a 50 km/h limit. Assistance points service the bike while the clock runs. Repair kits fix the bike roadside, up to 70%. Rider focus drains on long stages, at night and in storms.
- **The field.** 30 riders start at 20 s intervals: your five named rivals, three works teams, legendary racers on their own stages, and privateers. Nearby riders are real bikes that kick up dust clouds; distant ones are simulated and show as plumes on the horizon. Live timing ranks everyone by projected finish time, and the radio carries chatter.
- **Career.** Stage results pay prize money and reputation, and accumulate into overall standings for each event. Spend prize money in the Service Park, sign for a team in the Cantina, and beat legends for their cosmetics. A daily stage and best-run ghosts are included.

## URL flags

| Flag | What it does |
|---|---|
| `?debug=1` | Overlay with FPS, logic ms, wear and heat, race state (km, waypoints, trip, focus, dust) and the field (physical / aggregate / finished). Buttons start any stage (F2), jump to the next waypoint (F3), finish now, fire any stage event, and switch the assist level. There are also cheats, time of day, teleports and the parked on-foot walk. |
| `?bench=stage` | Autopiloted run down the Scrapsea Crossing stage, starting mid-field with the field around you. Logs average, p95 and worst frame time, hitches (frames over 50 ms or 2.5× the average), logic ms, draw calls and triangles (`BENCH {...}`). `?dur=N` sets the length in seconds. |
| `?bench=versus` / `storm` | The same benchmark in split screen, or on Black Dunes with a sandstorm crossing the start. |
| `?norender=1` | Logic only, with no rendering, for tests. `&turbo=N` runs N logic steps per frame. |
| `?design=<dir>` | Load design assets from another folder. |

## Controls

W/S throttle and brake · A/D steer · Shift boost · Space drift · C hop · Z/X, mouse wheel or PgUp/PgDn scroll the roadbook · T reset the partial trip · `[` `]` adjust the trip meter · R roadside repair (when stopped) · E interact (hold it to tow a bogged rival, to recover to the line when stuck (+20 s), or with no kits left to call the sweeper) · Y ask the nav drone · M map · Esc pause. In split screen, player 2 uses the arrow keys plus Right Shift, Right Ctrl, `/`, Enter, L, K, `,`, J, 9, 0 and U. Gamepads are supported.

**Assist levels** (Settings):

- **Pro:** the roadbook only.
- **Standard:** cap to the next waypoint inside 800 m, hidden waypoints revealed inside 260 m, off-route warnings, and the trip synced at waypoints.
- **Casual:** adds a waypoint beacon and a route line, and the nav drone flies the line ahead of you.

## Finding your way around the code

There's a manifest at the top of the script. Search for `// §NAME` anchors such as `§ROUTE`, `§ROADBOOK`, `§RACE`, `§FIELD`, `§CALENDAR`, `§EVENTS`, `§WEAR`, `§AI`, `§FLOATING ORIGIN` and `§GHOST`. Every tunable is in the `CONFIG` object. Stage events are data in `STAGE_EVENTS`; add an entry and the stage generator can roll it.

## Saves

The career saves to `localStorage` as `sandline.save.v3`. A BOUNTY RUN save (`bountyrun.save.v2`) can be carried over once from the title screen, and the old save is never modified. The migration converts:

- credits → prize money
- upgrades, paint, decal and frames carry over (sidearm → pad cooling, net launcher → sand filter)
- hunter rank → starting reputation
- legend trophies → frontier-legend cosmetics

Everything else stays behind. Best-run ghosts are stored per stage (`sandline.ghost.<stage>`). Use **Pause → Export save / Import save** to move a career between browsers.

## Design assumptions

The Stage 1 design document wasn't available, so these choices were made from the conversion brief:

- **World size.** The playable area grew to ±24 km so marathon routes can range beyond the five region centres. Terrain far from the centres continues the nearest region. A floating origin re-centres the render world every 1.5 km; physics and logic keep true coordinates.
- **Route generation.**
  - Waypoints come from a seeded walk that wanders while there's distance to spare, then homes in on the finish.
  - The organiser's reference line is an A* path over a 30 m grid. It samples edge midpoints, so it won't bridge slot canyons, and it refuses climbs steeper than about 30°.
  - Refuel zones sit every ~14 km and assistance points every ~11 km.
  - The roadbook is read off the terrain along that line.
- **Terrain changes for rallying.** BOUNTY RUN's Redrock Maze and Ashfall plateaus were a canyon network with sheer walls (good for chases, impassable point to point). In SANDLINE most canyon walls are steep but rideable, and sheer cliffs remain on about a third of their length. Bulldust (fesh-fesh) patches were added on the open flats.
- **Pace model.** The simulated field uses a reference speed per route sample, from surface, slope and turns. It's calibrated against physical AI riders: they average about 47 m/s on a typical stage.
- **Kept scenery.** The monorail runs as scenery and can't be ridden. Team camps replace the old gang hideouts. The walking code is parked behind `?debug=1`.
- **Timing.** During a stage the day runs at 12% speed, so a stage lasts one to two in-game hours instead of half a day.
- **Recovery.** A stuck or crash-looping rider can hold E to be put back on the line for +20 s, like a marshal recovery. Night stages get a headlight.
- **Not in Stage 1.** Multi-day bivouac management and team-orders gameplay are left for later stages.
