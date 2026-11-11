# Handoff — frontend and assets pass (13 Nov)

For the next agent. Read `AGENTS.md` and `ROADMAP.md` first; this file only covers what changed in this pass and what to do next.

## Commit rule from the user

Commit very often and push regularly. **Do not add `Co-Authored-By` or any other attribution trailer** to commit messages.

## What changed in this pass

| Area | Change | Files |
|---|---|---|
| Light legibility | Additive point halos with a minimum screen size for head-lights, tail-lights and signal lamps, so traffic and signal state read from the aerial camera | `apps/web/src/scene/glow.ts`, `TrafficMeshes.tsx` |
| Headlight beams | Instanced additive road decals ahead of each vehicle; off on the Low tier | `TrafficMeshes.tsx` |
| Roads | Ground darkened, asphalt and markings lifted so roads stand out | `corridorGeometry.ts`, `StaticDistrict.tsx` |
| Layout | Live view is full-bleed; title, status chip, controls and readouts float over the scene | `views/LiveView.tsx`, end of `styles.css` |
| Live readouts | Delay per person, stops per vehicle, people delivered per hour, CO2 estimate, computed from the simulator's cumulative `Metrics` | `views/LiveView.tsx` |
| Vehicles | Six models built with Blender's `bmesh`, 160–204 triangles each, passing `npm run assets:check` | `assets/blender/vehicles.py`, `apps/web/public/models/` |
| Vehicle shading | Per-vehicle paint colour by id, dark trim, glass, emissive lamps and signs, lit bus cabins, flashing ambulance beacon | `TrafficMeshes.tsx`, `vehicleGeometries.ts` |
| Camera | Aerial view drifts slowly along the arterial until the visitor drags; reduced motion disables it | `NightCorridor.tsx` |

## Things to know

- **Vehicle mask convention.** `COLOR_0` is a material mask, not a colour: `(0,0,0)` paint, `(0.3,0.3,0.3)` trim, `(0.3,0.3,0.45)` glass, `(1,0,0)` tail, `(0,1,0)` head, `(0,0,1)` sign or beacon. The loader renames it to a `mask` attribute and the body material reads it in `onBeforeCompile`. Details are in the docstring of `assets/blender/vehicles.py`.
- **Rebuilding models.** The Blender MCP add-on was not connected in this session, so models are built headless:
  `"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" --background --python assets/blender/vehicles.py`, then `npm run assets:build`. `npm run assets:vehicles` does the first step if `blender` is on `PATH`.
- **Low tier** still uses the box fallback geometry; `_lod1` models (task 7.5) are not built.
- **Dev server config** for the Claude preview pane is in `.claude/launch.json`; it is harmless to other tools.

## Not verified

- **Browser tests were not run locally**: Playwright's browsers are not installed on this machine (`npx playwright install` is needed). The redesign kept every selector the tests use, but confirm on CI. CI runs for these commits were still queued when this was written.
- **Frame rate was not measured.** The scene ran smoothly on an AMD integrated GPU at the Medium tier by eye only.
- The readouts are cumulative since the start of the run, not the rolling five-minute window the spec asks for (task 5.1 is therefore not ticked).

## Known issues

1. **Load shows a black scene for roughly 5–15 s** in the dev server while the worker warms up 240 simulated seconds. The static city should render immediately, with traffic fading in when ready, and a poster image before that (task 4.11). Measure on a production build first.
2. The HUD is hidden behind the controls when the window is under about 600 px tall.
3. The intro text overlaps bright windows in places; a slightly stronger top gradient or a smaller deck would fix it.

## Suggested next steps, in order

1. Check CI on the latest commit and fix anything the layout change broke.
2. Task 4.11: render the static scene before the simulation is ready; add the poster.
3. Track A is the critical path and is untouched by this pass: events (1.11), controllers (2.1–2.9), then training (3.x). The split-screen wipe (4.8, 4.9) and most of Phase 5 depend on them.
4. Task 5.7 autoplay tour: the camera drift is a stand-in; replace it with the JSON timeline from `plan/01-product-spec.md` once events and overlays exist.
5. Remaining assets: buildings, street props, shop strips (7.3, 7.4). The city is still instanced boxes with a window shader.
6. Light trails (4.12), which the visual judge rated the strongest signal of flow versus jam.
