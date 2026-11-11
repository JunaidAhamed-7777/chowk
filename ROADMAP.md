# CHOWK — Roadmap

Ordered work derived from `plan/`. Specs live in `plan/`; this file says what to build, in what order, and how to tell it is done.

**Deadline:** 15 Nov 2026, 23:55 IST. **Submit by 20:00 IST.**

## How to use this file

- Pick the lowest-numbered unblocked task in your track. Read the referenced spec section first.
- A task is done only when its "Done when" line has been checked by running it (see `plan/09-quality.md`).
- Tick the box, commit, push. Keep this file current; it is the shared state between agents.
- Priorities: **P0** must ship, **P1** should ship, **P2** if time remains. Do not start P1 work in a track while that track has open P0 tasks.
- If something in a spec proves wrong or impossible, fix the spec in the same commit as the code and note it under "Change log" at the bottom.

## Tracks

Three tracks can run in parallel after Phase 0. They meet at defined interfaces (`plan/07-architecture.md`).

| Track | Scope | Packages |
|---|---|---|
| **A — Simulation and learning** | Simulator, controllers, training, benchmark | `packages/*` |
| **B — Experience** | Rendering, interface, views, tour | `apps/web` |
| **C — Assets and presentation** | Blender models, README, video, submission | `assets/`, `README.md` |

Track B starts against a **mock snapshot source** (vehicles moving along the network at constant speed) so it never waits for Track A.

## Gates

| Gate | When (IST) | Condition | If not met |
|---|---|---|---|
| **G1 Simulator sane** | 13 Nov, 10:00 | Mixed traffic flows through the corridor under fixed-time signals with no overlaps, no gridlock at moderate load, and visible filtering in the 2D debug view | Simplify lateral rules until it passes. If it still fails by 13 Nov 16:00, raise with the user: the documented fallback is the fraud-ring concept in `docs/02-judging-synthesis.md`. |
| **G2 Training launched** | 13 Nov, 23:00 | Smoke run passed; main training run started overnight | Launch with a smaller population or shorter episodes rather than wait |
| **G3 P0 feature freeze** | 14 Nov, 23:00 | Every P0 feature works end to end on the deployed site | Start cutting per `plan/09-quality.md` cut order |
| **G4 Numbers final** | 15 Nov, 12:00 | Final policy chosen on validation seeds; full benchmark run and committed | Publish what exists; never extrapolate |
| **G5 Content freeze** | 15 Nov, 17:00 | README, video, Method and Limits pages complete; checklist started | Cut the video's optional shots, not the checklist |
| **Submit** | 15 Nov, 20:00 | Submission-day checklist complete | — |

---

## Phase 0 — Foundations (12 Nov)

| ✓ | Id | Task | Spec | Done when |
|---|---|---|---|---|
| ☑ | 0.1 | Scaffold the npm monorepo: workspaces, TypeScript strict base config, lint and format, Vitest, empty packages and the Vite + React app | `07` Repository layout | `npm install`, `npm run typecheck`, `npm test`, `npm run build` all succeed |
| ☑ | 0.2 | GitHub Actions CI: install, type-check, lint, test, build | `09` CI | Workflow green on `main` |
| ☐ | 0.3 | Deploy the skeleton app to the static host and keep it deploying on every push (needs the user's hosting account) | `07` Deployment | A public URL shows the placeholder page |
| ☑ | 0.4 | Forbidden-call guard for `packages/sim` and policy inference | `02` Determinism rules, `09` | A test fails if `Math.random`, `Date`, `Math.pow`, `sin`, `exp`, `tanh` appear there |

## Phase 1 — Simulator (Track A, 12–13 Nov)

| ✓ | Id | Task | Spec | Depends | Done when |
|---|---|---|---|---|---|
| ☑ | 1.1 | PRNG with separate streams; state hash | `02` Determinism | 0.1 | Fixed-seed sequences and hashes match stored values |
| ☑ | 1.2 | Network types, loader, validation; author `corridor.json` | `02` Network model | 0.1 | Loader rejects malformed networks; corridor loads; routes exist for every origin–destination pair |
| ☑ | 1.3 | Vehicle storage (typed arrays, free list), per-link sorted lists | `02` Vehicle state | 1.2 | Add, remove, re-sort tested |
| ☑ | 1.4 | Longitudinal dynamics: IDM against the constraining leader on a single link, with the overlap backstop and counter | `02` Longitudinal | 1.3 | A platoon behind a stopped obstacle queues without overlap; free-flow speed reached |
| ☑ | 1.5 | Demand generation ahead of time; spawning with backlog | `02` Demand | 1.1, 1.3 | Same seed gives the same arrival list; backlog drains when space appears |
| ☑ | 1.6 | Signal state machine and stop-line obstacles; yellow decision | `02` Signal phasing | 1.4 | State-machine tests pass |
| ☑ | 1.7 | Junction traversal: connectors, strip mapping, do-not-block-the-box | `02` Junctions | 1.6 | Vehicles complete routes through all five junctions; exclusivity test passes |
| ☑ | 1.8 | Lateral strip changes with class thresholds and biases; emergent filtering | `02` Lateral | 1.4 | No-overlap test passes over long mixed-traffic runs; filtering check passes |
| ☑ | 1.9 | Metrics, uncensored; fuel and CO2 estimate | `02` Metrics | 1.7 | Hand-computed delay on a scripted case matches; conservation holds |
| ☑ | 1.10 | Sensing interface with optional noise and dropout | `02` Observation | 1.7 | Values match hand counts on a constructed state |
| ☐ | 1.11 | Events: surge, block, ambulance (P0); sensor freeze (P1); outage (P2) | `02` Events | 1.8 | Each event has a passing test |
| ☑ | 1.12 | Scenario modifiers: monsoon; lane-disciplined cars only | `02` Scenario modifiers | 1.8 | Both run; cars-only shows whole-lane changes only |
| ☑ | 1.13 | Snapshot writer, `clone()`, public API finalised | `02` Public API | 1.8 | Snapshot positions match link geometry; clone test passes |
| ☐ | 1.14 | 2D debug viewer (plain canvas page in the app, dev only) | — | 1.13 | The corridor, vehicles by class, and signals are visible and steppable |
| ☐ | 1.15 | Validation checks as tests with plot data exported | `02` Validation checks | 1.9 | All checks pass; JSON for the Method page plots written |
| ☐ | 1.16 | Performance pass and `npm run sim:bench` | `02` Performance, `09` | 1.13 | ≥ 100× real time at 1,500 vehicles; figure recorded |
| ☐ | 1.17 | Author `grid-holdout.json` (P1) | `02` Held-out network | 1.2 | Loads and runs under fixed-time |

**Gate G1 after 1.8 and 1.14.**

## Phase 2 — Controllers and calibration (Track A, 13 Nov)

| ✓ | Id | Task | Spec | Depends | Done when |
|---|---|---|---|---|---|
| ☐ | 2.1 | Driver loop, controller interface, starvation guard, phase mask | `03` Controller interface | 1.10 | A trivial controller runs the corridor |
| ☐ | 2.2 | Saturation-flow calibration script; `results/calibration.json` | `04` Demand calibration | 2.1 | File written and committed; values stable across seeds |
| ☐ | 2.3 | Scenario definitions by load level | `04` Scenarios | 2.2 | All P0 scenarios generate demand at the intended load |
| ☐ | 2.4 | Webster fixed-time with offsets | `03` Baselines | 2.3 | Matches a hand calculation |
| ☐ | 2.5 | Actuated | `03` Baselines | 2.1 | Extends and skips as specified |
| ☐ | 2.6 | Max-pressure, counts and area; hysteresis tuned on validation seeds | `03` Baselines | 2.1 | Unit tests pass; both beat Webster at high load on validation seeds, or the reason they do not is understood |
| ☐ | 2.7 | Emergency pre-emption variants | `03` Emergency variants | 2.6 | Ambulance is served on constructed states |
| ☐ | 2.8 | CHOWK policy: observation builder, ReLU MLP inference, residual scoring, weights format | `03` CHOWK | 2.6 | Generation-0 equivalence with `mp-area` test passes; inference golden test passes |
| ☐ | 2.9 | `explain()` with occlusion reasons | `03` Explanation | 2.8 | Returns prior, learned, reason on live states |

## Phase 3 — Training (Track A, 13–15 Nov)

| ✓ | Id | Task | Spec | Depends | Done when |
|---|---|---|---|---|---|
| ☐ | 3.1 | ES trainer with worker pool, antithetic sampling, rank shaping, Adam, common random numbers | `03` Training | 2.8 | Improves a toy objective |
| ☐ | 3.2 | Domain randomisation sampler; seed guard | `03` Domain randomisation, Seed discipline | 2.3 | Guard test passes |
| ☐ | 3.3 | Logging, checkpoints, resume, validation every 10 generations | `03` Outputs | 3.1 | A run can be stopped and resumed |
| ☐ | 3.4 | Smoke run | `03` Run plan | 3.3 | Pipeline works end to end; throughput measured; population and episode length sized to the night |
| ☐ | 3.5 | **Main run, overnight 13→14 Nov** | `03` Run plan | 3.4 | Run completes or is still improving; best-validation checkpoint identified |
| ☐ | 3.6 | Export policy, "watch it learn" checkpoints and training curve to the app | `03` Outputs | 3.5 | Files in `apps/web/public/policies/` |
| ☐ | 3.7 | Second run overnight 14→15 Nov, informed by the first (P1) | `03` Run plan | 3.5 | Adopted only if validation is better |
| ☐ | 3.8 | Ablation runs: vehicle objective, count observation, pure, solo (P1, P2) | `03` Ablations | 3.5 | Each has a checkpoint chosen on validation |

**Gate G2 at 3.5.**

## Phase 4 — Rendering core (Track B, 12–13 Nov)

| ✓ | Id | Task | Spec | Depends | Done when |
|---|---|---|---|---|---|
| ☑ | 4.1 | App shell: routes, top bar, tokens, typography, dark glass style | `01` Information architecture, `05` Interface style | 0.1 | Four views switch; style matches tokens |
| ☑ | 4.2 | R3F canvas, tone mapping, fog, base lights, damped camera with clamps | `05` | 4.1 | Empty night scene renders |
| ☑ | 4.3 | Road, kerb, median and marking meshes generated from the network JSON | `05` Scene composition, `06` Generated | 1.2 | Roads match simulator geometry exactly |
| ☑ | 4.4 | Mock snapshot source; instanced vehicles with placeholder meshes; interpolation; fade in and out | `05` Vehicles | 4.2 | 3,000 placeholder vehicles move smoothly |
| ☐ | 4.5 | Headlights, tail-lights, brake response; bloom tuned | `05` Vehicles, Post-processing | 4.4 | Lights bloom; signal colours stay distinct |
| ☑ | 4.6 | City: seeded building placement, window shader, lamps with fake light pools, skyline | `05` Buildings and windows, Lighting | 4.3 | The aerial view reads as a city at night |
| ☐ | 4.7 | Signals: poles and state-driven lamps | `05` | 4.3 | Lamps follow signal state |
| ☐ | 4.8 | Simulation workers, clock and lockstep, transferable snapshots, replacing the mock | `07` Runtime architecture | 1.13, 4.4 | Real traffic renders; two workers stay at the same tick |
| ☐ | 4.9 | Split-screen wipe by fragment discard; draggable handle; label chips | `05` Split-screen wipe, `01` L1 | 4.8 | Two controllers visible side by side on the same seed |
| ☐ | 4.10 | Quality tiers and automatic selection | `05` Quality tiers | 4.5 | Tier changes at runtime; probe picks sensibly |
| ☐ | 4.11 | Loading: poster, parallel load, warm-up fast-forward, cross-fade | `05` Loading | 4.8 | Live scene within budget |
| ☐ | 4.12 | Light trails (P1) | `05` Vehicles | 4.5 | Flowing traffic streaks, jams read as dots, aerial only |

## Phase 5 — Product features (Track B, 13–14 Nov)

| ✓ | Id | Task | Spec | Depends | Done when |
|---|---|---|---|---|---|
| ☐ | 5.1 | Metric cards with rolling values, sparklines, differences, headline figure | `01` L2 | 4.8 | Values update at 4 Hz and match worker metrics |
| ☐ | 5.2 | Controller selectors per side; live swap | `01` L3 | 4.9, 2.8 | Swapping changes behaviour without reset |
| ☐ | 5.3 | Scenario selector; time controls; seed field | `01` L4, L7 | 4.8, 2.3 | Reset and fast-forward work; same seed reproduces |
| ☐ | 5.4 | Events: surge, block (with click-to-place), ambulance; toasts, scene markers, sparkline ticks | `01` L5 | 1.11, 5.1 | Each fires in both simulations at the same tick |
| ☐ | 5.5 | Pressure overlay | `01` L6, `05` Overlays | 4.9 | Zones colour by occupied area, respecting the wipe |
| ☐ | 5.6 | Camera presets: aerial, junction fly-to | `01` L8 | 4.2 | Smooth transitions |
| ☐ | 5.7 | **Autoplay tour**: JSON timeline, player, captions, interruption and restart | `01` L9 | 5.4, 5.5, 5.6 | The full tour plays unattended on first load and loops |
| ☐ | 5.8 | Decision, Speed and People overlays (P1) | `01` L6 | 2.9, 5.5 | Each renders and fades |
| ☐ | 5.9 | Ride-along and ambulance cameras (P1) | `01` L8 | 5.6 | Click a vehicle to follow |
| ☐ | 5.10 | "Watch it learn" slider (P1) | `01` L10 | 3.6, 5.2 | Sliding swaps checkpoints live |
| ☐ | 5.11 | Share URL; keyboard shortcuts; reduced motion (P1) | `01` L7, Global | 5.3 | State round-trips through the URL |
| ☐ | 5.12 | Mobile layout at Low tier | `01` Layout | 5.1 | Usable in portrait on a phone |
| ☐ | 5.13 | 2D canvas fallback (P1) | `05` Fallbacks | 4.8 | Appears when WebGL2 is unavailable |
| ☐ | 5.14 | Error handling: worker restart, context loss, tab hidden | `01` Global | 4.8 | No blank screens under induced failures |
| ☐ | 5.15 | Sensor-failure event, custom scenario sliders, policy inspector, audio (P1–P2) | `01` | 5.4 | As specified |

**Gate G3 after 5.7.**

## Phase 6 — Benchmark and results (Track A then B, 14–15 Nov)

| ✓ | Id | Task | Spec | Depends | Done when |
|---|---|---|---|---|---|
| ☐ | 6.1 | Episode runner (environment-neutral) and benchmark CLI with worker threads, dirty-tree guard | `04` Commands | 2.6 | A suite runs and writes records |
| ☐ | 6.2 | Statistics: paired bootstrap intervals, relative differences, win rate; summary and comparisons | `04` Statistics | 6.1 | Matches reference values on fixed data |
| ☐ | 6.3 | Headline generation for all three outcomes; README block and `benchmark.md` generation | `04` Headline, Output | 6.2 | Generated text correct in tests |
| ☐ | 6.4 | Benchmark smoke in CI | `04` Commands | 6.1 | CI runs it |
| ☐ | 6.5 | **Run B1, B2, B6, B8 with the final policy; commit results** | `04` Suites | 3.6, 6.3 | `results/benchmark.json` committed from a clean tree |
| ☐ | 6.6 | Build-time integrity check | `07` Build-time integrity | 6.5 | A stale build fails |
| ☐ | 6.7 | Results view: headline, main table, charts, provenance | `01` R1–R3, R5 | 6.5, 4.1 | Renders entirely from the JSON |
| ☐ | 6.8 | **"Run it yourself"**: bench worker pool, progress, match indicator | `01` R4, `04` In-browser | 6.5 | Reproduces published numbers exactly in Chromium, Firefox, WebKit |
| ☐ | 6.9 | Cross-engine determinism test in Playwright | `09` Browser tests | 1.13 | Hashes equal across engines |
| ☐ | 6.10 | Suites B3, B4, B5, B7 and their Results sections (P1) | `04` Suites | 3.8, 6.7 | Committed and displayed |

**Gate G4 at 6.5.**

## Phase 7 — Assets (Track C, 12–14 Nov)

| ✓ | Id | Task | Spec | Depends | Done when |
|---|---|---|---|---|---|
| ☐ | 7.1 | Asset build and check scripts; placeholder models with correct dimensions and light masks | `06` Pipeline, Order of work | 0.1 | `npm run assets:check` passes on placeholders |
| ☐ | 7.2 | Two-wheeler, car, auto-rickshaw, bus | `06` Vehicles | 7.1 | In the scene at night, each class is recognisable from the aerial camera |
| ☐ | 7.3 | Signal, street lamp, low and mid buildings | `06` Buildings, Street | 7.1 | In the scene; budgets met |
| ☐ | 7.4 | Light commercial, ambulance, tall buildings, shop strips, trees | `06` | 7.2 | As above |
| ☐ | 7.5 | Low-detail vehicle meshes for the Low tier | `06` Vehicles | 7.2 | Low tier uses them |
| ☐ | 7.6 | P1 props: bus stop, hoarding, barrier, breakdown markers | `06` Street P1 | 7.3 | As above |
| ☐ | 7.7 | P2 props: viaduct, auto stand | `06` Street P2 | 7.6 | As above |
| ☐ | 7.8 | `assets/CREDITS.md` complete | `06` Rules | 7.4 | Every imported asset listed with licence |

## Phase 8 — Presentation and submission (Track C, 14–15 Nov)

| ✓ | Id | Task | Spec | Depends | Done when |
|---|---|---|---|---|---|
| ☐ | 8.1 | Method view with diagrams, validation plots, citations, "what is new and what is not" | `01` Method, `08` Citations | 1.15, 2.8 | Complete; every citation verified from its source |
| ☐ | 8.2 | Limits view | `01` Limits | 4.1 | Complete |
| ☐ | 8.3 | Scripted capture route; poster, hero GIF, stills | `05` Screenshots, `08` Images | 5.7 | Images reproducible from a URL |
| ☐ | 8.4 | README | `08` README structure | 6.5, 8.3 | Complete; results block generated; no placeholders |
| ☐ | 8.5 | Impact statistics verified against primary sources and linked, or removed | `08` Statistics | — | Each has a working source link |
| ☐ | 8.6 | Architecture diagram (SVG) | `08` Images | 4.8 | In README and Method view |
| ☐ | 8.7 | 90-second demo video | `08` Demo video | 5.7, 6.8 | Recorded from the app, captioned, uploaded |
| ☐ | 8.8 | Full browser and device pass | `09` Matrix | G3 | Matrix checked; issues fixed or listed in Limits |
| ☐ | 8.9 | Performance pass against budgets; numbers recorded with hardware | `09` Budgets | G3 | B8 figures real and committed |
| ☐ | 8.10 | Unstop text finalised from the draft | `08` Unstop fields | 6.5 | Ready to paste; headline filled from data |
| ☐ | 8.11 | Submission-day checklist | `08` Checklist | all P0 | Every item ticked |
| ☐ | 8.12 | Tag `v1.0-submission`; user submits on Unstop | `08` | 8.11 | Submitted before 20:00 IST |

---

## Day plan

| Day | Track A | Track B | Track C |
|---|---|---|---|
| **12 Nov** | 0.1–0.4, 1.1–1.8 | 4.1–4.4 on the mock source | 7.1, start 7.2 |
| **13 Nov** | G1; 1.9–1.16; 2.1–2.9; 3.1–3.4; launch 3.5 overnight (G2) | 4.5–4.11; 5.1–5.3 | 7.2–7.4 |
| **14 Nov** | 3.6; 6.1–6.4; provisional 6.5; 3.7 overnight | 5.4–5.7 (G3); then 5.8–5.14, 4.12 | 7.5–7.6; 8.1–8.3 |
| **15 Nov** | Final policy; 6.5 by 12:00 (G4); 6.9, 6.10 | 6.7, 6.8; polish | 8.4–8.10 by 17:00 (G5); 8.11–8.12 by 20:00 |

## Minimum shippable product

If everything goes wrong, this is the smallest thing worth submitting. It must exist by **G3**:

- Simulator with mixed traffic on the corridor
- Webster, max-pressure (area) and CHOWK controllers
- Night scene with instanced vehicles, lights, bloom
- Split-screen wipe, metric cards, three events, pressure overlay
- Autoplay tour
- Main benchmark with confidence intervals on the Results view, plus "Run it yourself"
- Method and Limits views, README with hero image, working deployment

## Change log

Record spec changes here: date, what changed, why.

- 12 Nov 2026 — Roadmap created from `plan/`.

- 12 Nov 2026 — Use npm workspaces and a committed package lock for local tooling and CI.
- 12 Nov 2026 — Generate the dimension-matched vehicle placeholders from the simulator's dimension table. The compression pipeline accepts pre-encoded WebP and KTX2 palettes.
- 12 Nov 2026 — Generate Poisson arrivals by integrating piecewise-linear rates. Reserve junction connectors by movement until the last vehicle clears the box. Turns use an assumed speed cap and pass one at a time.
- 12 Nov 2026 — Keep lateral alignment near connector boundaries and add straight lead-ins and lead-outs to curved paths after oriented-rectangle tests exposed overlaps.
