# Everbrick — Style Bible

## Material
- **Glossy ABS-style plastic.** Roughness 0.28–0.32, no metalness, except `gold` and `silver` (metalness 0.7, roughness 0.25).
- **Transparent colours** (`trans_*`) render at 55% opacity with a soft glint. Lamps, flames, blades and energy use the matching `glow_*` emissive variant.
- **Bevels on every top edge** (0.04 units). Studs are crisp cylinders, 0.6 wide, 0.2 tall, with a faint highlight on the rim.
- **Prints** are flat decals on the `mat_print` slot: bold ink lines, flat fills, no gradients, transparent background.
- Nothing is dirty, scratched or realistic-textured. Wear is shown only through missing bricks.

## Lighting moods
| Mood | Key light | Fill / sky | Notes |
|---|---|---|---|
| Day | Warm sun 5600K, 45° high, soft 2° penumbra | Pale sky blue bounce | Short soft shadows, strong specular on studs |
| Dusk | Low amber sun 3200K, long shadows | Lavender sky | Windows switch to `trans_orange` glow |
| Night | Cool moon 8000K, dim | Deep `dark_blue` ambient | Lamps, neon and screens become the key lights |
| Rain | Flat overcast | Grey-blue | Wet look: roughness drops to 0.15; puddles are `trans_clear` tiles |
| Snow | Bright diffuse | White bounce | White plate drifts on every upward surface |

### Signature light per realm
- **Brightharbour** — clean morning sun off the water, lighthouse beam at night.
- **Apex City** — night is default: `magenta` and `trans_blue` neon rim light, searchlights.
- **Kingsreach** — golden afternoon, torch-lit castle at night.
- **Saltspray Isles** — hard tropical noon, turquoise water caustics.
- **The Wildwood** — dappled green light, god rays through the canopy, lantern bugs.
- **Mistpeak** — soft morning mist layers, warm paper lanterns.
- **The Ember Wastes** — hot orange haze, lava glow from below.
- **The Frontier** — hard white sun, pitch-black shadows, the planet glowing blue-green below.

## Realm palette guide
| Realm | Dominant | Accent |
|---|---|---|
| Brightharbour | white, light_blue, yellow, sky_blue | red roofs, blue doors |
| Apex City | dark_grey, light_grey, dark_blue | magenta, trans_blue neon, lime (villains) |
| Kingsreach | light_grey, dark_grey, cream, green | dark_blue and dark_red roofs, gold |
| Saltspray Isles | tan, brown, cream, trans_blue water | red, dark_red pirate trim |
| The Wildwood | brown, dark_brown, dark_green, green | orange, lime, trans_orange lanterns |
| Mistpeak | cream, red, dark_red, sand_green | gold, dark_green roofs |
| The Ember Wastes | tan, orange, cream | dark_red, trans_orange lava |
| The Frontier | white, light_grey, silver | trans_blue, trans_green, blue |

## Effects sheet — every effect is flying glowing bricks
| Effect | Pieces | Colours | Motion |
|---|---|---|---|
| Fire | `flame_cone`, `tile_round_1x1` | trans_orange, trans_red, yellow | Rise and spin, shrink to nothing |
| Ice | `gem`, `slope45_1x2` | trans_clear, light_blue, white | Snap outward, freeze, shatter into 1x1 tiles |
| Lightning | `plate_1x2` chain | yellow, white glow | Zig-zag chain, 0.1 s flicker |
| Water | `tile_round_1x1`, `dome_2x2` | trans_blue, trans_clear | Arc and bounce, splash ring on landing |
| Magic | `tile_round_1x1`, `gem` | lavender, magenta, trans_green | Spiral orbit around the caster |
| Lumen blade glow | blade capsule + `tile_round_1x1` sparks | heartstone colour | Gentle hum, sparks drip from the tip on swing |
| Energy blast | `cone_1x1`, `round_1x1` | power colour glow | Straight line, bricks trail and fade |
| Speed trail | `tile_1x2` | power colour at 40% | Bricks left behind, fall and fade |
| Teleport | `plate_1x1` | trans_blue | Figure splits into plates, rises, reassembles |
| Smoke | `dome_2x2`, `round_2x2` | light_grey, white at 60% | Puff, swell, drift upward |

## Tone
Funny, warm, family-friendly. Every corner carries a joke: a sign, a prop, a townsperson's habit. All brands, signs and logos are invented.
