# Sky Skiff

A 3D hover-boat battle arena. Ten hulls, one shrinking sea, last one floating takes the purse.
Plain JavaScript and Three.js — no build step, no dependencies.

**Play online: https://rgallaghertt.github.io/vector-game/sky-skiff/** — send that link to
your friends. Everyone who opens it and hits **Online Match** lands in the same lobby.

## Play it

Open the link above, pick a callsign, hit **Online Match**. The lobby lists everyone queued by
callsign; a match launches the moment ten pilots are in, or after 30 seconds with drones
filling the empty seats. **Vs Bots** starts instantly and works offline too — you can even
double-click `index.html`.

## How multiplayer works

Same setup as VECTOR: there is no game server to run or pay for.

- **Lobby** — a [Supabase Realtime](https://supabase.com/docs/guides/realtime) channel. Presence
  lists who's queued; the pilot who queued first runs the countdown and launches the room, so
  every browser agrees on the roster without anyone being elected.
- **Match** — peer-to-peer. The first pilot in the queue hosts; everyone else opens a WebRTC
  data channel to them (the handshake travels over Supabase, then Supabase drops out of the
  loop). Movement goes over an unreliable channel, hits and kills over a reliable one.
- **Blocked networks** — if WebRTC can't get through (some school and mobile networks), that
  pilot is relayed through Supabase instead at 6 Hz. It works, just a little less smooth; the
  HUD shows `relay` next to the ping.
- **State** — each pilot streams their boat at 20 Hz; remote boats render ~120 ms in the past
  through snapshot interpolation, so movement stays smooth under jitter.
- **Host leaves?** The next pilot in queue order takes over, adopts the drones, and everyone
  reconnects to them — the match keeps going. A pilot who drops has their hull taken over by
  a drone instead of leaving a frozen ghost.
- **Authority** — damage is shooter-authoritative (whoever landed the hit reports it); death is
  owner-authoritative (only your client declares your boat sunk), so kill feeds and HP agree
  everywhere.

Settings live in [`js/online-config.js`](js/online-config.js). The Supabase key there is the
public `anon` client key — it's meant to ship in web pages. Sky Skiff shares VECTOR's project
but uses its own `skyskiff-*` channels, so the two lobbies never mix; swap in your own project's
URL and key to separate them.

### Self-hosting instead

`node server.js` (Node 18+, zero dependencies) serves the game and relays matches itself — handy
on a LAN (`http://YOUR-LAN-IP:8085`) or a VPS. Pages it serves use it automatically.
`QUEUE_SECONDS=5 node server.js` shortens the matchmaking wait.

Died online? You spectate the rest of the fight (the storm keeps closing) and collect your
results when you're ready.

## Controls

| | |
|---|---|
| **W** / **S** | throttle forward and back |
| **A** / **D** | steer |
| **mouse** | look around and aim |
| **Shift** | boost |
| **Space** | fly, if the hull has a flight core |
| **Q** | toggle lock-on |
| **Left click** or **1** | fire hardpoint 1 |
| **Right click** or **2** | fire hardpoint 2 |
| **3** **4** **5** | fire hardpoints 3, 4 and 5 |

Click the canvas once to capture the mouse. Esc gives it back. Speaker icon (top-left) mutes.

On touch: left stick steers, drag the right half of the screen to look, the round buttons on
the right are your triggers — one per fitted gun.

## Hardpoints

Every hull has between 2 and 5 hardpoints. You buy guns separately and fit them to whichever
hardpoint you like, and each hardpoint gets its own trigger. A Leviathan with five guns fitted
means five separate triggers you manage at once.

**Fitting a gun is permanent.** It can never be moved to another hull. You can scrap it for a
quarter of its price to free the hardpoint, but that destroys it. Buy the gun you actually want
for that boat.

## Heat

Hold a trigger and the gun fires until its heat bar fills, then it vents and locks you out for
a second or two. The other guns keep working the whole time. Roughly:

- **Hailstorm, Shrike Pods** — about two seconds of fire, long vent
- **Pulse Repeater, Tack Driver** — three to four seconds, quick vent
- **Rail Lance, Harpoon Rail** — four or five heavy shots, then a pause
- **Basilisk** — two shots, then a very long wait

Let go before the bar fills and it cools with no penalty. Staggering triggers instead of
mashing them all at once is most of the skill.

## Lock-on

Press **Q** and the nearest target to your crosshair gets a reticle. The ring fills as the lock
builds. Once it snaps red, every shot from every gun on board rolls a **90% chance to hit** —
the shot bends to find the target. The 10% that fail visibly miss wide.

Without a lock, bullets are ordinary projectiles with travel time. You have to lead the target
yourself, and arcing guns like the Mortar and Cinder Lobber drop as they fly.

## Coins

Damage dealt is the biggest slice of your payout, so fighting pays far better than hiding.
A quiet last-place run is worth around 150 coins; a winning run with five kills is worth around
2,400.

**Everyone starts with 50,000,000 coins** — enough to buy every hull and every gun in the
catalogue many times over, so the garage is a toy box, not a grind. Existing saves get topped
up to the same pile once. Want a grindier game? Lower `startCoins` at the top of
`js/catalog.js` (the old tuning was 1,200, which makes prices matter).

## Your callsign

First launch asks for a callsign — that's the entire sign-up. No account, no password, no
email. It's stored in your browser alongside your coins, hulls and fitted guns. Same browser,
same progress. "Erase save" in the garage wipes the save; the ⚓ pill on the menu changes the
callsign.

## Files

```
index.html        the page
server.js         optional self-hosted matchmaker + relay (node server.js)
css/style.css     HUD, menu and garage styling
js/online-config.js  lobby + WebRTC settings (Supabase project, STUN servers, queue time)
js/catalog.js     all 14 hulls and 24 guns, plus the economy knobs. Change numbers here.
js/profile.js     callsign
js/audio.js       every sound, synthesized at runtime — no audio files
js/physics.js     movement, steering, hover and flight
js/combat.js      hardpoints, heat, lock-on, projectiles
js/render.js      Three.js scene, boat models, waves, storm, effects
js/bots.js        enemy AI (also drives the menu-screen battle)
js/garage.js      coins, buying, fitting, the save file
js/game.js        the match itself + multiplayer sync
js/net.js         online play: Supabase lobby, WebRTC hub, relay fallback, server.js client
js/main.js        menus, input, startup
js/vendor/        Three.js r149 and supabase-js 2.117.1 (both MIT), bundled so nothing loads from a CDN
```

Balance lives entirely in `catalog.js`. Change a number, reload the page, play it. Gun heat is
derived from `burstSec` — how many seconds of held trigger you want before it vents — so you
set the feel directly rather than guessing at a heat-per-shot value.

## Notes

- Matches run about 30–90 seconds at 10 boats
- Turn rate and `assist` are the two steering knobs. `assist` is how much the boat's momentum
  swings with the bow — raise it for arcade, lower it for heavy and floaty
- The menu background is a live bot skirmish, not a video
- Boats ride the same waves the water shader draws; it's one wave function shared between
  the GPU and the game
