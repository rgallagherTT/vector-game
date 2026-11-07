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

WASD move · Shift sprint / hold breath when scoped · Space jump, mantle, vault (in the air: wingsuit, then parachute) · C / Ctrl crouch (sprint + C slides) · Z prone · Q / E lean · LMB / RMB fire / aim (release RMB to fire) · R reload · B fire mode · V melee · 1–0 weapon slots (main, pistol, launcher, 7 extra) · G throw, K cycle · Y grappling hook · F interact (revive, loot, enter vehicles, rappel from edges) · X gadget · N class tool · T ultimate · H / J heal / stim · \` or MMB ping · L thermal (TI) · P night vision (NV) · U squad orders · O commander · M map · Tab scoreboard · I inventory (extraction) · Esc pause.

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

## Online co-op (up to 4 devices)

Online co-op works the same way as Brawler and SANDLINE. Pick **Online co-op** on the title screen and share the room link. Whoever opens the link first hosts, and everyone else joins the lobby. Phones, tablets and laptops can mix.

- **The host** chooses the match: Warfare Breakthrough or Conquest, team deathmatch, domination or a campaign mission, plus the map and the number of bots. Everyone fights on the Accord side against the host's bots.
- **Your device** runs your own soldier: movement, aim and shots. Your hits on bots go to the host. Hits on you, reviving each other, vehicles, chests and pings all sync between devices.
- **Vehicles:** get in any vehicle and you drive or gun it. The host's device simulates it from your controls.
- **Leaving:** if the host quits, everyone goes back to the lobby.

Devices connect directly (WebRTC). The free PeerJS broker only introduces them. Some strict networks (school or corporate) block WebRTC, and a phone hotspot usually gets around that. `?broker=host:port` points at a self-hosted PeerJS server instead. **Extraction raids work online too.** Everyone brings their own kit (or a free kit) from their own stash and keeps what they extract. The map, loot spots and exits are identical on every device, and whoever opens a crate or body first gets its contents. Each player extracts on their own; the raid carries on until the last one is out, or the host leaves (anyone still inside comes out with their gear). Flares, supply drops, storms and radio calls reach everyone.

## Split-screen

Turn on split-screen co-op in Settings. Player 2 uses a gamepad, or the right-hand keyboard block when no pad is connected: arrows move, the numpad looks and Num0 fires. The screen splits in two, each half with its own compact HUD.

## Night vision and thermal

L switches thermal (TI) on or off and P switches night vision (NV), with any weapon; on touch screens there are separate TI and NV buttons. Thermal and night-vision optics still switch on automatically when you aim through them.

## Futuristic weapons

Twelve futuristic weapons sit alongside the conventional ones (buy them on the loadout screen):

- **Energy weapons:** Pulse AR-9, Arclight Beam LMG, Ion SMG, Tesla Arc Pistol and the Scatter Laser shotgun. They run on rechargeable power cells, so they never need ammo. Their magazines refill when you stop firing.
- **Gauss and coil rifles:** Helix Coil Rifle, Gravlance DMR and the Wraith Gauss Sniper. Their rounds have no bullet drop and go through cover.
- **Nova Plasma Caster:** lobs glowing plasma bolts that burst on impact.
- **Mantis Smart Pistol:** its rounds curve onto the nearest enemy in front of you.
- **Vector Flechette Rifle:** armour-piercing burst darts.
- **Striker Swarm Launcher:** three guided micro-missiles that follow your aim.

Each fires coloured beams and has glowing coils and trim.

## Scope and shoot on a laptop

Hold right-click to scope in and let go to fire. This works even on a trackpad that can't hold two buttons at once. If you already fired while scoped (left-click as usual), letting go doesn't fire again. You can turn it off in Settings ("Release right-click to fire"). On touch screens the SCOPE button does the same: hold to aim, release to shoot. The small AIM button still toggles aiming.

## 10 weapon slots

You carry up to ten guns: main gun, pistol, launcher and seven extra slots. Fill the extra slots on the loadout screen with any gun you own. Keys 1 to 0 pick a slot, the mouse wheel or SWAP button cycles through them, and special weapons from chests drop into the first free slot. Guns in your extra slots only add a fifth of their weight while holstered.

## New maps

Sunspire (desert tower city), Mangrove (jungle river delta with stilt villages), Frostline (glacier radar station above a frozen lake), Vinehollow (vineyards and a hilltop château), Neon Docks (night-time port city) and Saltpan (open salt flats for vehicle battles).

## Art kit

`design/` holds the FRONT ZERO art kit as GLB models and SVG icons. It loads at start-up, and the game falls back to its procedural models for anything missing (or for everything with `?nokit=1`).

- **Soldiers:** every bot and player uses the kit's soldier. The body is cut at the joints into the same limbs the animation system already moves, so it stays one draw per body part. Accord troops wear the Accord helmet, vest and pack with blue stripes, and the Mandate and rival crews wear the Mandate kit with red or orange stripes. Uniforms take the map's camo pattern.
- **Operators and bosses:** the loadout screen shows each operator's own model holding the chosen gun. Raid bosses wear one of the three boss models (Warden, Viper, Matriarch), and in split-screen or online you see the other humans as their operators.
- **Weapons:** the 24 standard guns use the kit models in first person, in your hands and in the gunsmith. Kit optics (3x, 8x, thermal), suppressors, compensators, flash hiders, grips, lasers and lights fit the guns' sockets. Red dots and holo sights keep an open frame so you can see through them. The game keeps its own weapon names: for example, the Harrow AR-7 uses the AR-7 Talon model and the Viper P9 uses the P9 Sentry model. The special and futuristic guns keep their glowing procedural models.
- **Vehicles:** the hover tank, APC, speeder buggy, hover-bike interceptor, VTOL gunship, VTOL dropship and strike fighter use the kit models. Their turrets, mounts and rotors still move, and their stripes show the team colour.
- **Gadgets and loot:** the shield wall, cover, sentry turret, sticky mine, healing drone, ammo crate and recon drone use kit models. So do grenades and C4, supply chests, raid crates (coloured by tier), ammo boxes, med kits, air drops and capture points.
- **Menus and HUD:** weapon silhouettes on the loadout and in the kill feed, rank badges next to your level, the Accord and Mandate flags on capture points and bases, mood-board art on the map cards and trader portraits.

`src/kit/build_kit.sh <unzipped kit> <out>` rebuilds `design/m` from the source kit. It moves the textures that were repeated in every file into `design/m/tex` (shared) and keeps only the parts the game uses, which takes the models from 45 MB down to 15 MB. About 6 MB loads at start: weapons, vehicles, the soldier kit, gadgets and loot. Operators load when the loadout screen or a match needs them, and bosses load when a raid starts.

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
