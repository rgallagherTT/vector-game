# KINETIC

Third-person superhero sandbox in a rain-soaked neon city. One self-contained `index.html` (Three.js + Rapier physics from CDN, procedural city) plus three hero models (`hero_*.glb`, driven by the game's own animation through a retarget; the game falls back to procedural figures if they fail to load).

## Heroes (pick one before each run — each has its own power tree, kinesis, records and cosmetics)

- **KINETIC — the telekinetic.** Hold left click to lift anything (cars, buses, people, chunks ripped out of buildings), release to throw. Push, slam, telekinetic jump; debris shield, Catch, levitate, heavy lift, vortex, overload.
- **VELOCITY — the speedster.** Look roughly at an enemy and a ring locks on; left click blitzes them with a flurry of punches, and holding left click chains through a whole group (combo damage builds). The faster you run the slower the world (down to 2% in Overdrive): rain hangs in the air and bursts as you run through it. Run up skyscrapers (the camera pulls back over the frozen city), run on the harbour, blitz, pluck bullets out of the air and flick them back, disarm, sonic boom, whirlwind, relay, phase step. Carry people out of slow-motion disasters to build Hope. The MRA answers with spike strips, foam, nets, caltrop drones, chrono-dampeners and Pacer.
- **MIMIC — the shapeshifter.** Hold E on an animal, object or person to learn its form; hold Q for the form wheel. Six generated heists (bank, museum, casino, lab, penthouse, MRA evidence locker): case them, get in (front door, loading bay, roof hatch, vents), take the prize, get out. Guards notice things that are out of place; hold still as an object while they walk past for a close call. Ghost / Clean / Loud ratings are saved.

Phone booths around the city switch heroes mid-run (Tag Team, `F`).

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
