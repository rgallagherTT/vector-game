# FRONT ZERO — benchmark notes

Measured on 2026-11-03 in the build container, which has **no GPU**. Chromium ran headless and rasterized with SwiftShader on the CPU, so WebGL was very slow. The engine clamps a frame to 100 ms, so every rendered frame time below sits at that clamp. Those frame times say nothing about a real machine. What does carry over is the **CPU logic time** (simulation, AI, physics, ballistics) and the **draw-call count**. To get real frame times, run `?bench=firefight` or `?bench=warfare` in a desktop browser.

## `?bench=firefight&dur=10`: 12 v 12, one map per biome

| Map (biome) | avg frame | logic / frame | draw calls |
|---|---|---|---|
| Dustwater (desert) | 90.7 ms* | 4.6 ms | 206 |
| Shipgrave (coastal) | 87.6 ms* | 3.8 ms | 240 |
| Rivercut (jungle) | 87.3 ms* | 2.7 ms | 217 |
| Icebreak (arctic) | 92.0 ms* | 2.2 ms | 208 |
| Whiteout (mountain) | 90.1 ms* | 2.6 ms | 218 |
| Old Quarter (temperate) | 89.5 ms* | 4.0 ms | 242 |
| Skyline (urban) | 88.4 ms* | 2.5 ms | 186 |

\* SwiftShader. Worst and p95 were at the 100 ms clamp everywhere.

## `?bench=warfare&dur=10`: 32 v 32, every vehicle, largest Breakthrough map

| Map | soldiers | vehicles | avg frame | logic / frame | draw calls |
|---|---|---|---|---|---|
| Greywood (3 km) | 64 | 31 | 94.7 ms* | 20.6 ms (CPU shared with the software renderer) | 316 |

The 20.6 ms logic figure was taken while SwiftShader was using the same cores, so the simulation was profiled on its own (`?quick=warfare&map=greywood&n=32&norender=1`, 20 s of play). Per fixed step:

| System | before tuning | after |
|---|---|---|
| Bot brains (incl. path-finding) | 4.6 ms | 1.9 ms |
| — of which fine A* | — | 1.3 ms |
| — of which coarse A* | 1.5 ms | 0.03 ms (cached per squad goal) |
| Soldier movement + collision | 0.30 ms | 0.36 ms |
| Vehicles (27) | 0.27 ms | 0.32 ms |
| Mode, ballistics, world | < 0.05 ms | < 0.05 ms |
| **Total** | **≈ 5.3 ms** | **≈ 2.7 ms** |

The tuning: A* no longer allocates per node, the string-pull is windowed, coarse routes are cached, and the path budget is 2 per step (64 bots re-path about every 10 s).

**32 v 32 is kept.** Simulation fits in about 3 ms of a 16.7 ms frame, and draw calls stay near 320 because soldiers, foliage and blocks are instanced. Whether rendering fits on a given GPU has not been measured here. If a machine struggles, `?bench=warfare&size=24` runs 24 v 24, and Settings → quality lowers view distance, foliage and shadows.

## Art kit (Nov 2026)

Warfare on Greywood with the debug overlay, SwiftShader in headless Chromium:

| | draws | triangles | avg frame |
|---|---|---|---|
| procedural models (`?nokit=1`) | 747 | 333k | 46.8 ms |
| art kit | 731 | 720k | 38.5 ms |

Soldiers stay one instanced draw per body part, so the number of draw calls doesn't change. Triangles go up about 2.2x because the kit soldier, helmets, vests and rifle have more detail than the boxes. Both teams' gear variants are in the instanced meshes, and the hidden variant still costs vertex work. The frame time difference is noise on SwiftShader, which is CPU-bound. On low-end phones the triangle count matters more; `?nokit=1` gets back the light procedural look.
