# Meridian

A third-person open-world superhero sandbox in a single self-contained `index.html` (Three.js from CDN via an import map, no build step).

Open `index.html` through any static web server (for example `npx serve meridian`) — the optional GLB kits are fetched relative to the page, and every asset has a procedural fallback, so the game is fully playable with none.

- `index.html` starts with a manifest of `// §ANCHOR` sections; search for an anchor to jump to a system.
- Saves live in `localStorage` (with an in-memory fallback) and can be exported/imported as JSON from the phone (`P` → System).
- Press `H` in game for controls.

## What is in it

- **Stage 1 — your hero:** creator (origins, traversal sets, power sets, costume, emblem), traversal, combat, one district.
- **Stage 2 — the open city:** eight streamed districts of New Halcyon, block territory, an hourly faction simulation, generated contracts, incidents, reputation and heat, markets, crafting, bases, vehicles.
- **Stage 3 — the crew:** recruits generated from the ability framework, eight unique recruits, turned lieutenants; hiring, wages, loyalty and personalities; Solo / Squad / Hybrid control (`K` cycles, `N` / `6`–`8` switch, `` ` `` back to the hero); radial call-in wheel (hold `B`) and orders (hold `Y`); team-ups for every pairing of the six primary sets; dispatch from a base holo-table with after-action reports; permanent crew death (toggle in Phone → System); the crew becomes a faction that can protect blocks.
- **Stage 4 — the galaxy:** a deterministic 20-system galaxy with six star-faring factions simulating daily; salvage or buy a ship, fly it (`Tab` lock, `1`–`4` power, `V` cruise), walk its interior, jump through hyperspace while New Halcyon keeps ticking; crew stations change ship combat; fight in vacuum (punch hulls, tear off turrets), board and capture ships by the bridge; land on eight planet types with their own gravity and traversal; trade, galactic contracts and dispatch across systems; relics with powers (`J` / `L`) and corruption that can permanently claim a recruit.
- **Stage 5 — the living universe:** nothing is scheduled. Five threats grow out of the simulations — the Ascendancy's conquest, awakening surges, relic awakenings, the thing beneath the city, a corporate takeover — each with visible stages and pressure points that are cheaper early; defeated threats return remixed. Galaxy events (wars, fleet battles you can join, sieges, landings, shortages, pirate surges, refugees). If the Ascendancy reaches Sol it invades: an orbital battle, landings that take New Halcyon block by block, every faction reacting by its own interests, a conqueror whose strength scales with the relics it holds — and an occupied city with a resistance if it is lost. Hold blocks, build outposts, own a station, make alliances and declare wars from the war table (base or ship holo-table), which also plans multi-crew operations and replays history. Legacy: legendary veterans with power mutations, retirement, the memorial, titles, deep hero mastery; legendary contracts at renown 150; custom world settings for new saves (creator → World).

- **Stage 6 — wider world:** join a super-team (the Halcyon Vanguard, Nightwatch, the Ember Collective) or any city faction — the department, the corporations, the gangs, the Choir, the Civic Union — from Phone → Faction. A tryout fight earns the standing in one go; members rise through five ranks, draw weekly pay, call backup that follows and fights beside you, and take operations with their side (raids take real blocks). Walk into any building in the city (`E` against a wall): offices, shops, bars, clubs, warehouses, labs, apartments — some open on a robbery or a gang hideout, quiet ones can be raided, and anyone chasing you follows you in. Four more cities on the coast — Port Sable, Ashgrove, Vantor Heights and Lumen Bay — each generated with its own districts, gangs and street crime, linked to New Halcyon by rail, coach, ferry and maglev (stations in the city, or Phone → Travel).

Saves migrate forward automatically (v1 → v2 → v3 → v4 → v5 → v6).

## Debug

Open with `?debug=1` for an overlay (fps, active sector, faction tick time, threat stages). `window.dbg` drives the simulation from the console — `dbg.help()` lists the commands: advance days, set strengths, force any threat stage, start the invasion, spawn events, grant credits and relics, and `dbg.compare(100)` runs the headless simulation (a hundred in-game days, passive and with a simulated player, a few seconds each) and reports the difference.
