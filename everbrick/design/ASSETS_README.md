# Everbrick — delivered assets

Generated 2026-10-21. Units: 1 stud = 1, brick = 1.2, plate = 0.4, +Y up. Vehicles face -Z.

## Delivered
- Prompt 1: design/keyart (9 JPEG images incl. title), design/palette.json (32 colours), design/style.md
- Prompt 2: design/pieces.glb (99 pieces × LOD0/LOD1 + stud, stud_round), design/pieces.json
- Prompt 3 + 4 + 8: design/bodies.glb (biped parts, big set, giant set, reference rig, 38 animal species, 23 upright-animal rigs, gear), design/bodies.json (joints, sockets, triangle counts)
- Prompt 5: 5 atlas pages, design/prints.json (1023 prints), 60 emblem SVGs
- Prompt 6: 235 character recipes + 235 turnaround JPEGs
- Prompt 7: realm kits for all 8 realms in models/<realm>_*.json
- Prompt 9: vehicles, functional pieces (meta.function set), 9 home templates in models/
- Prompt 10: creatures/<realm>.glb — smooth models, separate nodes pivoted at joints
- Prompt 11: design/ui (logos, title screen, 13 mock screens, HUD kit, 150 icons, 4 pip coins), design/ui.md
- models/ total: 1101 brick models

## Brickify resolution (Prompt 10)
All creatures are authored at 1 unit = 1 stud. Brickify at **1 stud × 1 plate** cells. Details thinner than 2 studs were avoided.

## Differences from the brief
- Key art was generated with an image model (Higgsfield GPT Image 2.5). Figures may show small stud or hand details that differ from the Everbrick figure spec; treat as mood targets.
- Bricks and plates are hollow (top + four walls) but have no underside tubes. LOD1 is the same footprint without bevels.
- Glass panes and tyres share cells with their frame / wheel; pieces.json marks this with `fitsInto` and the validator allows it.
- Arm, hand, leg and boot parts are symmetric, so one part serves both L and R. The rig renames joints with _L/_R.
- The original-figure proof is a feature table plus joint-marked turnaround.
- Added panda and lizard (quadruped) and penguin / mole upright heads, used by characters.
- Props are 20 shared prop types × 2 colour variants per realm, recoloured to each realm palette. Scatter is 5 realm-specific nature types × 4 variants.
- Buildings, landmarks and creatures are procedural blockouts. The validator checks overlaps, palette colours, pieces and prints; it does not check that every brick is connected.
- Prompt 10 creatures are built from smooth primitives in code; Higgsfield 3D generation was not used (not enough credits for 40 models).
- UI SVGs load Fredoka from Google Fonts; screens reference ../keyart images.

## Validator results
No errors in any brick model.
