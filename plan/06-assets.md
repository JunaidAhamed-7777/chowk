# 06 — 3D Assets and the Blender Pipeline

Blender is driven through the Blender MCP tools (`execute_blender_code`, `look`, `get_scene_info`, and the asset tools). Everything is built to be cheap to render in large numbers and to look right at night.

## Rules

1. **Scripts are the source.** Every authored asset is produced by a Python script committed under `assets/blender/`. Re-running the script regenerates the asset. `.blend` files are optional by-products.
2. **Licences are checked.** Authored assets are ours. Any imported asset must be CC0 or CC-BY, recorded in `assets/CREDITS.md` with name, author, source URL and licence before it is committed. If the licence is unclear, do not use it.
3. **Paid generation needs the user's approval.** `generate_3d` may cost credits; ask before using it.
4. **Start a Blender session with** `get_addon_status` and `get_scene_info`, and check work with `look` after each asset.

## Conventions

| Item | Convention |
|---|---|
| Units | 1 unit = 1 metre |
| Up axis | +Y in the exported glTF |
| Forward | −Z in the exported glTF (three.js default facing) |
| Origin | Vehicles: centre of the footprint at ground level. Buildings: centre of the footprint at ground level. Props: base centre. |
| Dimensions | Vehicle bounding boxes must match length and width in `02-simulator.md` within 5% |
| Materials | One shared palette texture (small colour atlas) for all assets where possible; emissive parts as a separate material slot or a vertex-colour mask |
| Naming | `veh_<class>`, `veh_<class>_lod1`, `bld_<type>_<n>`, `prop_<name>` |
| Format | `.glb`, compressed with meshopt via `gltf-transform`, textures as KTX2 or WebP |

### Light masks on vehicles

Vertex colour channels mark light regions so one shader can drive them:

- Red channel: tail-lights
- Green channel: headlights
- Blue channel: beacon (ambulance), indicator or roof sign (auto-rickshaw, bus destination board)

Body paint colour comes from a per-instance tint, so one mesh yields many colours.

## Asset list

### Vehicles — P0

| Asset | Triangles (full) | Triangles (low) | Notes |
|---|---|---|---|
| `veh_twowheeler` | ≤ 500 | ≤ 150 | Scooter or motorcycle with a simple rider. The most numerous vehicle; must read clearly from above. |
| `veh_auto` | ≤ 600 | ≤ 200 | Three-wheeled auto-rickshaw, canopy; the yellow-and-green or yellow-and-black livery comes from tint and palette. |
| `veh_car` | ≤ 600 | ≤ 200 | Compact hatchback silhouette. A second sedan variant is P1. |
| `veh_lcv` | ≤ 600 | ≤ 200 | Small goods carrier with a load bed. |
| `veh_bus` | ≤ 900 | ≤ 300 | City bus, lit windows along the sides (emissive strip) and a lit destination board. |
| `veh_ambulance` | ≤ 700 | ≤ 250 | Van with a roof beacon bar on the blue mask channel. |

Style: clean low-poly with bevelled silhouettes, not blocky. At night the silhouette, the lights and a faint rim are what is seen; do not spend triangles on detail that will be dark.

### Buildings — P0

A modular kit of instanced blocks. Windows are drawn by shader (`05-rendering.md`), so walls are plain.

| Asset | Count | Notes |
|---|---|---|
| `bld_low_*` | 3 | 2–4 storeys, shop height ground floor; lines the streets |
| `bld_mid_*` | 3 | 5–10 storeys; apartments and offices |
| `bld_tall_*` | 2 | 12–25 storeys; towers set back from the corridor |
| `bld_roof_*` | 3 | Rooftop clutter pieces: water tanks, stair heads, hoardings |

Each under 200 triangles. UVs or attributes laid out so the window shader has floor height and bay width.

### Street — P0

| Asset | Notes |
|---|---|
| `prop_signal` | Pole with a three-lamp head. Lamp discs are separate instanced emissive geometry, not part of the pole mesh. |
| `prop_lamp` | Street lamp for the median and kerbs; emissive head |
| `prop_tree` | Two variants, dark, low-poly canopy |
| `prop_shopstrip` | A ground-floor signage strip with emissive panels in several colours, placed along `bld_low` frontages |

### Street — P1

| Asset | Notes |
|---|---|
| `prop_busstop` | Shelter with a lit panel |
| `prop_hoarding` | Large lit billboard on a frame |
| `prop_barrier` | Median railing segment |
| `prop_breakdown` | Hazard triangle and cones for the blocked-lane event |

### Street — P2

| Asset | Notes |
|---|---|
| `prop_viaduct` | Elevated metro viaduct pillars and deck along the median, for skyline depth |
| `prop_autostand` | Parked auto-rickshaws cluster |

## Generated, not modelled

These come from code in the web app, not from Blender:

- Road surfaces, junction boxes, kerbs, markings: generated from the network JSON so they always match the simulator's geometry.
- City layout: a seeded placement script puts buildings, trees and props along the roads from the network, with setbacks and height increasing away from the corridor. Deterministic, so screenshots are reproducible.
- Skyline: instanced boxes.

## Pipeline

```
assets/blender/<asset>.py        authored via Blender MCP, committed
        │  run in Blender
        ▼
assets/export/<asset>.glb        raw export (git-ignored)
        │  npm run assets:build      (glTF Transform: dedupe, weld and meshopt)
        ▼
apps/web/public/models/<asset>.glb   committed, loaded by the app
```

`npm run assets:check` prints triangle counts, bounding boxes and file sizes for every model and fails if any exceeds its budget or a vehicle's bounding box does not match the simulator's dimensions.

`npm run assets:placeholders` generates the initial vehicle stand-ins from the simulator's dimension table using Python's standard library. This stage can run without Blender. For textured assets, provide WebP or KTX2 palette textures in the raw export.

With Blender on the path, run `npm run assets:vehicles` for the full vehicle meshes and `npm run assets:district` for their low-detail variants and the city kit. Both scripts also run with Blender's `--background --python` arguments when the Blender MCP add-on is unavailable.

## Budgets

| Item | Budget |
|---|---|
| All models, compressed | ≤ 3 MB |
| Palette texture | ≤ 256 × 256 |
| Any single model | ≤ 300 kB |

## Order of work

1. Placeholder boxes with correct dimensions and light masks for every vehicle, so rendering work is never blocked on art.
2. Two-wheeler, car, auto-rickshaw, bus (most visible).
3. Signal, lamp, low and mid buildings.
4. Light commercial, ambulance, tall buildings, shop strips, trees.
5. P1 props, then P2.

Check every asset in the real scene at night from the aerial camera before calling it done; what looks good in Blender's viewport in daylight is not the test.
