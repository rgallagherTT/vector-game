# KINETIC — every feature in the game

Single-file browser superhero sandbox (Three.js + Rapier): `kinetic/index.html`. Source anchors: search `// §NAME`.

## Heroes
- **KINETIC (telekinetic):** lift/throw anything (cars, buses, people, building chunks), push, catch, shield/barrier, vortex, slam, levitate, overload. Power tree + kinesis.
- **VELOCITY (speedster):** lock-on blitz chains, slow-mo world, wall-run skyscrapers, run on water, bullet catch/flick, disarm, sonic boom, whirlwind, relay, overdrive, **phasing** (hold Q: run through walls/cars/bullets).
- **CORTEX (telepath, reworked Mimic):** psychic projections (cameras/drones see the real you), six heists + projection wheel + Ghost/Clean/Loud ratings, Mind Read (F: thoughts, vault codes, routes, rumours, deep reads), Mind Lance (LMB), Dominate (RMB: play as an NPC, guard badges open doors, mind duels with lieutenants/leaders), Chain Mind (3 bodies, Z swap), Astral Form (V), Memory Wipe (X), Suggestion (G), Overmind (U); counters: psi helmets, null minds.
- **SOVEREIGN (nanotech):** GPU nanite swarm, black/gold dissolve suit, harvest cars into Nanomass (E), construct wheel (blade, hammer, tower shield, chain whip, cannon), guard that breaks bullets, Presence → surrender/filming crowds/halo → Ascendant, swarm, assimilate drones/jammers, wings, rebuild, decoys, Colossus mech ultimate.
- **THREADRUNNER (ninja swinger):** Verlet-rope thread swinging, auto-chain, wall climb, zip/perch, zip line, slingshot, tether/spike, snare, tripwire, thread storm, shuriken, smoke, Focus (slow-mo), blade/kick/slam/silent takedowns, hang drop, traversal courses, scarf cloth sim.
- **Defence powers** (tough skin, quick heal, barrier), fast health regen, knockout → wake at hospital and pay a fee.

## Guy in the chair, acrobatics, HUD, villains, co-op
- DEX on comms (text): callouts, support on J (scan, drone, jam, med-kit, intel, loop cameras, route), auto-assist.
- Flips (back/side/front/corkscrew/double/wall), landing rolls, combos; tether zip, slingshot, launch, wall-run, wall-cling, climb — every hero.
- Suit HUD: compass, target brackets + lock, health/energy arcs, speed/altitude, hit direction.
- Super villains: Voltstrike, Ironclad, Hexweaver, Razorwind.
- Split-screen co-op (F9): partner hero or player two in the chair.
- Chair has separate keys, map zoom + marking, hacking, gunship drone (MG + rockets), artillery stands, contract board (accept → route for P1).
- Solo Chair: one player in the chair full-screen, AI plays the hero (orders, hero power buttons, mouse targeting).
- Gang wars of ~30 with hackable comms relays.
- Every floor enterable: smash windows at any height, elevator floor picker.
- Sovereign Forge: 53 blueprints (weapons, structures, rides, creatures, tools) + sculpt your own.

## World
- **Five cities on one 2.4 km coast:** Arc City (Neon Row, Financial Core, Harbour, Underworks, Midtown, Old Town, Heights), Port Sable (Lantern Quarter, Sable Central, Sable Terraces), Ashgrove (Village, Hills), Vantor Works, Lumen Bay; the Greenbelt between. ~1,250 buildings in 300 blocks, chunked rendering.
- Day/night cycle (long days, short nights), rain, dusk, design kit: PBR facades, 60 neon signs, billboards, decals, interior-mapped windows (rooms visible through glass), pigeons, lens flare.
- Traffic, pedestrians, subway, elevated railway along the whole coast, **Skyline** train (rideable roof), parks, plazas, docks, cranes, container yards, train yards.

## Buildings & interiors
- **Every building is enterable** (T at any wall). 20 room types: diner, shop, gym, arcade, club, bank, office, warehouse, clinic, hospital, café, tailor, bar, noodle bar, laundromat, pharmacy, tattoo, karaoke, apartment block, research lab. Mini-games (reps, timing: darts, karaoke, folding, calibration), roof elevators, robberies in progress.
- Apartments and hideouts to buy (sleep, workbench gear, home perks).

## Career / living city
- Mission phone (contracts, messages, standing, city map + waypoints, property, hero, online, system).
- Generated contracts (retake, defend, capture, infiltrate, escort, stop heist, leader, raid, rooftop takedown…).
- Factions & super-teams (Hollow Lanterns, Dock Rats, Underline Saints, Vantablack, Tower Watch, MRA; teams Brightline/Vanguard/Undertow) with ranks, pay, backup.
- Faction territory sim, news feed, lieutenants (adapt to you; J/K/L choice), three-phase leader bosses, rivals, incidents (fires, scaffolds, crashes), counters (jammers, lasers, cutters, drones), district reputation.
- **No police wanted level** — only villains/factions come after you.

## Activities (Spider-Man style)
- Street crimes: muggings, robberies, gang turf wars.
- Citizen requests: lost balloon, cat on a roof, rush delivery, injured person to hospital; fan selfies.
- 14 **signal towers** (sync to reveal a district on the map), 27 **landmark photos**, 5 **Proving Grounds** (3 waves, medals), 60 **Lost Satchels**, 30 street-food carts, bar rumours, neighbour errands.

## Online
- One shared world for everyone (Supabase Realtime presence + WebRTC mesh, 16 per world, relay fallback).
- Remote heroes with models, name tags, threads, emotes; **proximity 3D voice chat** (N), text chat with bubbles (Y), Phone → Online tab.

## Animation & feel
- GLB hero models retargeted from a procedural pose library; walk/run cycle with hip/shoulder counter-rotation, idle breathing/weight shift/look-around; swing poses, landing rolls, perching; 6 emotes (I: wave, dance, point, flex, cheer, sit).

## Platform
- Desktop + **mobile touch controls** (stick, look, per-hero buttons, mic/chat/emote buttons). Saves in browser. `?debug=1` overlay.
