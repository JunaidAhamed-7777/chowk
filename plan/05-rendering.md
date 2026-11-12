# 05 — Rendering and Art Direction

The "Spectacle" pillar. The 3D scene is the product: every pixel either shows simulation state or makes that state more legible and more beautiful. Nothing decorative that costs frame rate.

## Art direction

**A city at night, seen from above, alive with light.**

- **Palette.** Near-black blue for sky and ground. Buildings are dark silhouettes with warm lit windows. The only bright things are lights: white-warm headlights, red tail-lights, amber street lamps, and the saturated red, amber and green of signals. Because the scene is dark, the eye goes straight to traffic.
- **Mood.** Calm, cinematic, expensive. Slow camera, soft bloom, light haze.
- **Identity.** It should read as an Indian city without caricature: auto-rickshaws and two-wheelers in the mix, buses, faded or absent lane paint, shopfront signage glowing at street level, a median with lamps.
- **Never:** daylight, grey untextured boxes, flat-shaded primary colours, default orbit-controls feel, visible popping, vehicles sliding sideways or overlapping.

### Colour tokens

| Token | Use | Value |
|---|---|---|
| `night-0` | Page and sky background | `#05070D` |
| `night-1` | Ground, far city | `#0A0F1A` |
| `asphalt` | Roads | `#12161F` |
| `window-warm` | Building windows | `#FFC27A` |
| `lamp` | Street lamps | `#FFB057` |
| `head` | Headlights | `#FFF4E0` |
| `tail` | Tail-lights | `#FF2A2A` |
| `sig-green` | Signal green, "better" | `#2BE38B` |
| `sig-amber` | Signal amber | `#FFB020` |
| `sig-red` | Signal red, "worse" | `#FF4D4D` |
| `accent` | CHOWK brand, wipe line, highlights | `#3DF2B4` |
| `ui-text` | Primary text | `#E8EDF5` |
| `ui-dim` | Secondary text | `#8A94A6` |

### Interface style

- Dark glass panels: translucent `night-1` with a 1 px hairline border and background blur.
- Typeface: Inter for text; a tabular-numeral face (Inter with `tnum`, or JetBrains Mono) for all changing numbers so digits do not jitter.
- Large numerals for the metric cards. Numbers ease towards new values rather than snapping.
- Motion: 150–250 ms ease-out on interface elements. Nothing bounces.

## Time of day by scenario

The scenario sets the light (`apps/web/src/sim/scenarioScene.ts`, `apps/web/src/scene/moodLighting.ts`). Changing scenario blends sky, fog, sun, ambient light, building tint, window and street-lamp levels, light pools, bloom and vignette over about two seconds (instantly with reduced motion). All values live in one table in `moodLighting.ts`.

| Scenario | Look | Clock at start |
|---|---|---|
| Morning peak | Daytime: pale sky, warm sun, concrete facades, lamps and windows off, little bloom | 08:30 |
| Evening peak | Dusk: low amber sun from the west, some windows and lamps on | 18:00 |
| Off-peak, festival, oversaturated, cars only, custom | Night, as described above | 20:00–23:00 |
| Monsoon | Night with denser, cooler fog, wet-looking light pools, and a light rain layer over the view: faint slanted streaks and a few drops on the lens that fade in and out | 21:00 |

A `wet` mood value (0 dry, 1 monsoon) darkens the asphalt, adds puddles where the road grain is lowest, lowers road roughness to 0.55 (lower values blow out under the directional light) and stretches each street-lamp pool towards the camera like a reflection. Building facades take a per-building paint colour from a palette of weathered pastels, with streaks and painted shutters at street level; at night the paint shows faintly under the window light.

The rain layer is a 2D canvas over the scene with pre-rendered drop sprites and no per-frame allocation; reduced motion keeps still drops only. The 2D fallback stays at night.

## Scene composition

| Layer | Content | Technique |
|---|---|---|
| Ground | Dark plane to the horizon | One plane, fogged |
| Roads | Arterial, cross streets, junction boxes, stop lines, zebra markings, worn paint | Merged static mesh generated from the network JSON, one material, markings in a texture atlas or shader |
| Kerbs and median | Raised strips, median with lamp posts | Static mesh, instanced lamps |
| Buildings | Blocks lining the roads, taller behind | Instanced kit pieces; windows from a shader (see below) |
| Street life | Shopfront signage strips, trees, bus stops | Instanced; signage emissive |
| Skyline | Distant silhouettes | A few low-poly instanced boxes, heavily fogged, sparse lit windows |
| Signals | Poles and heads at every approach | Instanced poles; lamp discs emissive, driven by signal state |
| Vehicles | Up to 3,000 per simulation, two simulations | Instanced per class per simulation |
| Lights | Headlight and tail-light glow, light pools | Emissive geometry plus additive sprites and decals |
| Overlays | Pressure, decision, speed, people | Shader tints, road-surface quads, billboards |

### Buildings and windows

No window geometry. A building material computes a window grid in the fragment shader from world-space position, with a per-instance random seed deciding which windows are lit, their warmth, and brightness. A small share of windows is cool white for variety. This gives thousands of lit windows for the cost of a few instanced boxes, and no texture memory.

### Roads without lanes

In mixed-traffic scenarios the road shows only edge lines, stop lines and crossings, with faint worn lane paint at most. In the `cars-only` scenario, crisp lane lines fade in. The road itself tells the story.

### Lighting

- No dynamic shadow maps.
- One dim cool directional "moon" light and a hemisphere light for base shading.
- Street-lamp light is **faked**: a soft additive decal on the road under each lamp. No real point lights.
- Vehicles get a dark contact blob underneath so they sit on the road.

## Vehicles

- One `InstancedMesh` per class per simulation (6 × 2). Meshes come from `06-assets.md`.
- Each frame, instance matrices are written from **interpolated** snapshots: the renderer holds the previous and current simulation snapshot for each simulation and blends by the fraction of the tick elapsed. Match vehicles between snapshots by id. A vehicle that appears or disappears fades over 200 ms.
- Heading comes from the snapshot's direction vector, smoothed, with a small yaw during lateral moves so filtering looks like steering, not sliding.
- Per-instance attributes: brake intensity (tail-lights brighten when decelerating), overlay tint, emergency flag (ambulance beacon flash).
- **Headlights and tail-lights:** emissive regions on the mesh for close views, plus one additive billboard sprite per light for the bloom pass, plus (High tier) an elongated soft decal on the road ahead of each vehicle as a fake beam.
- **Light trails (P1, Medium and High):** the aerial camera adds one batch of projected tail-light streaks per side of the wipe. Direction comes from the two latest snapshots and length follows speed. Stopped vehicles retain their lamp halos. Street-level cameras omit the streaks.

## Split-screen wipe

One camera, one scene, one render pass. Objects belonging to simulation A or B (vehicles, their lights, signal lamps, overlays) carry a `side` uniform and **discard fragments on the wrong side of the wipe** by comparing `gl_FragCoord.x` with a `uWipeX` uniform. Static city geometry is shared and drawn once.

This costs nothing extra beyond the second set of vehicles and works with the post-processing chain.

The wipe line is a thin `accent`-coloured vertical line with a soft glow and a round handle, drawn in the interface layer above the canvas. Label chips sit at the top of each half.

## Overlays

| Overlay | Rendering |
|---|---|
| Pressure | Quads on the road surface covering each approach's near, mid and far sensing zones, coloured by occupied-area fraction on a single-hue ramp from transparent through amber to hot magenta. Exit zones outlined, filling as spillback risk rises. |
| Decision | A billboard above each junction: a small radial bar chart with one bar per phase, each split into the classical-rule part and the learned part, the chosen phase ringed; one line of reason text beneath. Rendered as HTML anchored to 3D positions (few elements, so cheap). |
| Speed | Vehicle tint from red (stopped) through amber to green (free flow). Lights stay on. |
| People | A soft glow around each vehicle scaled by occupancy; buses become beacons. |

Overlays fade in and out over 300 ms and respect the wipe.

## Post-processing

In order: scene render → bloom (mip-chain blur, threshold so only lights bloom) → optional tilt-shift in aerial views (P1) → vignette → tone mapping (ACES filmic) → anti-aliasing (SMAA or FXAA).

Bloom is the single most important effect. Tune it so signal colours stay distinguishable and headlights do not wash out the road.

## Camera

- All camera motion is damped. The camera never teleports except on explicit cuts in reduced-motion mode.
- Presets are keyframes: position, target, field of view. Transitions follow an eased spline over 1.2–2.0 s.
- Aerial: about 35° field of view from high up, for a compressed, model-like look.
- Ride-along: 1.4 m eye height just behind a two-wheeler, 70° field of view, slight lag and roll.
- Free orbit is clamped: polar angle between 15° and 80°, distance within bounds, target inside the corridor.
- The tour timeline (`01-product-spec.md`, L9) is JSON: `{ t, camera, wipe, overlay, event, caption }` entries.

## Quality tiers

| Setting | High | Medium | Low |
|---|---|---|---|
| Device pixel ratio cap | 2.0 | 1.5 | 1.0 |
| Bloom | Full | Half resolution | Quarter resolution, fewer levels |
| Light trails | On | On | Off |
| Headlight road decals | On | Off | Off |
| Tilt-shift | On | Off | Off |
| Anti-aliasing | SMAA | FXAA | None |
| Skyline and street props | Full | Full | Reduced |
| Vehicle cap per simulation | 3,000 | 2,000 | 1,200 (extra demand is scaled in the scenario, not hidden) |
| Vehicle mesh detail | Full | Full | Low-detail meshes |

**Automatic selection:** start at Medium on desktop and Low on narrow displays. Measure frame time over the first 90 frames after the scene is ready. Move up from Medium if comfortably under 12 ms and down from Medium or High if over 28 ms. Re-check once after 5 s. The top bar override is remembered locally.

On Low the vehicle cap is a rendering and simulation setting applied to the **live demo only**. Benchmarks always run the full scenario.

## Performance budget

| Metric | Budget |
|---|---|
| Frame rate, Medium, integrated GPU laptop | ≥ 30 fps, target 60 |
| Frame rate, High, discrete GPU | ≥ 60 fps |
| Draw calls | ≤ 150 |
| Triangles on screen, High | ≤ 600,000 |
| Texture memory | ≤ 64 MB |
| Main-thread work per frame outside rendering | ≤ 4 ms |

Rules: no per-frame allocation in the render loop; instance buffers updated in place; simulation in workers, never on the main thread; React re-renders isolated from the frame loop (metrics update at 4 Hz through a store, not per frame).

## Loading

1. HTML paints immediately with `night-0` and a **poster image**: a real screenshot of the scene, served as a small compressed image.
2. Models, policy and network load in parallel; the simulation starts in workers meanwhile and is fast-forwarded through warm-up so traffic is already flowing when the scene appears.
3. The scene cross-fades over the poster.

Total model payload target: under 3 MB compressed. Initial JavaScript: under 500 kB compressed.

## Fallbacks

- **No WebGL2:** a 2D canvas top-down renderer of the same snapshots with the same interface. Roads as dark bands, vehicles as small coloured rectangles with light dots, signals as dots. It should still look deliberate.
- **Context lost:** restore and rebuild instanced buffers; show a brief toast.
- **Tab hidden:** pause simulation workers; resume on return.

## Reference techniques

Found by the visual judge's search (results seen, pages not opened; verify before relying on them): deck.gl `TripsLayer` for light-trail look, pmndrs `react-postprocessing` Bloom (prefer Bloom over SelectiveBloom), three.js instancing examples. See `docs/judging/judge-4-visual.md`.

## Screenshots and key art

- All screenshots, the poster and README images are captured from the real application.
- A scripted capture route (`/?capture=hero`) sets a fixed seed, camera and time so images are reproducible.
