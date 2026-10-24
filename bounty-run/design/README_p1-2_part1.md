# BOUNTY RUN — Prompts 1–2 (part 1 of 1)

Unzip every part into the folder next to index.html; everything lands under design/.

## Files
- design/bikes/<bike>.glb — 12 vehicles: bike_player_starter, bike_racer, bike_hauler, bike_trick, bike_cruiser, bike_outlaw_rattler, bike_outlaw_chrome, bike_outlaw_dust, bike_outlaw_basic_1, bike_outlaw_basic_2, bike_outlaw_basic_3, crawler_ironjaw
- design/bikes/bike_custom_parts.glb — fairing_A/B/C, seat_A/B/C, thruster_A/B/C (L and R)
- design/bikes/textures/ — decal_sheet.png (+ .json cell names), paint textures, three swappable paints for the basic outlaw bikes
- design/gear/net.glb, net_projectile.glb, pip.glb, gadgets.glb (spike_strip, mine, auto_turret, decoy_projector, glider_wing, grapple)
- design/previews/ — 01 lineup in golden-hour light, 02 exploded starter bike with labels, 03 damaged and destroyed parts, 04 the net spread, 05 Pip, gadgets and customisation parts
- design/style/ — palette.json, look.md, palette_swatches.png

## Bike construction
- Metres, +Y up, facing −Z. Root node = bike id, at ground level; hover pads sit 0.35–0.45 m above the ground at rest.
- Under the root: `body`, with children `seat` (→ `seat_rider`), `handlebar` (pivot at the steering column; → `hand_L`, `hand_R`), `engine`, `fuel_cell`, `thruster_main_L/R` (→ `_glow`, `exhaust_L/R`), `stabiliser_L/R`, `hover_pad_FL/FR/RL/RR` (→ `_glow`), `headlight`, `tail_light`, and empties `foot_L/R`, `muzzle`, `net_launcher`, `tow_hook`.
- Targetable parts (thrusters, stabilisers, fuel_cell, engine) each have siblings `<part>_damaged` (dented, scorched, a `smoke` empty) and `<part>_destroyed` (torn open, shards, a `sparks` empty) at the same pivot. **Hide the two variants on load** and swap visibility on damage.
- Emissive materials: `mat_emissive_thruster_<bike>`, `mat_emissive_hoverpad_<bike>`, `mat_emissive_headlight`, `mat_emissive_taillight`.
- The starter bike carries a modelled `net_launcher_mount`; its `net_launcher` empty is at the barrel mouth.
- crawler_ironjaw adds `jaw` (pivoted plough), `turret_L/R` (yaw) → `turret_L/R_barrel` (pitch) → `turret_L/R_muzzle`, and two extra pads `hover_pad_ML/MR`.

## Gear
- net.glb: `net_mesh` is a 3.2 m plane with exactly 16 × 16 vertices (row-major from the NW corner). Corner weights `net_weight_NW/NE/SW/SE` carry the vertex index they pin to in extras.
- pip.glb: `body` → `eye` (→ `eye_iris`, mat_emissive_pip_eye), `rotor_L/R` (spin on Y), `fin_L/R` (pivoted at the base, for expression).
- gadgets.glb: mine → `mine_light` (mat_emissive_mine_blink); auto_turret → `turret_head` → `turret_barrel` → `muzzle`; decoy_projector → `decoy_hologram` (transparent emissive bike shape); glider_wing → `wing_L/R` pivoted at the pack; grapple → `grapple_hook` → `grapple_claw_1..3`, `rope_attach`.
- Customisation parts sit at their pivot origin; extras say which node they replace.

## Differs from the brief
- **Key art (Prompt 1) is not in this pass.** The six frames need riders, the desert kit and towns (Prompts 3–5), so they will be rendered from those assets later.
- Paint and decals are generated procedurally (sand scour, rust, welds, invented brands). There are no normal maps; detail is geometry plus albedo.
- Basic outlaw bikes share `mat_paint_outlaw_basic`; swap its map for paint_outlaw_basic_rust / blue / yellow.

## Triangle counts (budget 12,000 for the bike as drawn; hidden _damaged/_destroyed variants listed separately)
| asset | triangles drawn | incl. hidden variants |
|---|---|---|
| bike_player_starter | 6472 | 9453 |
| bike_racer | 5356 | 8349 |
| bike_hauler | 6860 | 9845 |
| bike_trick | 6148 | 9153 |
| bike_cruiser | 6896 | 9877 |
| bike_outlaw_rattler | 6116 | 9097 |
| bike_outlaw_chrome | 5872 | 8853 |
| bike_outlaw_dust | 6664 | 9645 |
| bike_outlaw_basic_1 | 5436 | 8417 |
| bike_outlaw_basic_2 | 5724 | 8705 |
| bike_outlaw_basic_3 | 5952 | 8933 |
| crawler_ironjaw | 5540 | 6963 |
| net | 1442 |  |
| net_projectile | 784 |  |
| pip | 1976 |  |
| gadgets | 2948 |  |
| bike_custom_parts | 3044 |  |

## Files in this part (51)
- design/style/palette.json
- design/style/look.md
- design/style/palette_swatches.png
- design/bikes/bike_player_starter.glb
- design/bikes/bike_racer.glb
- design/bikes/bike_hauler.glb
- design/bikes/bike_trick.glb
- design/bikes/bike_cruiser.glb
- design/bikes/bike_outlaw_rattler.glb
- design/bikes/bike_outlaw_chrome.glb
- design/bikes/bike_outlaw_dust.glb
- design/bikes/bike_outlaw_basic_1.glb
- design/bikes/bike_outlaw_basic_2.glb
- design/bikes/bike_outlaw_basic_3.glb
- design/bikes/crawler_ironjaw.glb
- design/gear/net.glb
- design/gear/net_projectile.glb
- design/gear/pip.glb
- design/gear/gadgets.glb
- design/bikes/bike_custom_parts.glb
- design/bikes/textures/decal_sheet.png
- design/bikes/textures/decal_sheet.json
- design/bikes/textures/paint_outlaw_basic_rust.png
- design/bikes/textures/paint_outlaw_basic_blue.png
- design/bikes/textures/paint_outlaw_basic_yellow.png
- design/bikes/textures/paint_starter.png
- design/bikes/textures/paint_fuel.png
- design/bikes/textures/paint_racer.png
- design/bikes/textures/paint_hauler.png
- design/bikes/textures/paint_trick.png
- design/bikes/textures/paint_cruiser.png
- design/bikes/textures/paint_leather_dark.png
- design/bikes/textures/paint_rattler.png
- design/bikes/textures/paint_chrome_trim.png
- design/bikes/textures/paint_dust.png
- design/bikes/textures/paint_outlaw_basic.png
- design/bikes/textures/paint_ironjaw.png
- design/bikes/textures/paint_net_canister.png
- design/bikes/textures/paint_pip.png
- design/bikes/textures/paint_pip_band.png
- design/bikes/textures/paint_mine.png
- design/bikes/textures/paint_turret.png
- design/bikes/textures/paint_glider.png
- design/bikes/textures/paint_seat_red.png
- design/bikes/textures/paint_seat_quilt.png
- design/bikes/triangle_report.csv
- design/previews/01_bike_lineup.jpg
- design/previews/02_exploded_starter.jpg
- design/previews/03_damage_states.jpg
- design/previews/04_net_spread.jpg
- design/previews/05_pip_gadgets_custom.jpg
