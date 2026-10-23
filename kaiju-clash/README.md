# KAIJU CLASH

A 1v1 (and 2v2, and 4-way) giant-monster fighting game in one self-contained `index.html`, built with Three.js and Rapier. All art is procedural. There is no build step.

## Run

Serve the folder and open it in a desktop browser:

```bash
npx http-server games/kaiju-clash -p 8080   # then open http://localhost:8080
```

Serving is recommended, because some browsers restrict ES modules on `file://` pages. Three.js `0.160.0` and `@dimforge/rapier3d-compat` `0.12.0` load from jsDelivr through the import map, so the first load needs internet access.

## Controls

Running is automatic. Tap **Attack** for a 3-hit combo and hold it for an uppercut. Fill the **ULTIMATE** bar by fighting and smashing the city; when it flashes "ULTIMATE READY", press the Ultimate key. Press **H** during a match to show the controls.

| Action | P1 (keyboard, left) | P2 (keyboard, right) | Gamepad |
|---|---|---|---|
| Move | W A S D | Arrow keys | Left stick |
| Attack (hold = uppercut) | F | K | X |
| Grab / throw | R | L | B |
| Jump | Space | I | A |
| Block (tap = parry) | Q | J | LB |
| Special (+ toward / away = 2nd / 3rd) | E | O | RB |
| **ULTIMATE** | **T** | **P** | **Y / RT** |

## What's in it

- **Roster:** Granitor, Skitterax, Voltwyrm, Bulwark-9, Mother Brine, Thornback, Pyroclast and Gloomwing, plus the Omega Titan boss. The boss is unlocked by clearing Arcade or buying it. Each monster has a 3-hit light string, a heavy, a launcher, an air attack, five throws, three specials, a rage, a get-up attack and two taunts.
- **Arenas:** Port Halcyon, Neon Kowl, Sundune, Frostholm, Isla Fuego and Lunar Base (low gravity), plus the boss arena Ruins of Halcyon. There are 21 set pieces. Each fires once per match, and every arena has a launch-into-a-structure moment.
- **Modes:** Versus, Tag Team, Arcade (six fights, then the Omega Titan), Destruction Derby, King of the Hill, Rampage Rumble and Training. Training has a dummy, combo trials, frame data and a building reset.
- **Meta:** monster points, unlocks (monsters, arenas, 24 skins), the Monster Lab, records, 40 achievements, instant replays, a highlights reel and photo mode. Everything is saved to `localStorage`, with every read and write wrapped in try/catch, as the spec asked. This repo's CLAUDE.md rule against browser storage is about Chronicle artifacts, so it doesn't apply here.

## URL flags

| Flag | What it does |
|---|---|
| `?debug=1` | Overlay: FPS, draw calls, physics bodies, monster states. Keys: `` ` `` hitboxes, `1`/`2` fill rage, `9` reset buildings, `0` spawn throwables, `8` +5000 points |
| `?bench=brawl` | Two hard AIs fight downtown in Port Halcyon. After 60 s it logs average, p99 and worst frame times to the console and overlay |
| `?bench=rumble` / `?bench=tag` | Four monsters in rainy Neon Kowl, or a 4-monster Tag Team match |
| `?sim=balance&n=60` | Headless AI-vs-AI simulator. Prints every matchup and each monster's overall win rate |
| `&baseline=1` / `&tune=1&verify=160` | Run with every multiplier reset to 1.0 / auto-tune the `BALANCE` multipliers, then verify on a fresh seed |

## Balance

These are the results of the headless simulator: AI "normal" vs "normal", with sides swapped every other fight. The full matrices are in `BALANCE_REPORT` at the top of the file and on the in-game Records screen.

| Monster | Before (×1.00, 420 fights) | After (1,120 fights) | Re-check, other seed (1,050 fights) |
|---|---|---|---|
| Granitor | 68.1% | 46.1% | 47.1% |
| Skitterax | 59.8% | 51.0% | 49.5% |
| Voltwyrm | 11.0% | 52.1% | 51.7% |
| Bulwark-9 | 59.3% | 51.0% | 51.7% |
| Mother Brine | 43.8% | 50.2% | 49.2% |
| Thornback | 42.4% | 50.8% | 49.8% |
| Pyroclast | 80.7% | 50.7% | 51.1% |
| Gloomwing | 35.0% | 48.2% | 49.7% |

## Performance notes

The build was tested in a container whose Chromium only has software WebGL (SwiftShader), so the 60 fps targets could not be measured on a real GPU. Run `?bench=brawl` and `?bench=rumble` on the target laptop for real numbers. What was measured there:

- **CPU per 60 Hz frame:** about 0.4 ms for a 2-monster brawl and about 1.1 ms median (1.6 ms p95) for the 4-monster rumble in Neon Kowl. That figure covers simulation, Rapier debris, procedural animation and particles. Rendering is excluded.
- **Draw calls:** about 450 in the worst case, the 4-monster rumble in Neon Kowl. Building chunks, windows, cars, people, birds, neon signs, debris and particles are instanced. Monster parts and props are merged with vertex colours.
- **Physics:** debris only becomes a Rapier body when it breaks loose. Bodies are dropped once they settle into rubble, and live debris is capped at 520 bodies.

## Navigating the source

The manifest comment at the top of `index.html` lists the section anchors: `// §CONFIG`, `// §FIGHT`, `// §ROSTER`, `// §ARENAS`, `// §SETPIECES`, `// §MODES`, `// §TAG`, `// §UNLOCKS`, `// §CUSTOM`, `// §BALANCE`, `// §SIM` and the rest. Every tunable lives in `CONFIG`.

## Speed and size update

Monsters move about twice as fast, hit 25% harder with 60% more knockback, attack 30% faster and smash through any building they run into. Every city is about 1.85× wider, with outer districts and satellite skylines (650–1,060 buildings per arena). The ultimate meter fills about twice as fast. Balance was re-tuned afterwards: every monster wins 47.3%–51.5% of 1,050 AI fights.

## Camera and replay update

With one human player the camera follows your own monster from behind, looking toward your rival; buildings between the camera and the monsters are cut away. With two human players the shared camera frames both. Projectiles, beams and army fire still do damage but no longer stop you. The Watch replay button and the instant replay now use the fight camera.
