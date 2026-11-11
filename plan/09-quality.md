# 09 — Quality, Performance and Risk

The "Craft" pillar, and the safeguards that keep the demo working on a stranger's machine.

## Definition of done

A task is done when:

1. Its acceptance criteria in `ROADMAP.md` are met and were checked by running the thing, not by reading the code.
2. `npm run typecheck`, `npm run lint` and `npm test` pass.
3. New behaviour has a test where one is practical.
4. Anything visual was looked at in the running app, at night, in the aerial camera, at the default quality tier.
5. It is committed and pushed with a clear message.

## Tests

### Simulator (`packages/sim`)

| Test | Asserts |
|---|---|
| Conservation | Generated = completed + in network + backlog at every tick, across random scenarios |
| No overlap | No vehicle rectangles intersect over long random runs, all scenarios |
| Junction exclusivity | Connectors of different approaches never occupied together |
| Signal state machine | Minimum green, yellow, all-red and maximum green are honoured; early requests ignored |
| Determinism | Two runs, same seed: identical hash every 1,000 ticks |
| Clone | `clone()` then stepping both gives identical hashes |
| Twin demand | Different controllers, same seed: identical arrival lists and spawn attempts |
| Backstop rate | Overlap backstop below 1 in 10⁵ vehicle-ticks |
| Fundamental diagram | Flow peaks at intermediate density |
| Filtering | Two-wheeler share at queue front exceeds mix share |
| Events | Each event changes state as specified and expires |
| Metrics | Hand-computed delay on a tiny scripted case matches |
| No forbidden calls | A lint rule or source scan fails on `Math.random`, `Date`, `Math.sin`, `Math.pow`, `Math.exp`, `Math.tanh` in `packages/sim` and in policy inference |

### Controllers

| Test | Asserts |
|---|---|
| Webster | Cycle and splits match a hand calculation |
| Max-pressure | Picks the expected phase on constructed states |
| CHOWK at generation 0 | With a zero final layer, actions equal `mp-area` on thousands of random states |
| Inference | Fixed input and weights give a stored output exactly |
| Phase mask and starvation guard | Honoured by every adaptive controller |

### Training and benchmark

| Test | Asserts |
|---|---|
| Seed guard | Training refuses test seeds; benchmark is the only writer of test-seed results |
| ES step | On a toy objective, fitness improves |
| Statistics | Bootstrap intervals match a reference on fixed data |
| Report | Headline sentence generated correctly for improvement, no-difference and worse cases |
| No placeholders | No `{{` remains in README or app text at build |

### Browser (Playwright)

| Test | Asserts |
|---|---|
| Cross-engine determinism | Hash after 10,000 ticks equals the Node value in Chromium, Firefox and WebKit |
| Reproduction | Quick suite in the browser matches `results/benchmark.json` |
| Smoke | App loads, canvas renders non-black pixels, tour advances, no console errors |
| Interaction | Wipe drags; each event button fires; controller change takes effect; views switch |
| Fallback | With WebGL disabled, the 2D renderer appears |

## Continuous integration

On every push: install, type-check, lint, unit tests, simulator speed check (fails on a large regression), benchmark smoke, build with integrity check, Playwright on Chromium. Nightly or manual: full Playwright matrix.

CI must be green on the submitted commit and its badge shown in the README.

## Performance budgets

| Area | Budget |
|---|---|
| Simulator, Node, one core, 1,500 vehicles | ≥ 100× real time; target 300× |
| Policy inference | ≤ 20 µs per decision |
| Frame rate, Medium tier, integrated GPU | ≥ 30 fps |
| Frame rate, High tier, discrete GPU | ≥ 60 fps |
| Time to first paint (poster) | ≤ 1 s on broadband |
| Time to live scene | ≤ 3 s on broadband, ≤ 6 s on a slow connection |
| Initial JavaScript, compressed | ≤ 500 kB |
| Models, compressed | ≤ 3 MB |
| Memory after 10 minutes | Stable; no growth |
| "Run it yourself" | ≤ 90 s on a four-core laptop |

Measure on the development machine and record the hardware beside every published figure. If an integrated-GPU machine is not available, say so rather than estimating.

## Browser and device matrix

| Target | Requirement |
|---|---|
| Chrome, Edge (current) on Windows and macOS | Full experience |
| Firefox (current) | Full experience |
| Safari (current) on macOS | Full experience |
| Chrome on Android, Safari on iOS | Works at Low tier; layout usable in portrait |
| No WebGL2 | 2D fallback |

## Honesty checks

These are tests or review items, not aspirations:

- Every number in the interface traces to live simulation state or `results/benchmark.json`.
- The words "simulation result" appear on the Live view, the Results view and in the README beside the headline.
- No "first", "novel" or "state of the art" without a confirmed search.
- Citations present wherever the idea is described.
- Default parameters are labelled as assumptions on the Method page.
- Results that are unfavourable are present and not buried.

## Risk register

| Risk | Sign it is happening | Response |
|---|---|---|
| Simulator produces unrealistic traffic (gridlock, oscillation, sliding) | Validation checks fail; it looks wrong in the 2D debug view | Fix before anything else is built on it. Simplify lateral rules (fewer bias terms) before adding more. |
| Simulator too slow for training | Under 50× real time | Profile; coarser occupancy grid; shorter episodes; smaller population. Do not rewrite in another language. |
| Learned controller does not beat `mp-area` | Validation fitness ≥ 1.0 after the main run | Ship it with the true number; lead with the simulator, the area-versus-count finding, the demo and reproducibility. See `03-controllers-and-training.md`. |
| Cross-browser determinism fails | Hash mismatch | Find the non-deterministic operation with a bisecting hash trace. If unfixable in time, "Run it yourself" compares within a stated tolerance and says so. |
| Frame rate poor | Under 30 fps at Medium | Lower vehicle cap, drop trails, reduce bloom resolution; make Low the default. |
| Looks cheap | Honest look at a screenshot beside the art direction | Fix bloom and lighting first, then silhouettes, then density of city lights. Remove anything that looks unfinished rather than leave it. |
| Asset work blocks rendering | Waiting on models | Placeholders with correct dimensions exist from the start; never wait. |
| Deployment fails late | Build or host errors on the last day | Deploy a skeleton on the first day and keep it deploying on every push. |
| Schedule slips | A phase ends late | Cut in the order below. Protect the P0 list. |

## Cut order

When time runs short, drop from the top of this list first:

1. Audio
2. Policy inspector
3. Signal-outage event
4. P2 props and viaduct
5. Free custom-scenario sliders
6. Tilt-shift, headlight decals
7. `chowk-solo` ablation, then other ablations
8. Fairness and robustness suites
9. "Watch it learn" slider
10. Ride-along camera
11. Light trails
12. 2D fallback

Never cut: the split-screen wipe, autoplay tour, live metric cards, surge / block / ambulance events, pressure overlay, main benchmark with confidence intervals, "Run it yourself", Method and Limits pages, README with hero, working deployment.

## Release checklist

See the submission-day checklist in `08-submission.md`.
