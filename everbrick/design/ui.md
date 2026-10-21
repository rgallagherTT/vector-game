# Everbrick UI kit

Chunky, bright toy-brick interface. Every element sits on a dark-brown 6px outline with a 4px hard drop shadow, like a moulded plastic part.

## Type
- Fredoka 700 for headings and numbers, Fredoka 500 for body. Fallback: Trebuchet MS.
- Minimum 22px at 1920x1080.

## Colour
- Panels: cream (#F2E2B6) or white; outline dark_brown (#4A2D1D).
- Primary action: yellow. Health: red. Stamina: lime. Power: magenta. Mount: orange.
- Icon tiles by set: careers blue, realms green, factions purple, species orange, power sets magenta, functional pieces sky blue, resources gold.

## Shapes
- Panels: 22px radius. Buttons: pill (radius = height / 2.6). Icon tiles: 26px radius with a 6px darker base for the "brick depth".
- Hearts and the logo are built from brick pixels with studs on exposed tops.

## HUD layout (1920x1080)
- Top-left: hearts, stamina, power. Top-centre: compass. Top-right: pip counter, brick bank, job tracker.
- Bottom-centre: 4 ability slots (Q E R F). Bottom-left: mount stamina when riding. Ship HUD replaces mount when sailing.
- Co-op: player 2 mirrors the top-left block at top-right.

## Build mode
- Left: piece browser (2-column tiles). Right: palette picker (6 per row), brick cost and bank. Bottom: tool dock. Top: stability warning.

## Menus
Character creator, costume and emblem designer, career board, world map, job board, companions, blueprint library, share codes, photo mode, settings. All use the 3-column card grid on a cream sheet, over a dimmed realm key-art image.

## Files
- logo_bricks.svg, logo_flat.svg, title_screen.svg
- hud_*.svg, build_*.svg, button_primary.svg, panel.svg
- screens/*.svg (mock screens)
- icons/<set>/<name>.svg
- pip_coin_1/5/25/100.svg
