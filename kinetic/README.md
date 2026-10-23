# KINETIC

Third-person superhero sandbox in a rain-soaked neon city. One self-contained `index.html` (Three.js + Rapier physics from CDN, procedural city) plus three hero models (`hero_*.glb`, driven by the game's own animation through a retarget; the game falls back to procedural figures if they fail to load).

## Heroes (pick one before each run — each has its own power tree, kinesis, records and cosmetics)

- **KINETIC — the telekinetic.** Hold left click to lift anything (cars, buses, people, chunks ripped out of buildings), release to throw. Push, slam, telekinetic jump; debris shield, Catch, levitate, heavy lift, vortex, overload.
- **VELOCITY — the speedster.** Look roughly at an enemy and a ring locks on; left click blitzes them with a flurry of punches, and holding left click chains through a whole group (combo damage builds). The faster you run the slower the world (down to 2% in Overdrive): rain hangs in the air and bursts as you run through it. Run up skyscrapers (the camera pulls back over the frozen city), run on the harbour, blitz, pluck bullets out of the air and flick them back, disarm, sonic boom, whirlwind, relay, phase step. Carry people out of slow-motion disasters to build Hope. The MRA answers with spike strips, foam, nets, caltrop drones, chrono-dampeners and Pacer.
- **MIMIC — the shapeshifter.** Hold E on an animal, object or person to learn its form; hold Q for the form wheel. Six generated heists (bank, museum, casino, lab, penthouse, MRA evidence locker): case them, get in (front door, loading bay, roof hatch, vents), take the prize, get out. Guards notice things that are out of place; hold still as an object while they walk past for a close call. Ghost / Clean / Loud ratings are saved.

- **THREADRUNNER — the ninja.** Swings the city on glowing silver-cyan nanofibre threads fired from spools in armoured forearm bracers.
  - **Threads.** Each thread is a Verlet rope. It is taut while swinging, then goes slack and ripples when released before detaching. Threads wrap around corners, bead with rain, and pick up the colour of nearby neon.
  - **Swinging (hold right click).** Swinging is a pendulum. You reel in with Space and let out with Ctrl. Release on the way up to fling yourself, and release in the gold window for a perfect release. Every release throws a trick (flips, corkscrews, cartwheels, a spread-eagle dive), and you can chain the next swing mid-flip.
  - **Anchors.** Threads only attach to real buildings, lampposts and the elevated rail. There are no sky hooks, so over plazas and the harbour you have to sprint, glide or zip.
  - **Moves.** Zip (`Q`), snare in a woven thread net (`E`; snared enemies get hung from lampposts or pinned to walls), tether pull or swing (`R`), and thread spike (`R` on debris). Unlockable: zip line (`Z`), slingshot (`G`), tripwire (`3`), hang drop from a perch, and Storm of Threads (`4`).
  - **Focus (hold `F`).** The world slows to 20% while you move at 50%. Click enemies to mark them, then let go of `F` to thread-dash between them. In Focus, `E` threads incoming shots aside.
  - **Ninja combat.** Blade combos, flying kicks and dive strikes; shuriken (`1`) and smoke bombs (`2`); silent takedowns from behind or while crouched (`C`).
  - **Traversal courses** with rings, rated gold, silver or bronze. A style meter tracks combos.

Phone booths around the city switch heroes mid-run (Tag Team, `F`).

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

Pick **CAREER** on the title screen. The run never ends: if the MRA detain you, you wake up at home (or on the street) minus a 15% "fine". Progress is saved in the browser.

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

  You can also fast-travel home from the phone when you have no heat.

## The city

A 10×6-block city (800 m × 500 m) in four districts (Neon Row, the Financial Core, the Harbour, the Underworks), Heat 1–5 from patrols to helicopters, snipers, containment teams and the Warden boss. Challenges, daily run, records, photo mode (`P`), end-of-run highlight replay. Press `H` in game for controls.

`?debug=1` for the debug overlay and keys (Shift+L unlocks every power, Shift+1…5 sets heat); `?bench=chaos` / `?bench=warden` for benchmarks.
