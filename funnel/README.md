# FUNNEL — Stage 1: Be the Storm

A 3D arcade growth game: you are a tornado. Start as a dust devil eating leaves, end as a Hypercane eating the stadium.
One self-contained `index.html` (Three.js 0.160 from CDN via an import map, no build step, no asset files — every object is generated in code).

**Play:** https://rgallaghertt.github.io/vector-game/funnel/

## Controls
- Move: WASD / arrows · hold left mouse (move toward cursor) · drag anywhere on touch · gamepad left stick
- Surge: Space · touch SURGE · gamepad A
- Fling the biggest orbiting object: hold F or right mouse to aim, release · touch FLING · gamepad RT/B
- Pause & settings: Esc / P / Start

## For Stage 2
- The file opens with a manifest of `// §ANCHOR` sections (`§CONFIG`, `§VORTEX`, `§MOMENTS`, …).
- Every tunable number lives in the `CONFIG` object at the top.
- `?debug=1` shows an overlay (FPS, draw calls, triangles, orbiting / world counts, strength, radius) and enables keys:
  `1`–`9` jump to tier, `G` grow, `[` `]` pick a type, `T` spawn it, `I` infinite energy.
- `dbg.sims(3)` in the console runs three headless 5-minute runs with a bot and reports tier times.

## Pacing (headless bot, 6 seeds)
| Tier | Target | Simulated range |
|---|---|---|
| Whirlwind | 0:20 | 0:14–0:18 |
| Twister | 0:45 | 0:43–0:52 |
| Tornado | 1:10 | 1:08–1:29 |
| Supercell | 1:40 | 1:29–2:02 |
| Monster | 2:15 | 2:08–2:31 |
| Cataclysm | 2:50 | 2:24–2:54 |
| Titan | 3:20 | 3:07–3:28 |
| Hypercane | 3:50 | 3:29–4:10 |

All six runs lifted the stadium (3:35–4:17).
