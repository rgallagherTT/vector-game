# KINETIC

Third-person superhero sandbox in a rain-soaked neon city. One self-contained `index.html` (Three.js + Rapier physics from CDN, procedural city) plus three hero models (`hero_*.glb`, driven by the game's own animation through a retarget; the game falls back to procedural figures if they fail to load).

## Heroes (pick one before each run — each has its own power tree, kinesis, records and cosmetics)

- **KINETIC — the telekinetic.** Hold left click to lift anything (cars, buses, people, chunks ripped out of buildings), release to throw. Push, slam, telekinetic jump; debris shield, Catch, levitate, heavy lift, vortex, overload.
- **VELOCITY — the speedster.** Look roughly at an enemy and a ring locks on; left click blitzes them with a flurry of punches, and holding left click chains through a whole group (combo damage builds). The faster you run the slower the world (down to 2% in Overdrive): rain hangs in the air and bursts as you run through it. Run up skyscrapers (the camera pulls back over the frozen city), run on the harbour, blitz, pluck bullets out of the air and flick them back, disarm, sonic boom, whirlwind, relay, phase step. Hold `Q` to phase: you go intangible and run straight through walls, cars, people and bullets while it drains stamina, and if you let go inside a building you are pushed out. Carry people out of slow-motion disasters to build Hope. The MRA answers with spike strips, foam, nets, caltrop drones, chrono-dampeners and Pacer.
- **CORTEX — the telepath** (Mimic reworked; saves and heists carry over). People see whoever you project — cameras and drones see the real you. All six heists, the projection wheel and Ghost/Clean/Loud ratings remain; learning a form is now reading a mind and copying the identity. **Hold F** Mind Read: psychic view (colour drains, minds glow through walls, thoughts float over heads — vault codes, guard routes, where the lieutenant is hiding, rumours; hold a mind in the centre to read it deeply and get waypoints/heist notes). **LMB** Mind Lance (ignores armour, weaker in crowds). **RMB** Dominate: play as a guard, gang member or civilian — walk them, fight with them, swipe a guard's badge on locked doors; limited by Will; lieutenants and leaders fight back in a tug-of-war mind duel. **Chain Mind**: hold three and swap with Z. **V** Astral Form flies through walls while your body stays behind and can be hit. **X** Memory Wipe (win a Ghost back). **G** Suggestion (calm crowds, make gangs drop weapons, send guards to look). **U** Overmind: every gang member around you turns on their own crew, with a low hum. Counters: psi-dampener helmets on lieutenants, null minds (containment suits, some Vantablack recruits).
- **SOVEREIGN — master of nanotech.** He walks; the world reacts. **Hold E** on a car: it comes apart into a stream of nanites that flows into the suit (Nanomass). **Hold Q / 1–5** constructs assemble from the swarm (GPU nanite cloud, ~22k particles sampled onto each shape): blade, hammer, tower shield, chain whip, cannon. **RMB** guard — bullets break apart on it. **Presence** builds with clean, varied fighting: at high Presence thugs surrender or flee, pedestrians stop and film, a nanite halo forms; full Presence = **Ascendant** (bigger constructs, faster, a low heroic camera, the suit flows over again). **F** swarm (strips weapons and armour, eats cover), **G** assimilate drones and jammers into your turrets and escorts, **SPACE (hold, airborne)** wings, **R** rebuild wrecks and stabilise incidents, **C** decoys that burst into blades, **U** Colossus — every car within 80 m streams into a giant you pilot for 30 seconds. Black-and-gold dissolve-shader suit. **The Forge (Tab / Phone → FORGE): 53 blueprints** — 21 weapons (greatsword, katana, spear, scythe, gatling, railgun, scatter, mortar, plasma stream…), 14 structures built where you aim (wall, ramp, bridge, stairs, watchtower, cage, launch pad, turret, shield dome, statue of you, spike field, sky platform, arch), rides (hoverboard, nano bike, sky jet, skates), creatures that fight beside you (wolf, hawk, golem, serpent, sky wyrm) and tools (grapple, magnet, jetpack, repair). Eight go on the wheel (Q / 1–8). **Sculpt** your own blueprints from primitives with a live 3D preview. Faster walk and stride, CTRL nano dash.

- **THREADRUNNER — the ninja.** Swings the city on glowing silver-cyan nanofibre threads fired from spools in armoured forearm bracers.
  - **Threads.** Each thread is a Verlet rope. It is taut while swinging, then goes slack and ripples when released before detaching. Threads wrap around corners, bead with rain, and pick up the colour of nearby neon.
  - **Swinging (hold right click).** Swinging is a pendulum. You reel in with Space and let out with Ctrl. Release on the way up to fling yourself, and release in the gold window for a perfect release. Every release throws a trick (flips, corkscrews, cartwheels, a spread-eagle dive), and you can chain the next swing mid-flip.
  - **Anchors.** Threads only attach to real buildings, lampposts and the elevated rail. There are no sky hooks, so over plazas and the harbour you have to sprint, glide or zip.
  - **Moves.** Zip (`Q`), snare in a woven thread net (`E`; snared enemies get hung from lampposts or pinned to walls), tether pull or swing (`R`), and thread spike (`R` on debris). Unlockable: zip line (`Z`), slingshot (`G`), tripwire (`3`), hang drop from a perch, and Storm of Threads (`4`).
  - **Focus (hold `F`).** The world slows to 20% while you move at 50%. Click enemies to mark them, then let go of `F` to thread-dash between them. In Focus, `E` threads incoming shots aside.
  - **Ninja combat.** Blade combos, flying kicks and dive strikes; shuriken (`1`) and smoke bombs (`2`); silent takedowns from behind or while crouched (`C`).
  - **Traversal courses** with rings, rated gold, silver or bronze. A style meter tracks combos.

Phone booths around the city switch heroes mid-run (Tag Team, `F`).

## Life in the city (career)

- **DEX — the guy in the chair.** Your man on comms (text messages, no voice): he watches the scanners, calls out crimes, villains and enemies by clock position, reacts to your tricks and new cities, and runs support. **J** = whatever helps most right now (scan enemies through walls, support drone, jam their guns, med-kit, villain weak point, loop heist cameras, find me something to do); Phone → 🎧 CHAIR has every option and auto-assist.
- **Acrobatics and freerunning (every hero).** Jump + back = backflip (sprint = double), + side = side flip, sprint forward = front flip, back + side = corkscrew, into a wall = wall flip; hard landings roll; tricks chain into combos. **Tether (middle mouse or `)**: fire at any wall and zip to it, hold through the pull to slingshot off the end, let go mid-zip to fling, hold back on the ground to stretch and launch. Sprint along walls to wall-run (SPACE kicks off with a flip), push into a wall in the air to cling (SPACE wall flip, W+SPACE climb up).
- **Suit HUD.** A heads-up display from the suit, in third person: heading compass with markers, target brackets with health and distance on every threat, a lock on the one under the reticle, health and energy arcs, speed and altitude, hit-direction arcs, holo frames.
- **Super villains.** Voltstrike (lightning, blinks), Ironclad (armoured giant: slams and charges), Hexweaver (shielded by summoned followers), Razorwind (dashing blade on the wind) turn up every few minutes with a boss bar; Dex can find their weak points.
- **Mission control (player two in the chair).** Player two has their own keys, so nothing clashes with player one: arrows move the cursor, `-`/`=` zoom (right out to a city MAP view with district and tower labels to find good spots), `[`/NUM7 switch view (HOVER, TACTICAL, MAP, WATCH, DRONE CAMS), `]`/NUM8 throw a camera drone, `\`/NUM9 next cam, BACKSPACE/NUM0 re-centre. Tools: `U`/NUM1 scan, `I`/NUM2 **gunship drone** (fly it in: ENTER machine gun, RIGHT SHIFT rockets; it guards player one when you leave it), `O`/NUM3 **hack** (hold on a target: gang relays, heist cameras, jammers turn turrets on their owners, cars ram and blow up, phones stun and disarm), `P`/NUM4 **artillery stand** (auto-shells gangs; again for a fire mission on the cursor), `K`/NUM5 med-kit, `L`/NUM6 mark + route player one there, `;` support drone, `'` intel. **Contracts:** `/` flicks through the job board, hold `/` to take one and player one gets the route. Big HUD tracks player one, threats, route, mini-map, tool cooldowns and a comms log. In co-op player one's ultimate moves to `H`.
- **Solo Chair (title screen → SOLO CHAIR · AI HERO, or F9).** One player runs mission control full-screen and an AI plays the hero — it drives the real controls, so every hero's moves and powers work. It roams to jobs and crimes, fights, and falls back to ask for a med-kit when hurt. Mouse: click places the cursor, right-click sends the hero. WASD/arrows move the cursor, Q/E turn, wheel zooms, M map. Orders: G go · H hold · F attack · B fall back · Y follow cursor · C auto · N nearest crime · X aggressive/defensive. Hero buttons: SPACE jump · 1–4 powers · 5 fire · 6 push · 7 catch · 8 ultimate · 9 dodge · 0 interact · Z punch. Plus every chair tool (scan, gunship, hack, artillery, med, mark, drones, contracts).
- **Every building has a lobby.** Street doors and walls open on a lobby with elevators; the shop (Grind Café, diners, bars…) is up on its own floor, and every other floor is one of 30+ room types — server farms, libraries, cinemas, spas, dojos, casinos, galleries, sky gardens, trading floors, recording studios, construction sites, penthouses. Every room (and your apartment) gets random extras: vending machines, safes to crack, terminals to hack, pianos, cats, fire alarms, lockers, arcade cabinets and more.
- **Other heroes in the city.** Brightline, Vanguard Nine, Undertow and free-agent capes patrol and stop crime. T to talk: chat, team up, or spar. Hit one and they (and their team) fight back. Rogue copies of heroes hunt you on sight.
- **Cortex, Jean-Grey strength.** Dominate three minds at once (six with Chain Mind), including other heroes — they keep their powers (Q). Z switches between them and back to your body; 1 puts them all on autopilot.
- **Sovereign unleashed.** 600+ nanomass that regrows, SPACE again in the air for true nanotech flight, and a deep library: Colossus Blade, Rocket Fist, Tentacles, Storm Lance, Fortress, Mega Cannon, Pyramid, Stunt Loop, Sky Highway, Nano Dragon, Saucer, Tank, Spider Walker, Kraken, Phoenix, Titan and more.
- **Gang wars.** Every so often a huge gang of ~30 takes over a block, protected by three comms relays (they hit half as hard until the relays are hacked — hold `T` at one, or player two holds `O` — or blown up). Drop 26 of them for $2,500.
- **Every floor of every building.** Smash through any window at any height (press `T` clinging to the wall, or just hit it fast) onto that floor's offices or flats; elevators have a floor picker (W/S, T to go); jump back out of the window.
- **GPS route.** Any waypoint — set from the map, by Dex, or marked by player two — draws a glowing route along the streets for both players.
- **Split-screen co-op on one computer (F9 or Phone → System).** Player two takes the right half with the arrow keys and right-hand keys or a gamepad: play a PARTNER hero (any of the five — run, jump, flips, punch combo, a signature power; gangs fight them too) or sit IN THE CHAIR with a drone's-eye view and a cursor, aiming every one of Dex's tools.
- **A whole coast, five cities.** Arc City (the original seven districts) plus, past the Greenbelt to the east: **Port Sable** (Lantern Quarter, Sable Central's glass towers, Sable Terraces), **Ashgrove** (village and hills), **Vantor** (the foundry works) and **Lumen Bay** on the water. 2.4 km of city, 300 blocks, ~1,250 buildings, all swingable and all enterable; the elevated line runs the whole coast. The HUD welcomes you to each city. Phone → City Map → Travel takes a cab to any city ($20). The city is built in spatial chunks so the bigger world draws no slower than the old one.
- **Signal towers.** Every district has a tower on its tallest roof. Climb it and press `T` to sync it: the district appears on your phone map with its landmarks and Lost Satchels. Unsynced districts stay dark.
- **Landmarks.** 27 named towers, parks and plazas. Look at one from the street or a roof and press `T` to photograph it ($40; kinesis every five).
- **Proving Grounds.** One fight ring in each city: three waves against the clock for bronze, silver or gold (gold under 75 s).
- **Emotes and animation.** `I` cycles wave, dance, point, flex, cheer and sit (or type `/wave` etc. in chat); other players see them. Every hero has a new walk and run — counter-rotating hips and shoulders, two bounces a stride, elbows pumping as it becomes a run, a level head — and a living idle: breathing, weight shifts and the odd look around.
- **No wanted level.** Nobody hunts the hero — there is no police heat in any mode. Only villains and the factions you cross come for you.
- **Online — one shared city.** Everyone playing drops into the same city automatically, the way VECTOR does it: a Supabase Realtime channel lists who is in the world and introduces players, then everyone talks directly over WebRTC (players whose network blocks it are relayed). Up to 16 per world; a full world opens the next. You see other heroes with their models, name tags and threads.
- **Proximity voice.** `N` turns your mic on; players hear you only when they are near you and in the same place (the street, or the same building), quieter with distance and positioned in 3D. `Y` opens text chat (speech bubbles over your head). Phone → Online: players, waypoints to them, your name, mute everyone, go offline.
- **Every building opens.** Walk up to any wall at street level and press `T`. What's inside depends on the district and the building: offices and banks (elevator to the roof), flats (stairs to the roof, neighbours with tips and errands), bars (drinks, darts, rumours), noodle bars (eat, or work a kitchen shift), laundromats, pharmacies, tattoo parlours, karaoke boxes, research labs (power calibration for kinesis), plus the diners, shops, gyms, arcades, clubs, clinics, cafés, tailors and warehouses. Some open on a robbery already in progress.
- **People who need a hand.** Citizens flag you down: catch a kid's balloon before it floats away, bring a cat down from a roof, a rush delivery across town against the clock, carry someone hurt to the nearest hospital. Fans ask for selfies.
- **Around the city.** 60 Lost Satchels hidden on rooftops (each with a story, kinesis every ten), street-food carts on the corners, and the Skyline — an elevated train up the middle of the city with three stations; stand on its roof to ride.
- **Day and night.** Days are long and bright (about 16 real minutes) and nights are short (about 3), with a sun, sky, sun shadows and dimmed neon by day.
- **A bigger city.** The city is 16×10 blocks (about 1.3 km × 0.8 km) across 7 districts: Neon Row, the Financial Core (dense towers), Midtown, Old Town (with a park), the Underworks, the Heights and the Harbour (warehouses and container yards).
- **52 buildings you can walk into**, each with something to do:
  - **Food and drink:** diners (eat to heal), cafes (coffee refills your energy), corner shops (snacks, restock gear).
  - **Training and games:** gyms (a reps mini-game earns kinesis), arcades (a timing game pays cash), a club (dance, or clear the back room).
  - **Money and health:** banks (keep your cash safe), clinics and hospitals.
  - **Travel and shopping:** office towers (elevator to the roof), a tailor (scarves).
  - **Harbour warehouses:** gang stashes to bust.
- **Defence power** (phone → Hero):
  - **Tough Skin:** less damage and knockback.
  - **Rapid Healing:** faster regeneration.
  - **Kinetic Barrier:** press `X`.

  Health also comes back fast for every hero.
- **Knocked out?** You wake up at the nearest hospital and pay the bill. Banked cash is safe.
- **The Threadrunner climbs walls.** Push into one to climb hand over hand; Space leaps off.
- **Daytime kit** (`design/`):
  - dry, sunlit texture sets that swap in at dawn
  - unlit signs, sunlit billboards and faded posters by day
  - day lighting and fog from the kit's lighting guide
  - pigeons on the rooftops that scatter when you land near them
  - a lens flare when you look into the sun
- **Design kit** (`design/`):
  - PBR window facades and surface detail
  - 60 real neon signs (lit at night, off by day, flickering, animated)
  - rooftop billboards
  - posters, flyers, graffiti, street-name and traffic signs
- **Interiors kit** (`design/int/`):
  - every window in the city shows a real room with parallax depth (offices, flats, shops, gyms); about a third are lit at night
  - walk-in buildings and apartments use the kit's floors, walls, ceilings and signage (diner tiles, checker floors, floral wallpaper, carpet, wood, concrete)

## The living city (career)

- **Factions.** The MRA, Vantablack Holdings, the Hollow Lanterns, the Dock Rats, the Underline Saints, Tower Watch, and rival runners.
- **Territory.** Every city block has an owner. A background tick runs on its own: factions mass on their neighbours, raid each other, buy blocks out, bribe the MRA and retaliate against whoever the player keeps hitting. The tick is deterministic from the save seed plus the player's actions. Ownership shows on the phone map and in the streets through banners, graffiti and guards. A news feed reports every change.
- **Jobs.** Jobs are generated from what the factions want right now:
  - retake a block
  - hold a block
  - snare-and-deliver a lieutenant (pays more if they arrive wrapped)
  - infiltrate a stash house
  - protect a witness
  - stop a heist
  - topple a leader

  Finishing a job flips blocks and changes standing with both the client and the target. Rival runners take jobs you leave on the board, and sometimes work for the other side of yours.
- **Incidents.**
  - **Rooftop fires:** lower people off the roof on a thread.
  - **Collapsing scaffolds:** net them with a snare.
  - **Car crashes:** rip the door off with a tether. Any hero can also press `T` to help someone out.
- **Reputation.** Public reputation is tracked per district and changes separately from faction standing and MRA heat.
- **Lieutenants.** Powered lieutenants remember how you beat them and come back adapted: blades that cut threads, an anchor jammer, or armour. When one is down you choose: hand them to the MRA (`J`), leave them (`K`), or turn them informant (`L`). Each faction's leader is a three-phase boss fight once the faction is down to a few blocks.
- **Counters.** Factions adapt to a runner who keeps hitting them: cutters that free snared friends, thread-cutter drones, laser grids on Vantablack rooftops, and anchor jammers.
- **Hideouts.** You can buy a rooftop loft, a clock tower or a water tower. Each has a workbench for gear, a training rig, a map table and a launch perch. Hostile factions can raid them.

## Career (free roam)

Pick **CAREER** on the title screen. The run never ends: if you are knocked out you wake up at the nearest hospital and pay a fee. Progress is saved in the browser.

- **Mission phone (`M`).** Tabs: Home, Jobs, Teams, Map, Property (keys 1–5).
- **Jobs.** Clients hire you through the phone: hero teams or ordinary people with a problem. Job types:
  - takedowns of gang lieutenants
  - hostage rescues
  - defending a shop against three waves
  - sabotaging gang vans
  - courier runs against the clock
  - checkpoint races
  - street sweeps
  - for MIMIC, heists

  Each job pays cash, kinesis and reputation, and costs you standing with the gang you hit.
- **Gangs and street crime.** Three gangs work their own turf: the Velvet Saints, the Rustjaws and the Ledger. Red beams on the skyline mark crimes in progress: muggings, armed robberies and gang fights. Cross a gang badly enough and they send ambushes.
- **Hero teams.** The Lantern Watch, Vanguard Nine and the Undertow. Work for a team until it offers a tryout, pass it to join, then rise through five ranks: Recruit, Member, Veteran, Lieutenant, Legend. Membership brings:
  - daily pay
  - team operations that pay more and come with teammates
  - backup you can call from the phone, who fight beside you
- **Apartments.** Buy a Neon Row studio, a Harbour loft or a Core penthouse. Walk up to its glowing door and press `T`. Inside you can:
  - sleep to start a new day and collect pay
  - train for kinesis
  - open the jobs board on the laptop

  You can also fast-travel home from the phone.

## The city

A 10×6-block city (800 m × 500 m) in four districts (Neon Row, the Financial Core, the Harbour, the Underworks), Heat 1–5 from patrols to helicopters, snipers, containment teams and the Warden boss. Challenges, daily run, records, photo mode (`P`), end-of-run highlight replay. Press `H` in game for controls.

`?debug=1` for the debug overlay and keys (Shift+L unlocks every power, Shift+1…5 sets heat); `?bench=chaos` / `?bench=warden` for benchmarks.
