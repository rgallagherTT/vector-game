# Everbrick

An open-world brick sandbox — be anything, do anything. Single `index.html` (Three.js from CDN via an import map, no build step).

Live: https://rgallaghertt.github.io/vector-game/everbrick/

## Asset folders (all optional — every asset has a procedural fallback)

- `design/palette.json` — `{ "colour_name": "#rrggbb", ... }`
- `design/pieces.glb` + `design/pieces.json` — brick piece meshes and stud positions
- `design/bodies.glb` — body-plan parts
- `design/prints.json` + `design/prints/` — faces, fur, outfits, signs, emblems
- `design/ui/` — UI art
- `models/*.json` — brick models (list file names in `models/index.json`)
- `characters/*.json` — character recipes (list file names in `characters/index.json`)

Status: work in progress (Stages 1–5 being built).
