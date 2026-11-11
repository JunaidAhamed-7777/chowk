# Round 2 — Visual Impressiveness and Demo Experience: AQUIFER versus GREENWAVE

Lens: only what a tired, asynchronous judge sees and feels in the first 10 seconds, the first 60 seconds, the README hero and a 90-second video. Same three rules as round 1 ([judge-4-visual.md](judge-4-visual.md)): zero-click, visual-is-the-product, dark-scene economics. Same three scales, so the numbers are comparable with GREENWAVE's 9 / 9 / 7.

Concept read: [../04-aquifer-concept.md](../04-aquifer-concept.md).

## Verdict up front

| | Wow (10 s) | Visual-is-product | Premium in 3.5 d |
|---|---:|---:|---:|
| GREENWAVE (round 1) | 9 | 9 | 7 |
| **AQUIFER** | **7** | **9** | **6** |

On visual and demo power alone: **GREENWAVE, by a clear but not large margin** (about two points on first-10-seconds wow, one on achievability, level on integrity). AQUIFER has the better still image, the better first interaction and an image nobody else in the field will have. GREENWAVE has more motion per second, reads faster with no legend, and its look is the one the web already knows how to make premium. If the team executes the three things in "What closes the gap" below, AQUIFER's wow rises to 8 and the gap is one point.

The concept doc's phrase "glass earth" is the biggest trap in the idea. **Do not render transparent earth.** Render an *absent* earth: see section 3.

### Reference status

"Search-verified" means the page or example appeared in my web search results during this review with a description matching the claim. I did not open the pages or run the demos. "Inference" means from my own knowledge, not checked today.

---

## 1. The hero shot

**Object.** A single rectangular block of land, floating in a dark void like a slice of cake or a museum diorama: roughly 2 km x 2 km of village on top, about 250 m of ground beneath, with **vertical scale exaggerated about 6-8x** so the block is nearly a cube. The two faces nearest the camera are cut away. A small "vertical scale x8" tag sits on the corner edge.

**Camera.** Three-quarter view from the cut corner, elevated about 25 degrees, long lens (FOV 20-25 degrees) for the miniature look. The horizon of the surface sits in the top third of the frame; the underground takes the lower two-thirds. That ratio is the point: the subject is below. Slow authored orbit of about 20 degrees back and forth around the cut corner, never a full turn (the back is not dressed).

**Lighting and palette.** Dusk. Indigo-to-plum gradient void, no skybox detail. One low warm key light raking across the surface so fields and houses throw long shadows; warm tungsten points at houses and pump huts. Underground is lit only by what glows. Three colour roles, and nothing else is allowed to use them:

- **Cyan / aqua** = water. The water table surface, the submerged part of each well, the tint on the cut walls below the water line.
- **Warm amber** = alive. Working pump heads, house lights, healthy crops (green-gold).
- **Ember red fading to ash grey** = dry. A failed well's shaft, its pump light, the browning plot above it.

Earth strata on the two back walls and the floor are desaturated ochre, sienna and slate bands, dark enough that the cyan dominates.

**What moves.**
- The water table: a luminous translucent sheet inside the block, breathing up with each monsoon and sagging down through each dry season, dimpled into a cone under every pump.
- The water line on the cut walls, rising and falling in step, like the level in a fish tank seen side-on.
- Pulses of light travelling up each well shaft, rate proportional to pumping.
- Rain streaks over the surface in monsoon; crop colour cycling with the season.
- A year counter and one numeral: "Wells alive 47 / 60".
- Wells failing: a shaft's pulses stop, it flashes ember, goes ash; the pump light on the surface dies; a small tag "DRY 2031" pins to it.

**README hero.** A still of the moment about a third of the wells are dark: a glowing cyan sheet with visible cones, a forest of lit and dead straws, the dusk village on top. As a still image this beats GREENWAVE's; as a GIF it is slower.

### First 10 seconds, zero interaction

| Second | What is on screen |
|---|---|
| 0-2 | Poster-matched frame: the block, dusk, all wells lit, water table high. Title and one line overlaid: "Every borewell is a straw in the same glass." |
| 2-5 | Years start running at about 3 seconds per year. Monsoon lifts the sheet, the dry season drags it down further than it rose. Cones are visible under the big pumps. |
| 5-8 | The sheet drops past the shallowest well tips. First well flashes ember and goes dark; then two more. Counter ticks 60, 59, 57. |
| 8-10 | Camera eases down and in toward the cluster of dead wells; caption: "Same water. Everyone pumping." |

The first well must die by second 6. If the first failure is at second 20, the judge has watched a blue sheet wobble and has left.

### First deliberate interaction and its payoff

Click any farm. A two-button card: **Drill deeper** / **Plant sugarcane**. Choose drill: the judge's straw extends downward with a drilling animation, its pulses speed up, its cone deepens, and within about 4 seconds of sim time the three neighbouring wells whose tips now sit above the deepened cone go ember, then dark. Caption: "Your well survived. Three neighbours did not."

This is the best interaction of any idea in either round, including DELUGE's pond drop, because the judge's own choice causes harm they can see. GREENWAVE's switch is cleaner; this one is remembered.

Second interaction: the **Cooperative plan** switch. Surface crops re-tile to a different mix with a staggered wipe, pump pulses even out, the sheet stops falling, and dead wells relight one by one as it recovers. This is AQUIFER's equivalent of the Fixed / RL switch and must be exactly one control.

---

## 2. Is the visual the product?

**Yes. Integrity 9.**

- The water-table surface is the simulator's state, drawn directly. Nothing is a metaphor.
- The vertical dimension carries the information. Well depth versus water level is the entire story, and it cannot be shown on a map. This is a stronger justification for 3D than GREENWAVE has (traffic reads fine in 2D top-down; GREENWAVE's 3D is partly atmosphere).
- The optimizer's output is visible twice: as the crop mix on the surface and as the pump pulse rates in the shafts. Its consequence is visible as wells staying lit.
- Delete the canvas and what remains is a line chart of water level and a table of crops, which nobody would believe or feel.

Why not 10: the forecast model (the "AI" most judges will look for) has no natural place in the scene. A water-level forecast is a line chart. The fix is cheap and should be done: draw the forecast as a **ghost sheet**, a faint wireframe or dotted contour surface showing where the table will be in N years, with the real sheet sinking toward it, and mark held-out observation wells as a distinct white-ringed straw with a small predicted-versus-observed tick on the shaft. Without that, the AI visible in the scene is only the optimizer and the forecast lives in a side panel.

Second deduction: interference between cones, which is the actual commons mechanism, is subtle on a smooth sheet. It needs contour lines on the surface (see section 3) to be seen rather than asserted.

---

## 3. Techniques for a premium look

### The central decision: absent earth, not glass earth

True "glass earth" means a large transparent volume containing another transparent surface containing emissive tubes. On the web that is the classic sorting disaster, and the physically based route (transmission) costs a full extra scene render per material. So:

- **The earth inside the block is simply not drawn.** The block is a hollow stage: a thin surface slab on top (about 2 percent of block height, with a soil-profile texture on its cut edge), opaque strata on the two back walls and the floor, and a dark interior.
- "Glass" is suggested by a **fresnel rim** on a single thin shell around the block's front edges and a few faint horizontal strata lines drawn additively across the two open faces. Additive blending needs no sorting.
- The **only** alpha-blended object in the scene is the water-table sheet. One transparent layer means no depth peeling, no order-independent transparency, no sorting bugs.

This reads as a see-through block and costs almost nothing.

### Component by component

**Cut walls (the cross-section).** Opaque. A strata texture: 5-7 bands with noise-perturbed boundaries, slight dip, speckle for gravel, darker fractured band near the base. Either a baked 2k texture from Blender or a fragment shader banding by world Y plus noise. In the same shader, sample the head (water level) texture along the wall's edge and **tint everything below the water line cyan with a bright 2-pixel line at the level itself**. This gives the judge a textbook side-on water line that moves, for free, and it is the single most legible element in the scene. Leave a darker "high-water mark" stain where the level used to be, so the fall is visible even in a still.

**Water-table sheet.** A 128 x 128 plane displaced in the vertex shader from a head texture. The simulation is a 2D diffusion-type solve on about 16k cells, which is trivially cheap on the CPU: run it in a Worker, upload a `Float32Array` as a `DataTexture`, or pack to RGBA8 if float textures are unavailable. No float render targets or ping-pong are required, which removes the compatibility risk that held DELUGE to a 5. Shading: normal from the height gradient, fresnel (more opaque at grazing angles, clearer looking down), animated **iso-contour lines** every N metres of head via `fract()` and `fwidth()` so cones read as nested rings and two overlapping cones visibly merge, soft additive glow. Draw double-sided with `depthWrite: false`.

**Cones of depression.** At 128 cells over 2 km a cell is about 16 m; real cones are steep near the bore, so the grid alone gives soft dents. Add an analytic sub-grid dimple per well in the vertex shader (log-shaped drawdown scaled by that well's pumping rate, passed as a small uniform array or a second data texture). Disclose it: "near-well drawdown uses the analytic steady-state profile". With 8x vertical exaggeration the cones become the picture.

**Saturated zone ("the water below the sheet").** Do not do volumetrics. Three fakes, in order of value:
1. The cyan wall tint above (already done).
2. A floor glow: the block's floor gets a cyan emissive whose strength follows saturated thickness (head minus bedrock) from the same texture.
3. Optional: 8-12 stacked additive horizontal slices below the sheet, each clipped to "below head", at very low alpha. Additive, so no sorting. Drop on low tier.

**Wells.** One `InstancedMesh` of thin cylinders, per-instance depth, state and pump rate as instance attributes. Shader: the shaft above water is a dim warm line; **the part below the sheet glows cyan** (compare fragment world Y with head sampled at the well's XZ); pulses travel upward as a scrolling band whose speed is the pump rate. Dry state: pulses stop, 0.5 s ember flash, decay to ash. A small emissive ring where each shaft pierces the sheet makes the intersection read. Pump huts on the surface are a second instanced draw with an amber or dead light.

**Refraction and caustics.** Fake both or skip both. Refraction: none, or a cheap screen-space UV offset when sampling a pre-rendered opaque buffer, only on the high tier. Caustics: a scrolling tiled caustic texture multiplied onto the floor and the lower walls under the sheet, masked by "below head". That is a 10-line shader addition and sells "water" more than real refraction would.

**Surface.** Dusk does the heavy lifting. Fields as flat tiles with slightly different heights and a per-plot colour from crop type and stress; crops as instanced cards or a shell-fur shader, 20-40k instances, never modelled plants. A dozen low-poly houses, a temple or water tank as a landmark, trees, bunds. Baked AO on the surface slab. Rain as instanced streaks in monsoon.

**Post.** Plain Bloom at half resolution on un-tone-mapped emissives; a tilt-shift band keeping the middle of the block sharp; vignette; ACES or AgX tone mapping; a faint dust-mote particle field inside the hollow block for depth. No selective bloom.

**Labels.** SDF text anchored in 3D with thin leader lines: "Water table", "Borewell", "Dry", "Bedrock", shown for the first 6 seconds of autoplay and on hover thereafter. A depth ruler along the front vertical edge of the block in metres.

### Cheap-looking failure modes

1. **Blue jelly cube.** The earth drawn as a semi-transparent brown or blue box with `opacity: 0.3`, sorting artefacts flickering as the camera orbits, straws popping in front of and behind the sheet. This is the default outcome if someone takes "glass earth" literally. It is the main risk.
2. **Bathtub plane.** A flat blue rectangle sliding up and down. If there are no cones and no contours, the sheet is a slider, not a simulation. Same failure as DELUGE's bathtub.
3. **Murk.** Dark brown strata, dark blue water, dark void, heavy bloom: an unreadable smudge on a laptop at 40 percent brightness in a lit room. Test at low screen brightness.
4. **Minecraft farm.** Daylight, saturated green squares, cone trees, default lighting. Dusk and long shadows are not optional.
5. **Spaghetti.** Sixty identical grey cylinders with no state colour: a bed of nails. Wells need three clearly different states and a lit tip.
6. **Honest scale.** Without vertical exaggeration the block is a pizza box, the wells are hairs and the water-table movement is two pixels. Exaggerate and label it.
7. **Nothing happens.** Real aquifers move slowly. If time compression is timid, the first 10 seconds are a still life.
8. **Glass done "properly".** `MeshTransmissionMaterial` on the block: looks expensive in a hero still, halves the frame rate on an integrated GPU and cannot see the transparent sheet inside it anyway.

### References

Search-verified (appeared in results today with matching description; not opened or run):

- **three.js `webgl_gpgpu_water` example** (https://threejs.org/examples/webgl_gpgpu_water): a simulation texture (forum description: 128 x 128 via `GPUComputationRenderer`) driving a displaced plane. Proves the "sheet displaced by a sim texture" pattern on the web. Existence and description verified; the exact URL is the standard examples path and is inferred.
- **Evan Wallace's WebGL Water** (https://madebyevan.com/webgl-water, source mirrored at github.com/evanw/webgl-water): heightfield water with caustics in a glass-sided box, viewed from outside. The closest thing on the web to "water seen through the walls of a cut block", and the quality bar for the sheet. Verified as heightfield water needing float textures; that it shows a box with caustics is inference from my own knowledge.
- **three.js `webgl_clipping_stencil` example** (https://threejs.org/examples/webgl_clipping_stencil): clipping planes with stencil-capped cut faces; multiple forum threads build on it and report breakage across versions (r163 migration). Proves capped cross-sections work, and also proves they are fiddly. Use it only if the cut must be movable; for a fixed cut, model the cut faces as ordinary geometry and skip stencils entirely.
- **`Material.alphaHash`** (https://threejs.org/docs/pages/Material.html) and the `webgl_materials_alphahash` example: hashed/dithered transparency, works on any material, no extra render pass; forum users report visible grain that wants TAA. Useful for fading the surface slab or a wall when the camera goes underground; not for the water sheet (grain under bloom looks dirty).
- **drei `MeshTransmissionMaterial`** (https://drei.docs.pmnd.rs/shaders/mesh-transmission-material): docs and forum threads confirm each transmissive material adds a scene render unless `transmissionSampler` is used, in which case it sees opaque objects only; one thread reports the transmission pass taking almost half the frame. This is the evidence for *not* using it on the block.
- **react-postprocessing TiltShift2** (https://react-postprocessing.docs.pmnd.rs/effects/tilt-shift-2): tilt-shift with controllable band; proves the diorama look is a drop-in.
- **Australian Bureau of Meteorology 3D Aquifer Visualisations** (https://www.bom.gov.au/water/groundwater/explorer/3d-aquifer-visual.shtml): government 3D aquifer blocks with cut cross-sections, distributed as interactive PDFs, not live web scenes. Useful as an art reference for strata blocks and as evidence that the browser version is not already common.
- **ArcGIS Pro 3D diorama tutorial** (https://www.esri.com/arcgis-blog/products/arcgis-pro/mapping/how-to-make-a-3d-diorama-in-arcgis-pro): terrain block with geologic layers drawn on the cut walls. Art-direction reference for the block-diorama composition only.

**Not found.** I searched for an existing three.js cutaway-terrain diorama with strata on the cut faces and a moving subsurface water surface, and for a live web groundwater twin with wells and a water table. Neither turned up; the nearest were a Cesium-based water chemistry atlas described in a paper, an X3DOM subsurface cross-section prototype, and desktop tools. So, as with PULSE in round 1, **the complete look is not proven by an existing web demo**; each ingredient is. That is good for originality and bad for achievability, and it is priced into the 6.

Inference (not checked today): contour lines via `fract`/`fwidth`; scrolling caustic texture fake; analytic near-well drawdown in the vertex shader; a CPU diffusion solve on a 128 grid being comfortably real-time in a Worker; instancing budgets below.

---

## 4. Readability risk

**Will a judge understand it in 10 seconds without reading? Not by default. Yes, if four things are done.** This is the idea's real weakness against GREENWAVE, where "red line of cars = stuck" needs no schooling. A glowing sheet inside a box is not a familiar image; a judge can mistake it for a lake, a force field or a data surface.

What makes it legible:

1. **The side-on water line on the cut walls.** People understand a liquid level in a container seen from the side. The 3D sheet alone is ambiguous; the 2D line on the wall disambiguates it instantly. This is the most important single element.
2. **The straw metaphor made literal.** Tip in the water: lit and pulsing. Tip above the water: dark. The title line says "straw". The pulses travel upward. A lit ring marks where the straw meets the water.
3. **Three colours, three meanings,** used nowhere else (cyan water, amber alive, ember/ash dry). No rainbow ramps, no legend needed.
4. **A surface consequence for every underground event.** When a well dies, its pump light dies and its plot browns. The judge who never looks underground still sees the village going dark, field by field.

Supporting measures: four 3D labels with leader lines in the opening seconds; a depth ruler; one headline numeral ("Wells alive") rather than a panel; captions of eight words or fewer; the year counter large.

Camera moves that help:
- Open on the standard three-quarter view so "this is a village" registers first.
- At the first failure, ease down to near eye-level with the water sheet for 2-3 seconds, so the gap between the tip and the water is seen in profile, then return.
- For the plan switch, hold the wide shot and do not move at all; the change must be attributable to the switch, not to the camera.
- Never go inside the block in autoplay. Interior views lose the container and the judge loses orientation.

Remaining risk even with all of this: the tragedy-of-the-commons point (my pumping kills *your* well) is a causal claim, and causality is hard to see in ambient autoplay. It becomes visible only in the click-a-farm interaction, so autoplay must perform that interaction with a ghost cursor.

---

## 5. Performance risk and graceful degradation

**Risk level: low to moderate, lower than DELUGE, similar to GREENWAVE.** The scene is small and bounded.

Budget on an integrated GPU (Intel UHD / Iris class), inference:

| Item | Cost | Note |
|---|---|---|
| Block walls, floor, surface slab | 3-5 draws, opaque | negligible |
| Water sheet 128 x 128, one alpha-blended layer | 1 draw | overdraw is the cost; it covers a third of the screen once |
| Wells, 50-150 instances | 1 draw | negligible |
| Crops, 20-40k cards | 1 draw | the largest vertex load; fine |
| Props | 1-2 merged draws | negligible |
| Bloom half-res, tilt-shift, vignette | 3-4 full-screen passes | the real cost; this is where integrated GPUs lose frames |
| Simulation, 128 x 128 CPU in a Worker | about a millisecond per step | no GPU cost, no float-target dependency |

Traps:
- **Transmission/refraction materials**: each adds a scene pass (search-verified). Do not ship them below the top tier.
- **Stacked volume slices**: 12 additive full-block layers is 12x overdraw over a third of the screen. Low tier drops to zero slices.
- **DPR**: a retina integrated-GPU laptop at DPR 2 with three post passes is the most likely way to fall under 30 fps. Cap DPR at 1.5, and at 1 on the low tier.
- **Per-frame texture upload**: 128 x 128 floats is 64 KB; fine. Do not go to 512.
- **alphaHash grain** under bloom if used on large surfaces.

Degradation ladder, chosen from measured frame time over the first 2 seconds (not user-agent sniffing):

| Tier | Changes |
|---|---|
| High | Everything: slices, caustic fake, dust motes, tilt-shift, bloom, DPR 1.5, 40k crop cards, screen-space refraction offset on the sheet |
| Medium | No slices, no refraction offset, bloom at quarter-res, 15k crop cards, DPR 1.25 |
| Low / mobile | No tilt-shift, bloom off (emissives pre-brightened and a cheap sprite glow at well tips), crops as coloured tiles with a normal-mapped texture, 64 x 64 sheet, DPR 1, sim at 5 Hz interpolated |
| No WebGL | The hero video plays in place of the canvas |

Mobile specifics: a near-cubic block suits portrait better than GREENWAVE's wide city does; frame the cut corner vertically and it fills the phone screen. Tap targets for farms need a minimum 44 px hit radius. Autoplay runs from a **recorded seed** on every tier so it is identical everywhere; because the sim is on the CPU and deterministic, "recorded" can simply mean fixed inputs.

First paint: ship a poster screenshot as the canvas background; total critical payload under about 4 MB (one block glTF with meshopt, one 2k strata texture in KTX2, one caustic tile, one prop atlas).

---

## 6. Blender: what for, what not

**Use Blender (scripted) for:**
- The block itself: surface slab with a bevelled cut edge and soil-profile lip, back walls, floor, a thin plinth. Clean UVs on the cut faces.
- **Baking the strata cross-section texture**: procedural noise bands with dip and gravel speckle baked to a 2k image. Far faster to iterate there than in GLSL, and it is the texture the judge stares at most.
- Baked AO / soft dusk lightmap for the surface slab and props so the surface looks lit without real-time shadows.
- A small prop kit, each under about 300 tris: three house variants, pump hut, hand pump, water tank, temple or panchayat building, trees, a tractor, bund walls. Pull from free libraries where possible and restyle to one palette.
- Laying out the village from the real plot polygons (script: import GeoJSON plots, extrude tiles, scatter props), then exporting one merged glTF.
- The camera path: author the autoplay spline and export it as keyframes, so framing is designed by eye rather than by numbers in code.
- A fallback poster and, if time allows, one Cycles beauty render for the README **labelled as a render**, never passed off as the live demo.

**Do not use Blender for:**
- The water table. It is runtime simulation state; nothing baked can respond to a click.
- The wells. They must be instanced from data so depth, position and state are true; a modelled well field cannot be drilled deeper.
- Any glass or volume look built on Cycles/EEVEE shaders. It will not export and will set an art target the web scene cannot hit.
- Crops as modelled plants, or geometry-nodes scatter exported as real geometry. Instance at runtime.
- Fluid simulation, baked animation of water or seasons, or sculpted realistic terrain. A near-flat village with bunds is correct and cheaper.
- A dressed back side or underside of the block. The camera never goes there.

Blender time cap: one person, one day, finished by the end of day 2. The shaders, not the assets, decide whether this looks premium.

---

## 7. Scores and reasoning

**(a) First-10-seconds wow: 7.** A glowing cut block of earth with a forest of lit straws is a fresh, composed, screenshot-worthy image, and it will stand out against a field of Streamlit apps as much as GREENWAVE would. It loses two points to GREENWAVE for three reasons: the motion is slow and low-frequency (one sheet breathing versus thousands of moving lights); the image needs half a second of decoding that a traffic jam does not; and the drama (wells going dark) is a subtraction of light, which is quieter than GREENWAVE's clots dissolving. Ceiling is 8 with aggressive time compression, the wall water line and a first death by second 6. Floor is 4 if it ships as a blue jelly cube.

**(b) Visual-is-the-product integrity: 9.** Level with GREENWAVE and arguably more honest about needing the third dimension. Loses the tenth point because the forecast model is not naturally in the scene and cone interference is subtle without contour lines.

**(c) Achievability of a premium look in 3.5 days: 6.** For: bounded scene, one block, no city pipeline, CPU sim with no float-target risk, single transparent layer if the absent-earth rule is followed, dusk plus emissive plus bloom is the cheap-premium spine from round 1. Against: no existing web demo proves the whole composition, so the team is doing art direction from scratch; the look depends on three custom shaders (wall water line, sheet with contours, well shaft state) being right; the surface is a small farm scene, which is the category round 1 flagged as where web 3D looks cheap fastest; and the readability work in section 4 is real time. GREENWAVE's 7 rests on a look with shipping references (TripsLayer-style night traffic); AQUIFER's does not.

### GREENWAVE or AQUIFER

GREENWAVE on this lens: 25 points to 22. Where each wins:

| Moment | Winner | Why |
|---|---|---|
| Second 3, no clicks | GREENWAVE | More motion, zero decoding |
| Second 10, no clicks | GREENWAVE, narrowly | Queues draining versus first wells dying |
| README still image | AQUIFER | Composed object with a clear silhouette; a night city still is generic |
| README GIF | GREENWAVE | The wipe is a 4-second story |
| First interaction | AQUIFER | "You killed your neighbours' wells" beats a toggle |
| The switch (AI on) | GREENWAVE, narrowly | Faster visible response; AQUIFER's recovery takes sim-years |
| Seen-it-before risk | AQUIFER | Night-city traffic visualisations exist; this image does not |
| Worst-case execution | GREENWAVE | Mediocre GREENWAVE is still lights moving on roads; mediocre AQUIFER is murk |

### What closes the gap

1. Absent earth plus the moving water line on the cut walls. Build this first; it decides readability.
2. Time compression and vertical exaggeration tuned so a well dies by second 6 and cones are deep enough to see from the hero camera.
3. Ghost-cursor "drill deeper" inside autoplay, so the commons mechanism is shown without the judge clicking.

If these are in by the end of day 2, AQUIFER is an 8 / 9 / 6 and the choice between the two should be made on other lenses. If on day 2 the block still looks like jelly, GREENWAVE was the right call.

---

## 90-second video storyboard

| Time | Shot | On screen | Caption / VO |
|------|------|-----------|--------------|
| 0:00-0:05 | Cold open, no logo. Top-down on a village at dusk, pumps humming, lights on. Looks like any farm map. | Fields, pump lights, year "2026". | "A village. Sixty borewells." |
| 0:05-0:12 | Camera drops and tilts; the ground's front faces peel away to reveal the block's interior, straws reaching down into a glowing sheet. | The reveal. Labels: "Water table", "Borewell". | "This is what they share." |
| 0:12-0:16 | Title over the live scene. | AQUIFER, one line. | "Every well is a straw in the same glass." |
| 0:16-0:28 | Hold three-quarter. Years run. Monsoon lifts the sheet, each dry season drops it further. Water line falls on the cut wall, leaving a stain. First wells go ember, then dark; plots brown above them. | Year counter, "Wells alive 60 → 41". | Silence 4 s, then "Each pump lowers the water under its neighbours." |
| 0:28-0:40 | Push in on one farm. Cursor clicks "Drill deeper". Straw extends, cone deepens with contour rings, three neighbours die. Brief eye-level profile shot of tips hanging above the water. | Tag: "Your well: alive. Neighbours: 3 dry." | "Drill deeper and you win. For a while." |
| 0:40-0:46 | Pull back; fast-forward. Most of the field is dark. | "Half the wells dry by 2034." | "Everyone drills. Everyone loses." |
| 0:46-0:60 | Reset to 2026, same camera. Cursor flips "Cooperative plan". Crops re-tile across the surface, pulses even out, the sheet steadies. Years run again; wells stay lit. | Counters side by side: business as usual versus plan. | "Same village. Same rain. A shared plan." |
| 1:00-1:08 | Vertical wipe, identical seed: left dark field in 2040, right fully lit. | Years of water gained, income retained. | "X more years of water. Y% of income kept." |
| 1:08-1:18 | Forecast beat: ghost wireframe sheet below the real one; white-ringed observation wells with predicted-versus-observed ticks. | Error versus persistence baseline. | "Forecast checked against wells it never saw." |
| 1:18-1:24 | Proof card over the scene. | Data sources, real village layout, "simulation, not a field trial". | "Real layout. Public data. Runs in your browser." |
| 1:24-1:30 | Return to the hero three-quarter, plan on, monsoon rain falling, sheet rising. End card with URL. | Final numerals. | "Open it. Drill a well." |

The top-down-then-reveal opening is for the video only. The live demo opens already cut away, because the zero-click rule does not allow a 7-second preamble.

## Autoplay mode (58-second loop)

Follows the shared rules in round 1: opens directly into the moving scene, scripted timeline driving the real simulation from a fixed seed, small "Live simulation, fixed seed" tag, any input hands over control, resumes after 20 seconds idle, captions lower-third and eight words or fewer, sound assumed off.

| Time | Beat | Caption |
|------|------|---------|
| 0-2 | Poster-matched hero three-quarter, all wells lit, sheet high. Title fades. Four 3D labels visible. | "Sixty wells. One aquifer." |
| 2-10 | Years run at about 3 s each. Sheet sags, wall water line drops, first well dies by second 6, three by second 10. Camera eases in and down. | "Everyone pumping" |
| 10-14 | Eye-level profile of dead tips above the water, then back up. | "The water fell below them" |
| 14-24 | Ghost cursor clicks a farm, chooses "Drill deeper". Straw extends, cone deepens, three neighbours go dark. | "One farmer drills deeper" |
| 24-30 | Fast-forward to mostly dark. Counter falls. | "Half the wells dry by 2034" |
| 30-33 | Rewind sweep: years spin back, wells relight in reverse. | "Same village, again" |
| 33-45 | Ghost cursor flips "Cooperative plan". Camera locked. Crops re-tile, pulses even out, sheet holds through the same years. | "A shared crop and pumping plan" |
| 45-52 | Split wipe: business as usual versus plan, numerals each side. | "X more years of water" |
| 52-58 | Slow orbit of the lit block in monsoon rain; ends on the hero frame so the loop point is also a hero frame. | "Click a farm to try" |

On any input: camera eases to a constrained orbit (azimuth limited to the cut corner, elevation 10-50 degrees, no going inside), and a dock appears with three controls: **[Business as usual / Cooperative plan]**, **[Rainfall: normal / drought]**, and a year scrubber. Clicking a farm opens the two-button card (Drill deeper / Change crop). Nothing else; no settings panel.

---

## One paragraph for the team

AQUIFER has the more original image and the more memorable interaction, and its 3D is doing real work because the story is vertical. But it is slower, quieter and harder to read than GREENWAVE in the first seconds, and no existing web demo proves the look, so it can end up as a murky blue box. If you build it: do not draw transparent earth, draw the water line on the cut walls, exaggerate the vertical, compress time until a well dies by second 6, and have autoplay perform the "drill deeper" betrayal itself. Judged only on visual and demo power, GREENWAVE is still ahead, 9 / 9 / 7 to 7 / 9 / 6.
