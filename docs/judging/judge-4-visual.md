# Judge 4 — Visual Impressiveness and Demo Experience

Lens: only what a tired, asynchronous judge sees and feels in the first 10 seconds, the first 60 seconds, the README hero, and a 2-minute video. Originality, impact and ML depth are other judges' problems. Scores are not flattering on purpose.

## How I am judging

Three rules decide almost everything:

1. **Zero-click rule.** The judge clicks a link on an unknown laptop, probably integrated graphics, possibly no webcam, possibly with the tab muted. Whatever is on screen at second 3 with no interaction is the entry. Anything behind a permission prompt, an upload, a text box or a "Start" button does not count towards wow.
2. **Visual-is-the-product rule.** If you could delete the 3D canvas and the app would still deliver the same answer in a card, the 3D is decoration and judges can smell it. The AI's output must be *seen in the scene*, and ideally the AI must *change the scene's behaviour* in a before/after the eye can read without a legend.
3. **Dark-scene economics.** In 3.5 days, the premium look that is reliably achievable is: night/dark scene, emissive instanced geometry, restrained bloom, one good tone-mapper, slow authored camera. Daylight PBR realism, vegetation, organic anatomy and skin are where web 3D looks cheap fastest.

### Reference status

"Search-verified" means the project or page appeared in my web search results during this review with a description matching the claim. I did not open the pages or run the demos, so treat even those as "exists and is described as such", not "I confirmed it runs at 60 fps". "Inference" means from my own knowledge, not checked today.

---

## 1. PULSE — camera vitals with a 3D heart twin

**Hero shot.** Split frame on near-black: left third is a face in a webcam tile with a subtle mesh overlay and a green ROI on the forehead and cheeks; right two-thirds is a wet, subsurface-lit anatomical heart mid-contraction, a bright conduction wave travelling from the SA node down the septum, and a raw PPG trace streaming along the bottom edge in the same colour as the wave. In the GIF: the heart beats, the trace scrolls, the BPM numeral ticks, and each beat lines up with a peak in the trace.

**First 10 seconds, zero interaction.** Honest answer: a camera permission prompt, or a heart beating to a canned sample. The whole pitch ("your own heartbeat") lives behind a browser permission dialog that many judges will deny or not have hardware for. So the autoplay state must be a recorded subject with the heart already beating, and a single large "Use my camera" button. With the recorded sample, the judge is watching a looping heart animation, which is a stock-asset look.

**First interaction and payoff.** Allow camera, hold still about 10-15 seconds, heart re-syncs to your pulse. The payoff is strong *if it works*, and it is the only idea of the eight with a personal, bodily hook. If it reads 58 then 112 then 74 under office lighting, the judge concludes the heart is a metronome. Second interaction: "simulate AF" toggle that makes the conduction wave chaotic and the beat irregular.

**Is the visual the product?** Partly. The heart displays one scalar (rate) and one flag (irregular). The PPG trace is the actual information; the heart is a very expensive BPM gauge. It becomes the product only if beat-to-beat intervals drive each contraction individually (so HRV is visible as uneven rhythm) and the AF flag changes the conduction pattern.

**Premium techniques.**
- Heart as a glTF with 2-3 morph targets (atrial systole, ventricular systole) driven per detected beat, not a looped clip; influences set directly from the beat detector.
- Fake subsurface: thickness-map-based transmission or a wrap-lighting + fresnel rim shader; clearcoat for wetness; one key, one cold rim light.
- Conduction wave as a shader on a second UV set: a scalar "activation time" baked per vertex in Blender, lit by `smoothstep(t - activation)`. This is the single most information-carrying visual and it is cheap.
- Depth of field and mild bloom on the wave only; PPG trace as a GPU line with fading tail.
- **Cheap-look failure:** a Sketchfab heart scaling up and down with `sin(t)` in flat red plastic under default lighting. That is every "3D heart" CodePen.

**References.** Search-verified: three.js official skinning-and-morphing example (https://threejs.org/examples/webgl_animation_skinning_morph) shows glTF morph playback; my search found *no* published demo combining an anatomical heart, per-beat morph targets and a live signal, so this look is not proven on the web by an existing demo. Inference: MediaPipe Face Landmarker runs in-browser on WASM/GPU at usable frame rates.

**Performance.** The heart is trivially cheap. The cost is face tracking plus signal processing competing with the render loop on an integrated GPU; expect camera at 30 fps and render dropping. Mobile is actually fine for the front camera and is a nice surprise. Degradation: cap DPR at 1.5, drop DoF, run face mesh every other frame; no-webcam path is the recorded sample with a visible "sample subject" label.

**Blender.** Use it for: retopologising a CC heart to under 40k tris, authoring the systole shape keys, baking the per-vertex activation-time attribute, baking AO and thickness maps. Do not use it for: sculpting a heart from scratch (a day gone), baked animation clips (they cannot follow a live signal), or a cutaway interior nobody will look at.

**Scores.** Wow 6 (9 with webcam and good light, 4 without), integrity 6, achievability 6.

---

## 2. FUNDUS — DR screening on a 3D eye

**Hero shot.** Camera inside a dark eyeball looking at the curved retina: the orange fundus photo wrapped on the inner sphere, vessels glowing faintly, a cluster of lesions pulsing in magenta/yellow with thin leader lines to labels, a severity dial in the corner. In the GIF: the camera flies through the pupil and the heatmap wipes across the retina.

**First 10 seconds, zero interaction.** An eyeball exterior turning slowly, then an autoplay fly-through of the pupil onto a sample retina. The fly-in is a good 4-second beat. After that the judge is looking at a 2D photo on a curved surface.

**First interaction and payoff.** Click a sample thumbnail, heatmap sweeps on, lesion pins appear. Payoff is a coloured overlay on a photo, which is exactly what the 2D version would show, slightly distorted.

**Is the visual the product?** No. This is the clearest decoration case of the eight. A fundus photo is a flat ~45 degree patch; wrapping it on a sphere adds no information and makes lesion location *harder* to read. The candidate doc's own risk note is right. The only way to earn the 3D is anatomical context (macula and optic disc landmarks, "this lesion is 1 disc diameter from the fovea, which is why it is urgent") and that is a labelling feature, not a 3D feature.

**Premium techniques.**
- Inner-sphere projection with correct field-of-view mapping, not a full-sphere wrap; vignette to black outside the imaged field.
- Heatmap as an additive emissive layer with animated threshold reveal, not a jet-colormap overlay.
- Cornea/lens with transmission and IOR for the exterior shot; iris from a real texture.
- Spline camera through the pupil with a FOV kick.
- **Cheap-look failure:** a rainbow Grad-CAM blob on a stretched JPEG on a sphere, plus a glassy stock eyeball that looks like a Halloween prop.

**References.** None searched for this idea; everything here is inference. three.js `MeshPhysicalMaterial` transmission is standard and adequate for the cornea.

**Performance.** Negligible risk; one sphere and a texture. Transmission adds a pass; disable on mobile. Runs anywhere.

**Blender.** Use it for: the exterior eye (cornea, iris, sclera) and the camera path. Do not use it for: the retina (it is a runtime projection), or vitreous volumetrics.

**Scores.** Wow 5, integrity 3, achievability 7.

---

## 3. TERRA — 3D digital twin of a farm

**Hero shot.** Low oblique dawn view over a real field block with gentle terrain relief, satellite texture desaturated, field parcels extruded slightly and coloured by a health ramp (deep green to amber to rust), one zone pulsing as stressed, thin blue animated lines running along irrigation channels into the zones scheduled for water, and a season timeline at the bottom with the scrubber mid-move. In the GIF: the scrubber drags and the colour field breathes through the season while stress spreads from one corner.

**First 10 seconds, zero interaction.** Camera settles over a pre-baked field, the season auto-scrubs, stress blooms in one zone, a callout attaches to it. This is a decent open, but colour on terrain reads as "GIS dashboard tilted" unless the terrain relief and lighting are good.

**First interaction and payoff.** Drag the time slider: NDVI field animates. Click a stressed zone: irrigation plan appears and water visibly flows to it. This is a real payoff and the scrub is tactile.

**Is the visual the product?** Mostly yes. Per-zone health over time and where water goes are spatial data; the map is the right display. The leaf-photo pin is a bolt-on.

**Premium techniques.**
- Terrain from DEM tiles with satellite drape; exaggerate vertical 2-3x, add hillshade and a low sun.
- NDVI as a data texture sampled in the terrain shader with temporal interpolation between acquisition dates, so scrubbing is smooth rather than stepped.
- Crops: do **not** model plants. Use a shell/fin "fur" shader or instanced grass cards with height and colour driven by the NDVI texture; from the oblique camera it reads as crop canopy.
- Water as animated flow lines (UV-scrolling emissive ribbons) and a darkening wet-soil mask, not a fluid sim.
- **Cheap-look failure:** flat Leaflet-style tile on a plane with a red/green choropleth and low-poly cone "plants". Also: daylight with default lighting makes satellite tiles look like a blurry carpet.

**References.** Search-verified: three-geo (https://w3reality.github.io/three-geo) builds satellite-textured terrain from coordinates in three.js; geo-three (https://github.com/tentone/geo-three) is a tile-map library for three.js. Both depend on tile providers that may need keys, so pre-bake the demo fields to static assets. Inference: MapLibre GL terrain plus a custom layer would also work.

**Performance.** Terrain mesh and a data texture are cheap. Instanced grass at density is the risk on integrated GPUs; budget about 50-100k blades with LOD by distance, and fall back to the shader-only canopy on mobile. Satellite fetch latency is the real killer for the first 10 seconds, hence pre-baked fields.

**Blender.** Use it for: a few hero props (pump house, drip lines, a tractor, trees) and possibly baking the demo terrain with a nice hillshade. Do not use it for: crops (thousands of plants, will look like a mobile game) or the terrain itself for user-picked fields.

**Scores.** Wow 6, integrity 8, achievability 5.

---

## 4. KINETIC — AI tutor that generates 3D simulations

**Hero shot.** A clean studio scene: Earth with a satellite on a glowing orbital trail, a velocity vector arrow and a gravity arrow drawn in SDF-labelled lines, a slider mid-drag, and the orbit trail deforming into an ellipse. Chat prompt "why do satellites stay in orbit?" visible above. In the GIF: text is typed, the scene assembles piece by piece, the slider moves, the satellite falls and burns.

**First 10 seconds, zero interaction.** A text box. This is the problem. The idea's wow is entirely post-prompt, and a judge who types nothing sees a chat UI with a pretty background. Autoplay must type a question itself and build the sim, or this scores as a chatbot.

**First interaction and payoff.** Type a question, wait for LLM latency (3-10 seconds of nothing), sim appears. Payoff is high when it lands. When the judge types something outside the primitive library, they get a degraded or wrong sim, and that is the moment they score it.

**Is the visual the product?** Yes, fully. The simulation *is* the answer. Integrity is high; reliability and polish are the issue.

**Premium techniques.**
- A consistent "lab" art direction applied to every primitive: matte studio backdrop, soft contact shadows, one accent colour, SDF text labels, thick anti-aliased vector arrows, motion trails.
- Assembly animation (objects scale/fade in with stagger) to cover LLM latency and make generation feel deliberate.
- Each primitive hand-polished; five gorgeous primitives beat thirty grey-box ones.
- **Cheap-look failure:** default-material spheres and boxes on a grid helper with dat.GUI sliders. Generated scenes default to exactly this unless every primitive is art-directed in advance, which is a per-primitive cost the team cannot pay 20 times in 3.5 days.

**References.** None searched for this idea; inference only. The pmndrs stack (drei `Text`, `Trail`, `ContactShadows`, Rapier physics bindings) covers the toolkit.

**Performance.** Light per scene. Risk is not GPU but latency and API cost/keys on a public demo. Degradation: cached pre-generated sims for the suggested prompts so the first three clicks are instant.

**Blender.** Use it for: a handful of hero props (satellite, pendulum rig, beaker) and the studio backdrop. Do not use it for: anything generated at runtime; the look must come from materials and lighting, not assets.

**Scores.** Wow 5, integrity 8, achievability 3.

---

## 5. GREENWAVE — RL traffic signals on a 3D city twin

**Hero shot.** Night aerial three-quarter view of Silk Board junction: dark extruded buildings with faint window emissives, wet-look roads, thousands of vehicles as white headlight and red tail-light streaks. The frame is split by a vertical wipe: left half "Fixed timers" with long solid red queues backing up every arm; right half "GreenWave RL" with the same roads flowing in broken streaks. Three large numerals float over it: average delay, stops, CO2. In the GIF: the wipe slides across and the red clots dissolve behind it.

**First 10 seconds, zero interaction.** Camera descends from city scale onto the junction while traffic is already jammed under fixed timers; at about second 6 the controller switches itself to RL with a visible pulse through the signals, and queues begin to drain while counters roll down. No click needed, and the before/after reads without a legend: red means stuck.

**First interaction and payoff.** One switch: Fixed / RL. Payoff within 5-10 seconds of sim time as queues shorten. Second: "Send ambulance" and a green corridor lights ahead of a blue strobing vehicle along its route. Both are single-click, both have a legible visual consequence.

**Is the visual the product?** Yes. Every vehicle is simulation state, queue length is literally visible as red length, and the AI's output (signal phases) is the thing causing the change. Delete the 3D and you have a table of numbers nobody believes.

**Premium techniques.**
- One `InstancedMesh` for vehicles (capsule or low box with emissive front/rear), per-instance colour from speed; matrices written from the sim each frame.
- Light trails: either a TripsLayer-style fading path or cheap accumulation (render vehicles' emissives into a half-res buffer with feedback decay).
- Plain Bloom on emissive with `toneMapped={false}` materials rather than SelectiveBloom (search results flag selective bloom as costlier and report oddities with instanced meshes).
- Buildings from OSM footprints extruded and merged into one geometry, dark with a gradient and sparse emissive windows via a hash in the fragment shader; ground fog to hide the edge of the world.
- Signals as visible state: glowing stop-line bars per approach, and a soft "phase ring" at each junction, so the AI's decisions are seen.
- Camera choreography on a spline with eased dolly; tilt-shift DoF for the miniature look.
- **Cheap-look failure:** coloured boxes sliding on grey strips in daylight on a flat plane, i.e. a SUMO-GUI screenshot in 3D. Also vehicles overlapping, teleporting or clipping through each other at the junction box; one visible physics glitch at the hero junction destroys credibility because the camera is pointed right at it.

**References.** Search-verified: deck.gl TripsLayer (https://deck.gl/docs/api-reference/geo-layers/trips-layer) renders animated fading vehicle paths, and Google's Maps sample uses it for NYC vehicle trips (https://developers.google.com/maps/documentation/javascript/examples/deckgl-tripslayer); this proves the glowing-traffic-at-night look on the web. Search-verified: react-postprocessing Bloom docs (https://react-postprocessing.docs.pmnd.rs/effects/bloom) and the recommendation to prefer Bloom over SelectiveBloom for performance. Inference: 5-10k instanced vehicles at 60 fps on integrated graphics is routine.

**Performance.** Rendering is the easy part: one or two draw calls for vehicles, one for buildings. Risk is the micro-sim CPU cost with thousands of agents plus ONNX inference per junction per decision step; run the sim in a Web Worker at fixed 10 Hz and interpolate in the renderer. Bloom at half resolution. Mobile: cap at about 1,500 vehicles, no DoF, DPR 1. Degradation ladder keyed on measured frame time in the first 2 seconds, not on user-agent sniffing.

**Blender.** Use it for: one low-poly vehicle set (car, bus, auto-rickshaw, two-wheeler, ambulance) at under 300 tris each, the signal gantry, and one or two landmark pieces (the Silk Board flyover) that make the place recognisable. Do not use it for: the city (generate from OSM), roads (generate from the sim's lane graph so vehicles always sit exactly on them), or any baked animation.

**Scores.** Wow 9, integrity 9, achievability 7.

---

## 6. DELUGE — AI flood twin

**Hero shot.** Dusk, low oblique over a real Bengaluru neighbourhood: clay-white extruded buildings on real terrain, storm-grey sky, and brown-teal water filling the low streets with flow streaks and a foam line where it meets walls. A translucent green park footprint is being dropped in the centre, and around it the water is visibly lower. Corner numerals: people affected, roads cut. In the GIF: water rises street by street, a park is placed, the water around it recedes.

**First 10 seconds, zero interaction.** Rain begins, water creeps along the lowest roads and pools at underpasses; by second 8 a recognisable street is under water and a counter is climbing. Rising water through streets is the most viscerally readable image of all eight ideas: nobody needs a legend to understand a flood.

**First interaction and payoff.** Drag a retention pond onto the map, water drains toward it and neighbouring streets clear. This is the best single interaction in the set: the user's hand causes a physical, continuous response. Then "Let the AI place them" drops the optimiser's choices in with a stagger and the flood shrinks further than the judge managed.

**Is the visual the product?** Completely. The water surface *is* the model output; the intervention *is* the UI. Highest integrity of the eight.

**Premium techniques.**
- GPU shallow-water (pipe/virtual-pipe model) in ping-pong float render targets on a 256-512 square grid over the DEM with building footprints rasterised as walls.
- Water surface as a displaced mesh sampling the height texture: depth-based colour and opacity, normal from height gradient, fresnel sky reflection, flow-map-advected streaks from the velocity field, foam where depth is shallow and speed high.
- Wet-line darkening on building walls (max water height texture) so receded water leaves a visible mark.
- Rain as instanced streaks plus ripple normal perturbation; volumetric-ish fog and a storm HDRI.
- Buildings in matte "architectural model" white with AO so water is the only saturated element.
- **Cheap-look failure:** a flat semi-transparent blue plane that moves up through the buildings like a bathtub, or a 2D blue raster overlay. If the water does not *flow* and respect terrain, it is a slider, not a sim. Second failure: blocky stair-step water from a coarse grid without smoothing.

**References.** Search-verified: skunami.js (https://github.com/gijs/skunami.js), height-field water libraries for three.js plane meshes including a pipe model with flooding control and terrain obstacles. Search-verified: WebFlood (aeplay/WebFlood, found via a mirror), a browser flood simulator solving shallow-water equations entirely in GLSL for city environments. Search-verified: Webgl-Erosion (https://github.com/LanLou123/Webgl-Erosion), GPU shallow-water pipe model on terrain in WebGL. Search-verified: Evan Wallace's WebGL Water (https://madebyevan.com/webgl-water) for the heightfield-surface shading quality bar. Caveat: skunami.js and WebFlood are old; expect to port ideas, not import packages.

**Performance.** This is the one idea where the integrated GPU is a real risk: float render targets, several sim substeps per frame, plus a transparent displaced surface. A 256 grid with 4 substeps is fine on Intel Iris/UHD; 512 with 8 is not. Some mobile GPUs lack renderable float or linear-filtered float textures; detect and fall back to half-float or to **pre-baked flood sequences** (height textures stored as a compressed video/texture atlas) played back with the same water shader. The baked path must be built first, because it is also the autoplay path and the safety net if the live sim is unstable.

**Blender.** Use it for: intervention props (park with trees, pond, permeable paving tile, drain grate), a couple of recognisable landmarks, and optionally a beauty-baked AO for the demo neighbourhood. Do not use it for: the city or terrain (OSM + DEM pipeline), or any fluid simulation (Blender's Mantaflow bakes are irrelevant to a real-time web demo and a time sink).

**Scores.** Wow 9, integrity 10, achievability 5.

---

## 7. MULEHUNT — fraud rings in a 3D transaction universe

**Hero shot.** Deep navy void, a galaxy of several thousand cool-white account nodes in soft clusters, thin faint edges, tiny particles of money streaming along them. Centre-right, a ring of about 14 nodes has ignited orange-red, its edges thick and fast with particles cycling round the loop, and a bracket callout reads "Layering ring, 14 accounts, Rs 2.3 cr in 41 min". In the GIF: the camera drifts, particles flow, the ring lights node by node as the model's score crosses threshold, then freezes to ice-blue when "Freeze funds" fires.

**First 10 seconds, zero interaction.** Camera slow-orbits the galaxy with money flowing; at second 5 a cluster starts to heat up, at second 8 the camera pushes in and the ring ignites. Dark background, bloom and particles make this the cheapest premium look available, and it will run on anything.

**First interaction and payoff.** Click the flagged ring: everything else dims, the ring isolates and unrolls into a readable time-ordered layout (source, mules, cash-out) with the explanation edges highlighted. Second: scrub the timeline and watch the ring form. Good payoff, though less physical than GREENWAVE's switch or DELUGE's drop.

**Is the visual the product?** Mostly. The graph is the data and the model's score is the colour. But a 3D force layout carries no meaning in its positions, 3D adds occlusion over 2D, and judges have seen glowing graph galaxies before. Integrity depends on the isolate-and-unroll view, where layout finally encodes something (time and role).

**Premium techniques.**
- Nodes as one instanced/points draw with size by volume and colour by risk; additive blending, plain bloom.
- Money flow as GPU particles along edges with speed by amount; only on edges above a threshold so it does not turn to static.
- Pre-computed layout shipped as static positions (do not run the force sim live for 5k+ nodes on load); animate between "galaxy" and "ring unrolled" layouts with per-node staggered tweening.
- Depth fog and DoF to give the cloud structure; SDF text callouts anchored in 3D.
- Authored camera moves between beats rather than free orbit as the default.
- **Cheap-look failure:** default 3d-force-graph output: rainbow spheres, grey lines, a jittering hairball that is still settling when the judge arrives, and node labels overlapping. Hairball = instant "seen it".

**References.** Search-verified: vasturiano's 3d-force-graph / three-forcegraph (https://github.com/vasturiano/three-forcegraph) with built-in directional link particles (`linkDirectionalParticles`, speed, width, custom objects) and r3f-forcegraph bindings; this gives the money-flow look in an afternoon. Search-verified: react-postprocessing Bloom. Inference: custom instanced rendering will be needed beyond a few thousand nodes for it to stay smooth.

**Performance.** Lowest risk of the visually strong ideas. Points and lines are cheap; the live force simulation on the main thread is the only trap (pre-bake). Mobile works, with fewer particles.

**Blender.** Barely. Possibly nothing. At most a small set of glyph meshes (bank, wallet, cash-out) for the unrolled view. Do not build an environment; the void is the art direction.

**Scores.** Wow 7, integrity 7, achievability 8.

---

## 8. ECHOGUARD — scam-call and voice-clone shield

**Hero shot.** Black frame, an audio-reactive orb or shield mid-screen cracking from calm cyan to jagged red, a live transcript on the right with phrases highlighted and tagged "authority", "urgency", "isolation", and a "Synthetic voice 94%" badge. In the GIF: the waveform pulses, words appear, the orb reddens and spikes.

**First 10 seconds, zero interaction.** Either silence (browsers block audio autoplay) or a mic prompt. With the tab muted, which is common for judges, an audio product is half dead. Autoplay must run a captioned sample call so that it works with sound off.

**First interaction and payoff.** Press play on a sample scam call; transcript annotates and orb turns red. The transcript is the payoff. The orb is a mood ring.

**Is the visual the product?** No. The product is the annotated transcript and a risk score, which are text. The orb displays one scalar. It could be a coloured border and convey the same thing. The doc itself calls this the weakest visual and it is right.

**Premium techniques.**
- If committed: make the 3D carry real signal. A 3D spectrogram ribbon where the anti-spoof model's attention is painted on the frequency bands it found synthetic would be genuine information. That is the only version worth building.
- Otherwise: noise-displaced icosphere with fresnel, frequency data as a data texture, bloom, kinetic typography for the transcript.
- **Cheap-look failure:** Siri-blob clone. Every audio-reactive sphere on the web looks the same, and judges have seen it attached to every voice assistant demo since 2023.

**References.** Search-verified: Codrops "Audio Reactive Shaders with Three.js and Shader Park" (https://tympanus.net/codrops/2023/02/07/audio-reactive-shaders-with-three-js-and-shader-park/) and AudioSphere-type projects show the orb is easy. Easy is the problem.

**Performance.** Render cost trivial; in-browser streaming ASR is heavy on CPU and will stutter the page on a weak laptop. Server-side ASR adds cold start. Mobile mic permission flows are flaky.

**Blender.** Nothing meaningful. Do not model a phone.

**Scores.** Wow 4, integrity 3, achievability 6.

---

## Score table

| # | Idea | Wow (10 s) | Visual-is-product | Premium in 3.5 d | Cheap-look failure mode |
|---|------|-----------:|------------------:|-----------------:|-------------------------|
| 1 | PULSE | 6 | 6 | 6 | Stock heart scaling on a sine wave |
| 2 | FUNDUS | 5 | 3 | 7 | Rainbow Grad-CAM on a stretched sphere |
| 3 | TERRA | 6 | 8 | 5 | Tilted choropleth with cone plants |
| 4 | KINETIC | 5 | 8 | 3 | Grey-box primitives and dat.GUI |
| 5 | GREENWAVE | 9 | 9 | 7 | Daylight boxes on strips, clipping cars |
| 6 | DELUGE | 9 | 10 | 5 | Blue plane rising like a bathtub |
| 7 | MULEHUNT | 7 | 7 | 8 | Default force-graph hairball |
| 8 | ECHOGUARD | 4 | 3 | 6 | Siri-blob mood ring |

## Ranking on overall visual and demo power

1. **GREENWAVE** — best combination of zero-click wow, a one-switch before/after that reads without explanation, and a look (night city, emissive instancing, bloom) that is cheap to make premium and cheap to render.
2. **DELUGE** — the highest ceiling: the most visceral image and the best interaction of the set. Ranked second only because the live GPU sim is the single riskiest rendering task here, and a mediocre flood looks worse than a mediocre traffic sim. If the team has someone who has written ping-pong GLSL sims before, swap 1 and 2.
3. **MULEHUNT** — safest premium look, runs on a toaster, autoplay narrative (ring forms, ignites, freezes) is strong. Held back by the galaxy trope and by 3D position carrying no meaning.
4. **PULSE** — the only personal hook, but the wow sits behind a camera permission and good lighting; without them it is a stock heart.
5. **TERRA** — honest spatial product, but daylight terrain and crops are where web 3D looks cheapest, and the first 10 seconds read as a GIS dashboard.
6. **KINETIC** — highest integrity among the weak openers, but opens on a text box and every generated scene needs art direction the team cannot afford.
7. **FUNDUS** — a pleasant fly-in followed by decoration.
8. **ECHOGUARD** — an audio product judged with the sound off.

A blunt cross-cutting note: ideas 5, 6 and 7 share one tech spine (dark scene, instancing, bloom, authored camera, pre-baked autoplay). Ideas 1, 2, 3 and 4 each need a different hard thing (organic materials, anatomical accuracy, vegetation, per-primitive art direction) to avoid looking cheap.

---

## Shared rules for the autoplay mode (all three top ideas)

- The URL opens **directly into the scene, already moving**. No landing page, no "Launch demo" button, no modal. Title and one-line claim are overlaid on the live scene and fade after 4 seconds.
- Autoplay is a **scripted timeline driving the real system** (real sim, real model outputs replayed from a recorded seed), not a video. A small "Live simulation, recorded seed" tag keeps it honest.
- Any pointer-down, wheel or key **hands over control immediately**; the camera eases to a free-orbit pose and a three-button dock appears. After 20 seconds idle, autoplay resumes from the next beat.
- Loop length 45-60 seconds; the strongest image appears by second 6-8, and again at the end so the loop point is also a hero frame.
- Captions are large, lower-third, max 8 words, one per beat. Assume sound is off.
- First paint under 3 seconds: ship a poster frame (a real screenshot) as the canvas background while assets stream; total critical payload under about 5 MB, Draco/meshopt geometry, KTX2 textures.
- Measure frame time for the first 2 seconds and pick a quality tier (bloom resolution, DPR cap, agent/particle count, DoF on/off). Never show a spinner over black.
- No WebGPU-only features. WebGL2 baseline, with a WebGL-unavailable fallback that plays the hero video in place.
- README hero is a 6-8 second looping GIF/WebP of the single before/after beat, under 8 MB, captured at 1280 wide; the 90-second video sits directly below it.

---

## Storyboards

### GREENWAVE — 90-second video

| Time | Shot | On screen | Caption / VO |
|------|------|-----------|--------------|
| 0:00-0:05 | Cold open, no logo. High aerial of Bengaluru at night, slow push in. | City-scale glow, rivers of red tail-lights. | "Bengaluru, 6:40 pm." |
| 0:05-0:12 | Descend to Silk Board, tilt-shift. | Four arms jammed solid red; delay counter climbing. | "Signals here run on fixed timers." |
| 0:12-0:16 | Close on one stop line; signal goes green to an empty arm while the cross arm is jammed. | Wasted green highlighted. | "Green for nobody." |
| 0:16-0:20 | Title card over live scene. | GREENWAVE, one line. | "We trained signals to see the queue." |
| 0:20-0:32 | The switch. Cursor flips Fixed to RL. Pulse ripples across junctions. Hold wide. | Queues shorten in real time; counters roll down. | Silence for 4 s, then "Same traffic. Same roads." |
| 0:32-0:40 | Vertical wipe split-screen, identical seed. | Left fixed, right RL; numerals per side. | "Delay down X%. Stops down Y%." |
| 0:40-0:50 | Junction close-up with phase ring and per-approach queue bars. | Model's observation and chosen phase visualised on the road. | "It reads every approach, every second." |
| 0:50-1:02 | Ambulance. Click "Send ambulance"; chase cam behind a blue strobe; green corridor lights ahead. | Corridor ETA vs baseline. | "And it clears a path." |
| 1:02-1:12 | Pull out to network view, a second real junction network loads. | OSM import, different city shape. | "Any junction from OpenStreetMap." |
| 1:12-1:22 | Proof card over the scene. | Training curve, comparison vs fixed and actuated baselines, runs-in-browser badge. | "Trained in our simulator. Running live in your browser." |
| 1:22-1:30 | Return to hero wide, RL on, traffic flowing. End card with URL. | Final numerals. | "Flip the switch yourself." |

**Autoplay loop (55 s).** 0-6 s descend onto jammed junction, fixed timers, caption "Fixed timers". 6-8 s controller auto-switches with a pulse, caption "AI control on". 8-22 s hold wide while queues drain and counters fall. 22-30 s split-screen wipe with both numerals. 30-42 s ambulance corridor chase. 42-50 s junction close-up with phase ring. 50-55 s pull back to wide, reset to fixed, loop. On any input: free orbit, dock with [Fixed / AI], [Send ambulance], [Change junction].

### DELUGE — 90-second video

| Time | Shot | On screen | Caption / VO |
|------|------|-----------|--------------|
| 0:00-0:04 | Black, rain sound, first drops hit a white model city. | Rain streaks, ripples. | "100 mm in two hours." |
| 0:04-0:14 | Low street-level dolly along a real road as water rises up the walls. | Depth marker on a wall, counter of people affected. | "This is a real neighbourhood, real terrain." |
| 0:14-0:20 | Crane up to oblique wide. | Flood extent spreading through low streets, underpass filled. | "This is where the water goes." |
| 0:20-0:24 | Title over live scene. | DELUGE, one line. | "A flood twin you can change." |
| 0:24-0:34 | Split: physics sim left progressing step by step, AI surrogate right appearing instantly; difference map flashes. | Timing numerals, agreement metric. | "The AI predicts the same flood in milliseconds." |
| 0:34-0:48 | The drop. Cursor drags a retention pond into a low junction; water streams toward it; adjacent streets clear. Hold. | Wet-line stays on walls where water was. | Silence 4 s, then "Drop a pond. Watch it drain." |
| 0:48-1:00 | "Optimise for Rs X crore" clicked; interventions drop in with stagger: ponds, permeable paving, trees. | Water recedes further; counter falls. | "The optimiser finds what we missed." |
| 1:00-1:10 | Before/after wipe from the same camera. | People and road-km spared. | "N people, M km of road, spared." |
| 1:10-1:20 | Fly out, second neighbourhood loads from DEM + OSM. | Different city. | "Any neighbourhood with elevation data." |
| 1:20-1:30 | Return to hero oblique with the park in place, low sun breaking through. End card with URL. | Final numerals. | "Place one yourself." |

**Autoplay loop (60 s).** 0-3 s poster-matched wide, rain starts. 3-14 s water rises, camera slow push to the worst street, counter climbing. 14-18 s caption "No interventions". 18-26 s a ghost cursor drags in a pond; water drains to it. 26-38 s "AI plan" places five interventions with stagger; flood shrinks. 38-48 s before/after wipe with numerals. 48-56 s slow orbit of the improved state. 56-60 s interventions lift out, loop. Autoplay runs the **pre-baked** height sequences on every tier so it is identical and stable everywhere; the live sim engages only once the judge interacts and the device passes the capability check. On input: dock with a palette of four draggable interventions, a rainfall selector, and [AI plan].

### MULEHUNT — 90-second video

| Time | Shot | On screen | Caption / VO |
|------|------|-----------|--------------|
| 0:00-0:06 | Drift through the galaxy, particles of money flowing. | Thousands of calm accounts. | "50,000 accounts. Every payment looks normal." |
| 0:06-0:12 | Close on single transactions being scored green by a per-transaction check. | Green ticks. | "Checked one at a time, nothing is wrong." |
| 0:12-0:16 | Title over scene. | MULEHUNT, one line. | "Fraud is a shape, not a transaction." |
| 0:16-0:28 | Live stream mode: timeline runs; a cluster's nodes warm one by one; camera pushes in; ring ignites. | Risk score rising, time elapsed. | "A ring forms in 41 minutes." |
| 0:28-0:40 | Isolate: galaxy dims, ring unrolls into source, mules, cash-out lanes ordered by time. | Money path particles, amounts. | "Layering, fan-out, cash-out." |
| 0:40-0:52 | Explain: the edges and features the GNN weighted glow; three plain-language reasons attach to nodes. | "Why flagged" callouts. | "The model shows its evidence." |
| 0:52-1:02 | Freeze: click "Freeze funds"; ring turns ice-blue, particles stop mid-edge; saved-amount counter. | Amount intercepted vs amount lost without. | "Caught mid-flight." |
| 1:02-1:14 | Pull back: four more rings ignite across the galaxy at once. | Count of rings found, precision/recall badge. | "Now do it everywhere." |
| 1:14-1:22 | Proof card. | Dataset, metric vs per-transaction baseline. | "Temporal GNN, validated on public AML data." |
| 1:22-1:30 | Hero frame, ring burning. End card with URL. | | "Open it. Pull a ring apart." |

**Autoplay loop (50 s).** 0-5 s slow orbit, money flowing, caption "Everything looks normal". 5-12 s cluster warms, camera pushes in, ring ignites. 12-22 s isolate and unroll. 22-30 s explanation highlights. 30-36 s freeze. 36-46 s pull back, several rings ignite. 46-50 s cool down, loop. Layout positions are pre-computed; nothing is "settling" on load. On input: free orbit, click any ring to isolate, timeline scrubber, [Freeze] button.

---

## What I would tell the team in one paragraph

Pick the idea where a single switch or a single drag causes a large, continuous, legible change in a dark, glowing scene, and build the autoplay timeline and the pre-baked fallback on day one, before the live system exists. GREENWAVE and DELUGE are the only two where the judge understands the AI's value with the sound off and their hands off the mouse. Everything else needs either a permission, an upload, a typed prompt, or an explanation.
