# 01 — Product Specification

Everything the visitor can see and do. Priority tags: **P0** must ship, **P1** should ship, **P2** ship if time remains. Cut from the bottom.

## Information architecture

A single-page app with four views, switched by a top bar. The 3D scene stays mounted behind all of them so switching is instant.

| Route | View | Purpose |
|---|---|---|
| `/` | **Live** | The 3D city, controls, live numbers. Opens in autoplay. |
| `/controllers` | **Controllers** | Each controller in plain words, with a diagram, what it looks at, how it decides, its strengths, its weak spot and its tested delay. |
| `/results` | **Results** | Benchmark tables, charts, "Run it yourself". |
| `/method` | **Method** | How it works, what is new and what is not, citations. |
| `/limits` | **Limits** | What this does not show. Short and frank. |

Top bar: logo and name on the left; view links; a GitHub link; a quality selector. The site has no sound.

## Live view

### Layout (desktop)

```
+--------------------------------------------------------------+
| CHOWK   Live  Results  Method  Limits        GitHub  ⚙   |
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
- Each side has a label chip naming its controller, with a dropdown to change it. Defaults: A = Fixed-time (Webster), B = CHOWK.
- Double-click the wipe to snap it to centre. Keyboard: `[` and `]` move it.
- A "single view" toggle hides the wipe and shows only B.

### L2. Live metric cards — P0

Five cards, each showing A and B values and the difference as a percentage, colour-coded (better = green, worse = red).

| Card | Definition | Unit |
|---|---|---|
| Delay per person | Mean extra travel time versus free flow, weighted by occupancy | s |
| Stops per vehicle | Full stops divided by vehicles generated in the measurement window | count |
| Throughput | People delivered to their destination per hour | people/h |
| CO2 | Estimated emissions from the fuel model in `02-simulator.md` | kg/h |
| Ambulance time | Travel time of the latest emergency vehicle end to end | s |

- Values are rolling over the last 5 simulated minutes, with a sparkline for the full run.
- A sixth headline figure above the cards: **"People-hours saved this hour"**, the cumulative difference in total person-delay between A and B.
- Every card, and the people-hours headline, has an **ƒ** button. Hovering shows and clicking pins a popover with the rule in words, the measurement window in simulated time, and the window totals substituted into the formula for A and B (for example "1,02,751 person-s ÷ 1,445 people = 71.1 s"), ending with "simulation result".

### L3. Controllers — P0

Selectable on either side:

1. Fixed-time (Webster)
2. Actuated (gap-out)
3. Max-pressure (vehicle counts)
4. Max-pressure (area)
5. CHOWK (residual, the main model)
6. CHOWK-pure (no max-pressure prior) — P1, shown if trained

### L4. Scenarios — P0

A dropdown that resets both simulations with a named demand pattern. See `04-benchmark.md` for exact definitions.

- Morning peak (default)
- Evening peak
- Off-peak
- Festival surge
- Monsoon (lower speeds, longer headways)
- Cars only, lane-disciplined (the contrast case)
- The top-left of the Live view shows the scenario: clock time, time of day, its name and a one-sentence description of its demand. The scene's lighting follows the scenario (see `05-rendering.md`), and "Simulated time" is a clock starting at the scenario's hour (morning peak 08:30, evening peak 18:00, the rest in the evening or night).
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
- Ambulance cam: follows the active emergency vehicle from behind, like ride-along. If no ambulance is on the road, choosing it dispatches one to both sides.
- Free orbit: drag to orbit, scroll to zoom, with limits so the visitor cannot get lost.

### L9. Autoplay tour — P0

- Starts automatically on first load. Any pointer or key interaction ends it; a "Tour" button restarts it.
- About 75 seconds, looped. Each beat has a caption of at most 12 words at the bottom of the screen.

| Beat | Seconds | Camera | Action | Caption |
|---|---|---|---|---|
| 1 | 0–2.5 | Street, low over J3 | Wipe off-screen; 4× | "Morning rush at a chowk: two-wheelers, autos, buses and cars, no lanes." |
| 2 | 2.5–8 | Street, low over J3 | Wipe at centre; 4× | "Left: <left controller>. Right: <right controller>. Same traffic, same seed." |
| 3 | 8–16 | Aerial | Wipe at centre; 4× | "A five-junction corridor, simulated live in your browser." |
| 4 | 16–32 | Junction J3 | Wipe at centre; speed overlay; 4× | "Two-wheelers move through the gaps beside queues." |
| 5 | 32–40 | Junction J3 | Wipe at centre; pressure overlay; 4× | "The pressure overlay shows how much road area traffic occupies." |
| 5b | 40–44 | Junction J3 | Wipe at centre; people overlay; 4× | "Buses carry 40 people here. CHOWK minimises delay to people, not vehicles." |
| 6 | 44–58 | Ambulance cam | Wipe at centre; ambulance event; 16× | "Follow an ambulance through the corridor." |
| 7 | 58–68 | Aerial | Wipe at centre; pressure overlay; surge event; 4× | "A surge triples demand on one approach for three simulated minutes." |
| 8 | 68–75 | Aerial | Wipe at centre; 1× | "Compare person-delay, then reproduce the benchmark in Results." |

- The camera cranes slowly from the street view to the aerial view at beat 3. During the tour the control dock is hidden and the readout shows three cards, with a "Click anywhere or press a key to take control" hint under the caption.
- The tour is data, not code: a JSON timeline of camera keyframes, events, overlay switches and captions, so it can be tuned without touching logic.

### L10. "Watch it learn" — P1

A slider over saved training checkpoints (for example generations 0, 5, 20, 60, final). Moving it swaps the policy on side B live. At generation 0 the controller equals max-pressure; the visitor sees it improve. A small chart beside the slider shows the training curve with the current checkpoint marked.

### L11. How it decides — P0

A panel that walks through one junction's latest decision, opened from **How it decides** in the control dock (it flies the camera to that junction). It updates on every decision (every 5 simulated seconds) and names the time of the decision and the next one.

1. **What the sensors report**: a junction sketch with each arm filled by near-zone occupancy and the current green lit, plus a table of near area, people, longest wait and exit occupancy per approach.
2. **The controller's rule.** Fixed-time: the Webster timetable and the phase the clock requests. Actuated: the extension threshold against the current reading. Max-pressure and CHOWK: one card per phase with each term written out (waiting area as near and mid occupancy weighted by zone length, exit traffic as turning share × exit area, hold bonus) and the resulting pressure.
3. **CHOWK only**: β × pressure plus the network output per phase, drawn as bars, with the 50-value input vector behind a disclosure.
4. **Decision**: keep or switch, whether the learned correction changed max-pressure's choice, whether the 150 s starvation rule overrode it, the controller's own reason line, and a check that the browser's term-by-term recomputation equals the numbers the controller reported.

A junction picker, an A/B side picker and a log of the last eight decisions complete the panel. The worker publishes the exact sensor reading each decision used; the recomputation is unit-tested against `scorePressure` and the live controllers.

### L13. Getting-started guide — P0

- Shown to first-time visitors once the scene is ready, as a card beside the scene. It never blocks the scene or the autoplay tour; a visitor who ignores it still sees the tour.
- Six steps: what CHOWK is; one street under two controllers; reading the metric cards; events; junctions, overlays and ride-along; Results. Each step after the first rings the controls it describes.
- "Skip" or `Esc` closes it at any step. Dismissal is remembered in local storage. A "?" button in the control dock reopens it.
- Using the guide ends the tour, like any other interaction, and sets up the split view when a step needs it.
- Automated browsers (`navigator.webdriver`) and capture mode do not get the guide. `?guide=on` forces it and `?guide=off` suppresses it.

### L14. First-visit briefing — P0

- On a first visit a briefing card covers the scene while it loads, with the live city visible behind it. The visitor moves through six chapters with Next and Back, the chapter bar or the arrow keys; it never advances by itself. Esc or "Skip intro" closes it.
- Copy is plain: short sentences, everyday words ("traffic lights", "road ahead"), one idea per paragraph. Technical terms are named once and explained.
- Chapters: the problem (fixed timers on lane-free mixed traffic); why counting misleads (two queues drawn to scale from the simulator's vehicle sizes and assumed occupancies, with count, area and people); how CHOWK decides (sense, max-pressure, learned correction, choose); how it learned (the exported validation training curve); whether it works (mean delay per person with 95% intervals for every controller on the held-out seeds and a plain list of CHOWK against each controller, with the generated headline behind a disclosure, including where CHOWK does not win); and how to read the live screen.
- Every number in the briefing is computed from simulator constants, `training-curve.json` or `results/benchmark.json` (extracted at build time). No hand-written results.
- When the visitor closes it, the autoplay tour starts and a first-time guide (L13) opens at its second card. The tour does not run while the briefing is open.
- "What am I looking at?" under the title reopens it. Dismissal is remembered in local storage. Automated browsers and capture mode skip it; `?intro=on` forces it and `?intro=off` suppresses it.

### L15. Time-space diagram — P1

- "Time-space" in the dock opens a panel with one diagram per simulation: time on the horizontal axis (the last five simulated minutes), position along the arterial on the vertical axis, one dot per vehicle per simulated second, eastbound and westbound in different colours.
- Each junction carries two thin bars for the arterial directions, green while that direction's phase is green and red otherwise, so platoons, queues and green waves read at a glance.
- Sampling runs on the main thread from the snapshot stream into preallocated ring buffers; the canvas redraws four times a second. Opening it closes "How it decides", and Escape closes it.

### L16. Beat the AI — P1

- "Beat the AI" in the dock opens a panel. Starting a round restarts both simulations on the current seed with CHOWK on both sides, at 4×, with the camera on J3.
- On the left the visitor runs J3: four buttons (or keys 1 to 4) request green for an approach. The request applies at once if minimum green allows and is held at every decision; maximum green, clearance and the starvation guard still apply. Every other junction stays with CHOWK on both sides, so only J3 differs.
- The score is person-hours of delay since the round began on each side. After three simulated minutes the simulation pauses and a verdict names the winner and margin, with a note that one round on one seed is a game, not a benchmark.
- The visitor's requests go through a wrapper in the web worker (`apps/web/src/workers/manualOverride.ts`); `packages/controllers/src` is unchanged.

### L12. Audio — removed

The site has no sound and no mute control (removed at the user's request, 13 Nov).

## Results view

### R1. Headline — P0

One sentence generated from the committed benchmark output, of the form: "On N held-out seeds, CHOWK changes delay per person by X% versus max-pressure and Y% versus Webster fixed-time (95% CI ...). Simulation result." The text is assembled from the data; if the result is unfavourable, the sentence says so.

### R2. Main table — P0

Rows: controllers. Columns: the metrics from L2, each as mean and 95% confidence interval, for the default scenario. Best value per column highlighted. A scenario selector switches the table.

### R3. Charts — P0 for the first two

- Delay per person by controller, with interval bars, one group per scenario.
- Lane-disciplined versus mixed traffic: the gap between CHOWK and each baseline in both, side by side.
- Ablations: area versus count observation; person versus vehicle objective; residual versus pure — P1.
- Generalisation: unseen demand levels, sensor noise, held-out network — P1.
- Training curve — P1.

### R4. "Run it yourself" — P0

- A button runs a reduced benchmark in Web Workers in the visitor's browser: one scenario, the main controllers, a handful of held-out seeds.
- A progress bar, then the visitor's numbers appear beside the published ones with a match indicator. Because the simulator is deterministic, they should match exactly; the indicator shows a tick when every value is identical and flags any difference.
- A line states the simulator version hash used for both.

### R5. Provenance — P0

The git commit, date, seed list and total simulated time behind the published numbers, with a link to the raw JSON in the repository.

### R6. Check any comparison — P1

Pick any published cell (suite, scenario, variant), controllers A and B, and a metric. The page computes the paired relative difference on every held-out seed from the raw runs, plots one dot per seed with the mean and a 95% bootstrap interval, says on how many seeds A was better, and lists every seed. Replay re-runs both runs for a seed in a browser worker and checks metrics and final state hashes against the publication. The interval uses its own resample, so its last digit can differ from the published table.

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

A second section, "Path to a real junction", sets out what a field trial would take (sensing, where a learned policy would sit beside existing adaptive control, compute, and the validation steps before any trial). It is labelled as a plan, cites every external fact and computes the parameter count from the controller package.

## Global behaviours

- **Loading — P0:** a static poster frame of the city renders immediately as a background image. Over it, a loading card shows the brand mark and the real start-up steps (3D corridor, signal controllers, traffic warm-up), ticking each off as it completes, with a rotating one-line hint. It stays for at least about a second so it can be read, and fades out once the scene has faded in. Target: interactive within 3 s on broadband.
- **Quality tiers — P0:** High, Medium, Low, chosen automatically from a short frame-time probe and changeable in the top bar. See `05-rendering.md`.
- **No-WebGL fallback — P1:** a 2D canvas top-down view of the same simulation with the same controls, so the product still works.
- **Reduced motion — P1:** honours the system setting; the tour uses cuts instead of camera glides.
- **Keyboard — P1:** space to pause, `1`–`3` for speed, `o` to cycle overlays, `t` to restart the tour.
- **Accessibility — P1:** all controls are real buttons with labels; colour is never the only signal in the metric cards (arrows and signs accompany it).
- **Menus and popovers — P0:** drop-down menus (More, camera modes, Watch it learn) and metric popovers close on a press outside them, after choosing an action, and on Escape.
- **Errors — P0:** if a worker crashes, the simulation restarts from the current seed and a toast says so. No blank screens.

## Copy rules

- Name things by what they are: "Fixed-time (Webster)", "Max-pressure", "CHOWK".
- Never write "AI-powered", "revolutionary" or "real-time" as decoration.
- Any sentence with a number ends with or sits beside the words "simulation result" or is inside a view that states it once prominently.
