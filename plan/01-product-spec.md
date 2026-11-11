# 01 — Product Specification

Everything the visitor can see and do. Priority tags: **P0** must ship, **P1** should ship, **P2** ship if time remains. Cut from the bottom.

## Information architecture

A single-page app with four views, switched by a top bar. The 3D scene stays mounted behind all of them so switching is instant.

| Route | View | Purpose |
|---|---|---|
| `/` | **Live** | The 3D city, controls, live numbers. Opens in autoplay. |
| `/results` | **Results** | Benchmark tables, charts, "Run it yourself". |
| `/method` | **Method** | How it works, what is new and what is not, citations. |
| `/limits` | **Limits** | What this does not show. Short and frank. |

Top bar: logo and name on the left; view links; a GitHub link; a quality selector; a mute toggle.

## Live view

### Layout (desktop)

```
+--------------------------------------------------------------+
| GREENWAVE   Live  Results  Method  Limits        GitHub  ⚙   |
+--------------------------------------------------------------+
|                                                              |
|   [ left controller label ]      |     [ right controller ]  |
|                                  |                           |
|                3D SCENE  (full bleed, wipe handle at centre)  |
|                                  |                           |
|  +----------- metric cards (left vs right) -----------+       |
|  | Delay/person | Stops | Throughput | CO2 | Ambulance |      |
|  +----------------------------------------------------+       |
| [Scenario ▾] [Events: Surge | Block lane | Ambulance | ...]   |
| [⏸ 1x 4x 16x]  [Overlay ▾]  [Camera ▾]  [Seed 1042 ⟳] [Tour] |
+--------------------------------------------------------------+
```

On narrow screens the metric cards collapse to a single swipeable row and the control groups move into a bottom sheet.

### L1. Split-screen twin simulation — P0

- Two simulations run side by side from the **same seed and the same demand**, one per controller. Vehicles are spawned identically; only signal decisions differ.
- A draggable vertical wipe divides the screen. Left of the wipe shows simulation A, right shows simulation B, in the same camera.
- Each side has a label chip naming its controller, with a dropdown to change it. Defaults: A = Fixed-time (Webster), B = GREENWAVE.
- Double-click the wipe to snap it to centre. Keyboard: `[` and `]` move it.
- A "single view" toggle hides the wipe and shows only B.

### L2. Live metric cards — P0

Five cards, each showing A and B values and the difference as a percentage, colour-coded (better = green, worse = red).

| Card | Definition | Unit |
|---|---|---|
| Delay per person | Mean extra travel time versus free flow, weighted by occupancy | s |
| Stops per vehicle | Mean count of full stops per completed trip | count |
| Throughput | People delivered to their destination per hour | people/h |
| CO2 | Estimated emissions from the fuel model in `02-simulator.md` | kg/h |
| Ambulance time | Travel time of the latest emergency vehicle end to end | s |

- Values are rolling over the last 5 simulated minutes, with a sparkline for the full run.
- A sixth headline figure above the cards: **"People-hours saved this hour"**, the cumulative difference in total person-delay between A and B.
- Every card has an info tooltip stating the definition and "simulation result".

### L3. Controllers — P0

Selectable on either side:

1. Fixed-time (Webster)
2. Actuated (gap-out)
3. Max-pressure (vehicle counts)
4. Max-pressure (area)
5. GREENWAVE (residual, the main model)
6. GREENWAVE-pure (no max-pressure prior) — P1, shown if trained

### L4. Scenarios — P0

A dropdown that resets both simulations with a named demand pattern. See `04-benchmark.md` for exact definitions.

- Morning peak (default)
- Evening peak
- Off-peak
- Festival surge
- Monsoon (lower speeds, longer headways)
- Cars only, lane-disciplined (the contrast case)
- Custom: sliders for demand level and the vehicle mix — P1

### L5. Events ("Break it") — P0

Buttons that inject a disruption into **both** simulations at the same simulated instant.

| Event | Effect | Priority |
|---|---|---|
| Surge | Demand on one randomly chosen approach triples for 3 minutes | P0 |
| Block a lane | A stalled bus occupies part of a link's width for 4 minutes; the visitor may click a road to place it | P0 |
| Ambulance | An emergency vehicle enters at one end with a destination at the other | P0 |
| Sensor failure | One junction's observations freeze for 2 minutes | P1 |
| Signal outage | One junction falls back to flashing all-red (four-way stop behaviour) for 2 minutes | P2 |

Each event produces a toast, a marker in the 3D scene, and a tick on the metric sparklines so cause and effect line up.

### L6. Overlays ("See it think") — P0 for Pressure, P1 for the rest

| Overlay | Shows |
|---|---|
| None | Clean cinematic view |
| Pressure | Each approach glows by the occupied area the controller perceives; outgoing links glow by spillback risk |
| Decision | At each junction, a small radial chart of the controller's score per phase, the chosen phase highlighted, and a one-line reason ("North approach: 62% area, bus waiting") |
| Speed | Vehicles tinted by speed, red for stopped through green for free flow |
| People | Vehicles scaled-glow by occupancy, making buses visibly heavy |

### L7. Time and seed — P0

- Pause, 1x, 4x, 16x.
- Seed field with a re-roll button. The same seed always reproduces the same run.
- "Share" copies a URL that encodes scenario, controllers, seed, overlay and camera — P1.

### L8. Cameras — P0 for Aerial and Junction, P1 for the rest

- Aerial (default): high oblique over the corridor.
- Junction: click any junction to fly to it.
- Ride along: click any vehicle to follow it at street level; defaults to a two-wheeler filtering through a queue.
- Ambulance cam: follows the active emergency vehicle.
- Free orbit: drag to orbit, scroll to zoom, with limits so the visitor cannot get lost.

### L9. Autoplay tour — P0

- Starts automatically on first load. Any pointer or key interaction ends it; a "Tour" button restarts it.
- About 75 seconds, looped. Each beat has a caption of at most 12 words at the bottom of the screen.

| Beat | Seconds | Camera | Action | Caption |
|---|---|---|---|---|
| 1 | 0–8 | Slow aerial push-in | Both sims flowing; wipe off-screen | "This is a city junction corridor, simulated live in your browser." |
| 2 | 8–20 | Aerial hold | Wipe sweeps to centre; left jams, right flows; numbers diverge | "Left: fixed timers. Right: a controller that learned Indian traffic." |
| 3 | 20–32 | Drop to a junction | Speed overlay on; two-wheelers filter to the front | "No lanes. Two-wheelers filter. A queue is an area, not a count." |
| 4 | 32–44 | Junction hold | Pressure and Decision overlays on | "It sees road area and people, not just vehicles." |
| 5 | 44–58 | Ambulance cam | Ambulance event fires; greens open ahead of it | "An ambulance gets a green corridor." |
| 6 | 58–68 | Aerial | Surge event; right side absorbs it | "A sudden surge. Watch it adapt." |
| 7 | 68–75 | Aerial pull-back | Headline figure enlarges | "People-hours saved, and you can re-run the proof yourself." |

- The tour is data, not code: a JSON timeline of camera keyframes, events, overlay switches and captions, so it can be tuned without touching logic.

### L10. "Watch it learn" — P1

A slider over saved training checkpoints (for example generations 0, 5, 20, 60, final). Moving it swaps the policy on side B live. At generation 0 the controller equals max-pressure; the visitor sees it improve. A small chart beside the slider shows the training curve with the current checkpoint marked.

### L11. Policy inspector — P2

A compact panel showing the selected junction's observation vector as bars and the network's output scores, updating live.

### L12. Audio — P2

Muted by default. A low city ambience and soft tones on signal changes; a siren for the ambulance. Never autoplay sound.

## Results view

### R1. Headline — P0

One sentence generated from the committed benchmark output, of the form: "On N held-out seeds, GREENWAVE changes delay per person by X% versus max-pressure and Y% versus Webster fixed-time (95% CI ...). Simulation result." The text is assembled from the data; if the result is unfavourable, the sentence says so.

### R2. Main table — P0

Rows: controllers. Columns: the metrics from L2, each as mean and 95% confidence interval, for the default scenario. Best value per column highlighted. A scenario selector switches the table.

### R3. Charts — P0 for the first two

- Delay per person by controller, with interval bars, one group per scenario.
- Lane-disciplined versus mixed traffic: the gap between GREENWAVE and each baseline in both, side by side.
- Ablations: area versus count observation; person versus vehicle objective; residual versus pure — P1.
- Generalisation: unseen demand levels, sensor noise, held-out network — P1.
- Training curve — P1.

### R4. "Run it yourself" — P0

- A button runs a reduced benchmark in Web Workers in the visitor's browser: one scenario, the main controllers, a handful of held-out seeds.
- A progress bar, then the visitor's numbers appear beside the published ones with a match indicator. Because the simulator is deterministic, they should match exactly; the indicator shows a tick when every value is identical and flags any difference.
- A line states the simulator version hash used for both.

### R5. Provenance — P0

The git commit, date, seed list and total simulated time behind the published numbers, with a link to the raw JSON in the repository.

## Method view — P0

Short, illustrated, scannable. Sections:

1. The problem: lane-free traffic and why counts mislead. One diagram.
2. The simulator: strips, vehicle classes, how filtering emerges. One animated figure taken from the real simulator.
3. The controller: observation, action, objective, the residual design. One diagram.
4. Training: method, compute, what was randomised.
5. Evaluation: baselines, held-out seeds, statistics.
6. **What is new here and what is not.** Names the prior work with links and states our contributions plainly.
7. Validation: the simulator sanity checks from `02-simulator.md` with their plots.

## Limits view — P0

A plain list. At minimum:

- All results come from a simulator, not a road.
- The corridor is authored, modelled on a typical arterial; it is not a survey of a real place.
- Vehicle behaviour is a simplified model; parameters are documented defaults, not field calibration.
- No pedestrians, no parking, no incidents beyond the scripted events.
- Sensing is assumed available as area occupancy; real detectors are imperfect, which the sensor-noise test only approximates.
- The emissions figure is an estimate from a simple fuel model.
- Deployment would require field calibration and safety validation that this project has not done.

## Global behaviours

- **Loading — P0:** a static poster frame of the city renders immediately as a background image, replaced by the live scene when ready. A thin progress line, no blocking spinner. Target: interactive within 3 s on broadband.
- **Quality tiers — P0:** High, Medium, Low, chosen automatically from a short frame-time probe and changeable in the top bar. See `05-rendering.md`.
- **No-WebGL fallback — P1:** a 2D canvas top-down view of the same simulation with the same controls, so the product still works.
- **Reduced motion — P1:** honours the system setting; the tour uses cuts instead of camera glides.
- **Keyboard — P1:** space to pause, `1`–`3` for speed, `o` to cycle overlays, `t` to restart the tour.
- **Accessibility — P1:** all controls are real buttons with labels; colour is never the only signal in the metric cards (arrows and signs accompany it).
- **Errors — P0:** if a worker crashes, the simulation restarts from the current seed and a toast says so. No blank screens.

## Copy rules

- Name things by what they are: "Fixed-time (Webster)", "Max-pressure", "GREENWAVE".
- Never write "AI-powered", "revolutionary" or "real-time" as decoration.
- Any sentence with a number ends with or sits beside the words "simulation result" or is inside a view that states it once prominently.
