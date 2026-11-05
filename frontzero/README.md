# FRONT ZERO

A near-future tactical combined-arms shooter in one HTML file, built from BOUNTY RUN and SANDLINE. Everything here is original: invented nations, factions, operators, weapons and vehicles. Soldiers fall and fade, with no blood, and there are no civilians on the battlefield.

```
cd frontzero
npx serve .          # then open the printed URL
```

The page loads `data/*.json` over HTTP, so opening `index.html` straight from disk will not work. The optional speeder-bike and drone models come from `../bounty-run/design`. Without them the game falls back to procedural models. Serving the repo root (`npx serve .` one level up) and opening `/frontzero/` gives you those models.

## Modes

| Mode | What it is |
|---|---|
| **Warfare** | 32 v 32 combined arms on the large maps. **Breakthrough**: attackers push through sectors, defenders spend tickets, and some sectors have destructible objectives (Greywood's dam floods the valley). **Conquest**: hold flags to bleed the enemy's tickets. You can spawn at base, objectives, squadmates, mobile-spawn vehicles and squad beacons. Squad leaders give orders (U) and commanders call artillery, supply drops, UAV sweeps and mech drops (O). |
| **Extraction** | Pick a map and a kit, drop in, loot, and reach an exit. You lose everything you carried if you die. Rival bot crews loot the same map and every map has a boss. There are five kinds of exit: open, timed, flare (call a pickup), key-locked and guarded. Raids also have random events: supply drops, armoured convoys, storms and bounties. Between raids you get a stash grid, a raid bag sized by your rig and backpack, three traders with reputation, a drifting market, insurance, contracts, base upgrades and crafting. |
| **Campaign** | The Accord vs the Iron Mandate: eight missions across six nations, with briefings on a world map, checkpoints and debriefs. Play solo with an AI squad (they follow, revive and ride with you) or in split-screen co-op. |
| **Quick match** | Team deathmatch and domination on each map's close-quarters area. |
| **Firing range + vehicle training** | Targets at measured ranges, plus ground, walker, air, jet and sea courses. |

## Controls (keyboard + mouse; gamepad and a second keyboard player are supported)

WASD move · Shift sprint / hold breath when scoped · Space jump, mantle, vault (in the air: wingsuit, then parachute) · C / Ctrl crouch (sprint + C slides) · Z prone · Q / E lean · LMB / RMB fire / aim · R reload · B fire mode · V melee · 1–0 weapon slots (main, pistol, launcher, 7 extra) · G throw, K cycle · Y grappling hook · F interact (revive, loot, enter vehicles, rappel from edges) · X gadget · N class tool · T ultimate · H / J heal / stim · \` or MMB ping · L thermal vision · U squad orders · O commander · M map · Tab scoreboard · I inventory (extraction) · Esc pause.

On phones and tablets the game shows touch controls automatically: drag the left side to move (push to the edge to sprint), drag the right side to look, and use the thumb buttons. Add `?touch=1` to force them on or `?touch=0` to hide them.

Vehicles: W/S throttle, A/D steer, mouse aims the turret, Space hops (speeders) or climbs (VTOLs), Ctrl descends, Shift boosts, mouse wheel switches vehicle weapons, X fires countermeasures, number keys change seat, V toggles the camera, and F gets out (from height you get a parachute; in a dropship's passenger seat it rappels).

## Content

- **8 operators**, each with a gadget, a class tool and an ultimate: Kestrel (jetpack), Ironside (deployable shield), Rivet (repair, mines), Bastion (heavy armour), Mercy-6 (revives, healing), Quartermaster (resupply), Wren (grapple, recon drone), Ghost (cloak). Operators level up and unlock gear.
- **24 weapons**: 4 assault rifles, 2 battle rifles, 3 SMGs, 2 LMGs, 2 DMRs, 3 sniper rifles, 2 shotguns, 3 pistols, 3 launchers. They have 29 attachments (including thermal and night vision), several ammo types per caliber, gunsmith blueprints and camos. Biome camos make you harder for the AI to spot in their biome.
- **Ballistics**: projectile travel and drop, penetration by material, body-part damage, armour and helmet tiers with durability.
- **7 biomes** (desert, jungle, arctic, temperate, urban, coastal, mountain). Weather affects visibility, footsteps and handling.
- **6 countries × 3 maps** (18 battlefields) (`data/maps/*.json`), each with sectors, points of interest, vehicle pads, exits and time/weather variants. Destruction covers walls up to bridges, towers, the dam and the freighter.
- **19 vehicles**: the four SANDLINE speeders (bike, quad, buggy, hauler), hover tank, APC, artillery skiff, assault mech, exo-suit, VTOL gunship and dropship, interceptor, strike fighter, patrol boat, assault hovercraft, snow sled and three drones. All have part damage, repair, lock-on and flares, EMP, hijacking, seats and bail-out.

Content lives in `data/` as JSON. Code lives in `index.html`, generated from `src/parts/` by `src/assemble.sh`.

## 10 weapon slots

You carry up to ten guns: main gun, pistol, launcher and seven extra slots. Fill the extra slots on the loadout screen with any gun you own. Keys 1 to 0 pick a slot, the mouse wheel or SWAP button cycles through them, and special weapons from chests drop into the first free slot. Guns in your extra slots only add a fifth of their weight while holstered.

## New maps

Sunspire (desert tower city), Mangrove (jungle river delta with stilt villages), Frostline (glacier radar station above a frozen lake), Vinehollow (vineyards and a hilltop château), Neon Docks (night-time port city) and Saltpan (open salt flats for vehicle battles).

## Supply chests, thermal scan, team colours

- **Supply chests** glow with a gold light beam and are mostly hidden inside buildings: four in close-quarters modes, fourteen across Warfare maps, seven along a campaign mission and three per extraction raid. Hold interact on one to crack it. It holds a special weapon (Tempest minigun, Lance railgun, Havoc auto-shotgun, Gold Viper hand cannon, Specter suppressed SMG or Hydra rocket pod), tier-6 armour, a full resupply or a charged ultimate. Opened chests reappear somewhere else after a while.
- **Thermal scan**: whenever you aim down sights, every soldier in view is bracketed, red for enemies and blue for friends, with the distance. It works through smoke and foliage but not through walls. L (or THERM on touch) switches full thermal vision on with any weapon.
- **Scopes** show the lens, a mil reticle with holdover marks, a rangefinder, time of flight, heading, rounds in the magazine and a breath bar.
- **Team colours**: every soldier's visor, armband and backpack glow in their team colour (blue for the Accord, red for the Mandate, orange for rival crews). Friendlies carry blue name tags, and the crosshair turns red over an enemy and blue over a friend.
- Every house has a doorstep you can walk up and stairs to its upper floors and flat roofs.

## Debug and benchmarks

- `?debug=1`: overlay with frame and logic timings, draw calls, AI states and position. F2–F10 toggle squad/vehicle/hitbox/loot/spawn/gear/weather/time/kill helpers.
- `?quick=warfare|conquest|tdm|dom|range|training|extraction|campaign&map=<id>`: skip the menus (`&m=<0-7>` picks a campaign mission).
- `?bench=firefight`: 12 v 12 on one map per biome. `?bench=warfare`: 32 v 32 with every vehicle on the largest Breakthrough map. Add `&dur=<seconds>`, and `&size=24` for 24 v 24. Each bench logs average, p95 and worst frame time, logic time and draw calls to the console and on screen.

See `BENCH.md` for the numbers measured while building this.

## Saves

The save lives in `localStorage` (with an in-memory fallback), and Settings can export and import it as text. On first run, an existing BOUNTY RUN save can be imported: its credits become starting credits and its paint jobs become vehicle camos.
