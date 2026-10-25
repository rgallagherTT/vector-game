# SANDLINE

Hoverbike circuit racing with items, in a single file, `index.html`. It was converted from [BOUNTY RUN](../bounty-run/), which is unchanged. There's no build step. Three.js 0.160 and Rapier 0.12 load from jsDelivr through an import map.

## Run it

Serve the **parent** folder over HTTP: the bikes come from BOUNTY RUN's design pack at `../bounty-run/design/`, and ES modules won't load from `file://`. For example:

```bash
cd vector-game && python3 -m http.server 8080
# open http://localhost:8080/sandline/
```

If the design pack is missing, the game uses procedural bikes. If Rapier can't load, a pure-JS integrator takes over.

## What you do

Ride to **Race Control** in any town and enter a cup, or pick **Quick race** on the title screen.

- **Tracks.** Nine tracks, each laid into the desert next to a town. Every race has eight riders, a start/finish gantry with countdown lights, and a grid painted on the asphalt.
  - **Sand Cup:** three short circuits of three laps each.
  - **Thunder Cup and Odyssey Cup:** long single-lap tours of 7.6–10.5 km.
- **Track features.**
  - **Corkscrews:** the road rolls a full 360° and you ride upside down.
  - **Wall-ride banks:** banked up to 70°. Both corkscrews and banks are magnetic sections: the bike sticks to the road and the camera rolls with it.
  - **Rock tunnels** with lamps.
  - **Cliff runs** with no walls. Ride off the edge and Pip, the drone, swoops down and carries you back up in about a second.
  - **Walls are bumpers:** you glance off and keep most of your speed instead of stopping dead.
  - The sand off the track slows you right down.
- **Items.** Ride through the glowing **?** crates to spin your item slot. Leaders draw defensive items; the back of the pack draws the heavy weapons.

  | Item | What it does |
  |---|---|
  | Rockets ×3 | Fire forward (or backwards with S held). They home in a little. |
  | Seeker Missile | Locks onto the rider one place ahead and follows the track to them. |
  | Scrap Mines ×2 | Dropped behind you. |
  | Nitro / Triple Nitro | Speed bursts. |
  | Shield | Absorbs the next hit. |
  | EMP Burst | Spins out everyone within 40 m. |
  | Dust Bomb | Blinds every rider ahead of you. |
  | Sky Lance | Rare, back of the pack only. An orbital strike on the race leader after a warning. |

  A hit spins you out for a second or two. Blue chevron **boost pads** give nitro, and yellow-striped **ramps** launch you.
- **Starts and recovery.** Hold the throttle as the last light goes out for a **rocket start**; hold it too early and you stall. Fall off a cliff run, end up outside the walls or get stuck, and Pip, the recovery drone, carries you back to the track in about a second.
- **Career.** Each cup is three races scored 15-12-10-8-6-4-2-1, with a gold, silver or bronze trophy for the top three. The **Sand Cup** is open from the start. A Sand Cup podium opens the **Thunder Cup**, and a Thunder Cup podium opens the **Odyssey Cup**. There are three classes: Rookie, Pro and Legend. A podium in one class opens the next. Legendary racers enter Pro and Legend races on their home circuit: finish ahead of one to earn their cosmetic. Spend prize money at the **Service Park**, sign for a works team at the **Cantina**, and check lap records at the **Timing Hall**.
- **Party (one keyboard, up to 4).** Humans only, split screen (2×2 for three or four riders). In the lobby each rider presses their item key to join (gamepads press A). The keys are:

  | Rider | Drive | Item | Drift | Boost |
  |---|---|---|---|---|
  | P1 | W A S D | Q | Left Shift | E |
  | P2 | arrows | / | Right Shift | . |
  | P3 | I J K L | U | O | P |
  | P4 | T F G H (or numpad 8 4 5 6) | R | Y | V |

  Pick a circuit and the number of laps, then start.
- **Online (up to 4 devices).** Humans only, set up the same way as Brawler. Pick a room code (or open a link with `?room=CODE`). The first player in the room hosts and the others join the lobby. The host picks the circuit and laps and starts the race, then brings everyone back to the lobby afterwards. The browsers connect directly over WebRTC, using the free PeerJS broker to find each other. Each rider drives their own bike and streams its position 20 times a second. Item use and hits are sent as events, and a hit is decided by the victim's own game. `?broker=host:port` points at your own PeerJS server.

## Controls

W/S throttle and brake · A/D steer · Shift boost · Space drift (hold through a corner, release for a drift boost) · C hop · **Q** (or F) fire item · **S+Q** fire backwards · E interact in towns · M map · Esc pause.

Player 2: arrow keys, Right Shift boost, Right Ctrl drift, `/` hop, `.` (or L) fire item, Enter interact. Gamepads: RT/LT throttle, A boost, B drift, X hop, Y or RB fire item.

## HUD

- Item slot, top left (it spins when you pick up a crate).
- Lap counter (distance in km on single-lap tours), race time and best lap, top right.
- Minimap of the whole circuit.
- The running order down the left.
- Your position, bottom right.
- Banners for the countdown, laps, the final lap, wrong way and incoming missiles.

## URL flags

| Flag | What it does |
|---|---|
| `?debug=1` | Overlay with FPS, logic ms and race state. Buttons start any track in any class (F2), skip a lap (F3), finish now, toggle autopilot, give any item and take a hit. There are also cheats, time of day, teleports and the parked on-foot walk. |
| `?bench=race` | Your bike on autopilot in a full 8-rider race with items (the Grand Prix). Logs average, p95 and worst frame time, hitches (frames over 50 ms or 2.5× the average), logic ms, draw calls and triangles (`BENCH {...}`). `?dur=N` sets the length in seconds; `&track=<id>` picks the circuit. |
| `?room=<code>` | Open the online lobby for that room. |
| `?bench=versus` / `night` | The same in split screen, or on the night circuit. |
| `?norender=1` | Logic only, with no rendering, for tests. `&turbo=N` runs N logic steps per frame. |
| `?design=<dir>` | Load design assets from another folder. |

## Finding your way around the code

There's a manifest at the top of the script. Search for `// §NAME` anchors such as `§TRACKS`, `§TRACK`, `§ITEMS`, `§KARTAI`, `§CIRCUIT RACE`, `§HUD`, `§HOVER` and `§FLOATING ORIGIN`. Tracks are data in `TRACKS`. Each entry has control points (any scale) or a `gen` seed for a long tour, plus lap length, laps, width, hour and wall colours. It also lists `features` (corkscrew, bank, tunnel, chasm) and fractions along the lap for jumps, boost pads and crate rows. Add an entry and give it a cup in `CUPS`. Item odds by position are in `ITEM_ODDS`.

## How the circuits work

- **Layout.** The control points become a closed Catmull-Rom spline, scaled to the lap length and sampled every 4 m. Long tours use a seeded star-shaped curve (the radius wobbles 2, 3 and 5 times per lap), so they never cross themselves. Corners tighter than the bikes can take are rounded off. The start line goes a third of the way down the longest straight.
- **Placement.** Each circuit is placed beside its town at the spot that avoids towns, the monorail, landmarks, camps, slot canyons and water, and needs the least cut and fill. The spot is cached, so a track sits in the same place every time.
- **Road bed.** While a race runs, `terrainSample` shapes a corridor around the road. It flattens the ground to the road's height profile (the ground along the line, smoothed and grade-limited, plus the jump kickers), raises a rock mound over the tunnels, and cuts a 26 m drop beside the cliff runs. The chunks under the corridor are rebuilt. When the race ends, the ground goes back to normal.
- **Frames.** Every road sample has a frame: a centre point (the bed plus a lift), forward, up (rolled for banks and corkscrews) and right. The road ribbon is built from these frames, so it climbs, banks and turns upside down. Corkscrews get hoops and legs, banks get pylons, and tunnels get an arched tube with portals.
- **Magnetic riding.** On a corkscrew or bank the bike leaves the hover physics. Throttle, brake, boost and nitro drive it along the road (gravity still acts on the climbs), and steering slides it across. Its position and orientation come from the frame.
- **Walls.** The walls have no colliders. The race code pushes you back inside, takes away most of your sideways speed, keeps your forward speed and turns your nose back along the track.
- **AI.** Riders follow a racing line toward the inside of the next corner and brake to the speed the curvature allows. They drift the hairpins, pass around riders and mines, go after crates when their slot is empty, and use items with simple intent. A light rubber band keeps the pack near the humans.
- **Laps.** Positions come from laps plus distance. A lap counts only after you pass half distance, so you can't cut back over the line.

## Saves

The career saves to `localStorage` as `sandline.save.v3`. It holds trophies per cup and class, lap records, and a cup in progress. Older SANDLINE saves keep their money, upgrades and cosmetics. A BOUNTY RUN save (`bountyrun.save.v2`) can be carried over once from the title screen, and the old save is never modified. The migration converts:

- credits → prize money
- upgrades, paint, decal and frames carry over (sidearm → nitro injectors, net launcher → targeting)
- hunter rank → starting reputation
- legend trophies → frontier-legend cosmetics

Use **Pause → Export save / Import save** to move a career between browsers.
