# BOUNTY RUN

A single-file hoverbike bounty-hunting game: `index.html`. There's no build step. Three.js 0.160 and Rapier 0.12 load from jsDelivr through an import map.

## Run it

Serve the folder over HTTP. ES modules won't load from `file://`. For example:

```bash
cd bounty-run && python3 -m http.server 8080
# open http://localhost:8080/
```

If Rapier can't load (for example when you're offline), the game falls back to a built-in pure-JS integrator and stays playable.

## URL flags

| Flag | What it does |
|---|---|
| `?debug=1` | Overlay with FPS, speed, bike state, the target's AI state and next trick, plus buttons to spawn any bounty (F2), trigger any escape trick on the target (F3), and set the time of day (slider, F4/F5). It also has cheats, region teleports, and buttons to start a storm, caravan, meteor shower, race or flood. |
| `?bench=chase` | Autopilot chase at full speed through dunes, with two fleeing outlaws, backup riders and smoke. Logs average, p95 and worst frame time, game-logic ms, draw calls and triangles to the console (`BENCH {...}`). |
| `?bench=coop` / `raid` / `storm` | The same benchmark in split screen, in a gang hideout raid, or in a Storm Belt sandstorm. |
| `?norender=1` | Logic only, with no rendering. Used for profiling and automated tests. |

## Controls (single player)

W/S throttle and brake · A/D steer · Shift boost · Space drift (release for a drift boost) · C hop · W/S in the air to lean · mouse to aim (with slight auto-aim on bike parts) · LMB/F fire · RMB/G net · R scanner · Q cycle the locked part · E interact · T tow · Y bounty-office drone · B Pip's tracker dart · 1–4 gadgets · M map · Esc pause. Co-op player 2 uses the arrow keys, Right Shift, Right Ctrl, `/` `.` `,` L K Enter. Gamepads are supported.

## Finding your way around the code

There's a manifest at the top of the script. Search for `// §NAME` anchors (`§HOVER`, `§NET`, `§TRICKS`, `§TRICKS2`, `§REGIONS`, `§LEGENDS`, `§RIVALS`, `§GANGS`, `§COMPANION`, `§COOP`, `§FRONTIER`, and so on). Every tunable is in the `CONFIG` object. Escape tricks are data in `TRICK_DEFS`: add an entry, then name it in a bounty's `tricks` list.

## Art

All art is procedural. Optional Claude Design assets can replace parts of it; see `design/README.md`.

## Saves

The game saves to `localStorage` (wrapped in try/catch) every 45 s, on purchases and on deliveries. **Pause → Export Save / Import Save** moves a save between browsers.
