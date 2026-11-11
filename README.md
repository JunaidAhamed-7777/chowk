# CHOWK

![Two live controllers sharing the CHOWK corridor at night](assets/demo/hero.gif)

**A learned signal controller for lane-free Indian traffic, running live in the browser.**

**[Open the live demo](https://chowk-seven.vercel.app/)**

[![CI](https://github.com/JunaidAhamed-7777/chowk/actions/workflows/ci.yml/badge.svg)](https://github.com/JunaidAhamed-7777/chowk/actions/workflows/ci.yml) [![Tests](https://img.shields.io/badge/tests-Vitest%20%2B%20Playwright-2b5763)](#run-locally) [![MIT licence](https://img.shields.io/badge/licence-MIT-34d399)](LICENSE)

[Download the captioned 90-second demo](https://github.com/JunaidAhamed-7777/chowk/raw/refs/heads/main/assets/demo/chowk-demo.mp4) · [WebVTT captions](assets/demo/captions.vtt)

*Chowk* is Hindi for a junction. CHOWK pairs a playable night-time arterial with a benchmark you can reproduce in the browser. It is an INNOVEX 2026 entry for PS04, Smart Cities & Sustainability.

<!-- results:start -->

## Simulation results

On 20 held-out seeds in simulated Indian mixed traffic, CHOWK showed no clear difference in delay per person versus area max-pressure (+0.1%, 95% CI −0.4% to +0.5%), with 2.8% lower delay versus Webster fixed-time (95% CI −3.2% to −2.3%). Simulation result.

| Controller | Delay per person (s) | Stops per vehicle | Throughput (people/h) | Estimated CO₂ (kg) |
|---|---:|---:|---:|---:|
| CHOWK | 898.3 [887.3, 910.9] | 1.53 [1.48, 1.58] | 5232 [5044, 5422] | 1030.8 [1019.8, 1041.0] |
| Area max-pressure | 897.8 [886.9, 909.6] | 1.53 [1.47, 1.59] | 5231 [5035, 5438] | 1030.9 [1019.4, 1044.4] |
| Count max-pressure | 902.5 [892.0, 913.6] | 1.55 [1.49, 1.62] | 5259 [5042, 5477] | 1043.3 [1026.2, 1060.1] |
| Actuated | 891.7 [881.8, 902.2] | 1.47 [1.43, 1.52] | 5370 [5109, 5599] | 992.5 [977.6, 1007.5] |
| Fixed-time (Webster) | 923.9 [913.8, 934.5] | 1.20 [1.16, 1.23] | 4941 [4766, 5124] | 981.4 [971.6, 991.0] |

![Paired delay differences for mixed traffic and lane-disciplined cars](results/lane-free.svg)

### Engineering measurements

Measured on AMD Ryzen 9 5900HX with Radeon Graphics · win32 10.0.26300 · Node 26.8.1.

- The simulator ran at 1220.1× real time with about 502 vehicles, 327.4× real time with about 1,515 vehicles, 142.3× real time with about 3,045 vehicles.

- Policy inference took 6.61 µs per decision.

- Node, Chromium, WebKit, Firefox all reached state hash 577aee27 after 10,000 ticks.

- Rendering measurements were 163.9 fps median and 161.3 fps 1% low on low (AMD Radeon(TM) Graphics), 163.9 fps median and 161.1 fps 1% low on medium (AMD Radeon(TM) Graphics), 163.9 fps median and 161.1 fps 1% low on high (AMD Radeon RX 6600M).

- A cold localhost load transferred 831.7 KiB and became interactive in 0.97 s.

- Initial JavaScript was 494.2 kB compressed.

- The 34 delivered GLB models totalled 107.4 KiB.

- On Broadband (10 Mbps down, 40 ms latency), the poster painted in 0.30 s and Live became interactive in 1.43 s. Medians from 3 fresh Chrome contexts.

- On Slow connection (2 Mbps down, 150 ms latency), the poster painted in 1.09 s and Live became interactive in 4.75 s. Medians from 3 fresh Chrome contexts.

- During a 10-minute Live soak, sampled post-GC renderer V8 heap went from 12.89 to 12.99 MiB, with 0.39 MiB spread on the plateau and 2 dedicated workers.

- Chromium reproduced all 9 benchmark episodes exactly in 30.59 s.

- Firefox (WSL Ubuntu 6.18.33.2-microsoft-standard-WSL2) reproduced all 9 benchmark episodes exactly in 42.65 s.

- WebKit reproduced all 9 benchmark episodes exactly in 26.62 s.

- 81 tests passed and 0 failed.

[Full benchmark and provenance](results/benchmark.md) · [Raw runs](results/benchmark.json)

<!-- results:end -->

## Why lane-free traffic matters

Two-wheelers filter through gaps while auto-rickshaws and buses share the same road width. CHOWK observes occupied road area and learns to reduce delay to people, including those still waiting to enter the network. TomTom estimates that Bengaluru drivers lost 168 hours to rush-hour traffic in 2025. [TomTom Traffic Index](https://www.tomtom.com/traffic-index/city/bengaluru/)

## In the live demo

- **Compare controllers.** Drag the divider to see both respond to the same demand. Swap either controller while traffic keeps moving. [Wipe clip](assets/demo/wipe.gif)
- **Disrupt traffic.** Trigger a demand surge or click a road to place a stalled bus. The event starts at the same tick in both simulations. [Surge clip](assets/demo/surge.gif)
- **Follow an ambulance.** Send it through both simulations and switch to the ambulance camera. [Ambulance clip](assets/demo/ambulance.gif)
- **Inspect a signal.** Use Pressure to see occupied road area or Decision to see what each controller scored. Watch it learn swaps in a saved training checkpoint while the run continues. [Pressure clip](assets/demo/decisions.gif)
- **Re-run the benchmark.** Choose **Run benchmark** in Results to check the published metrics and final state hashes in your browser. [Open Results](https://chowk-seven.vercel.app/results) · [Exact replay clip](assets/demo/reproduce.gif)

## How it works

![CHOWK architecture](assets/architecture.svg)

- **Simulator.** The same deterministic TypeScript package powers the live workers, training and benchmark. Lane-free filtering emerges from longitudinal car following and lateral strip changes.
- **Controller.** CHOWK adds a small learned adjustment to area-based max-pressure. Both the baseline and CHOWK use the same phase mask and starvation guard.
- **Training.** Evolution strategies optimise occupancy-weighted delay. Validation seeds select checkpoints. A separate set of held-out seeds supplies the published comparisons.
- **Evaluation.** The benchmark pairs controllers by seed and reports confidence intervals for the differences. The browser replays a published subset.

## Prior work and contributions

CHOWK builds on work on signal control for lane-free traffic. Its contribution is a corridor-scale simulator, a learned correction to area-based max-pressure and a live comparison with an exact browser replay. [Nandakumar, Banerjee and Vanajakshi](https://arxiv.org/abs/2509.21745) · [C-DAC’s CoSiCoSt-EnV](https://cdac.in/index.aspx?id=product_details&productId=CoSiCoStEnV%28CompositeSignalControlStrategyEnhancedVersion%29)

## Run locally

Use Node.js 22.12 or later in the 22.x series. From a clean checkout, install, test and run the primary held-out benchmark against the committed policy.

```sh
npm ci
npm test
npm run bench -- --suite B1 --replace
```

The Results view offers a shorter browser replay with a progress indicator. B1 runs across the published scenarios and writes a fresh B1 publication to your checkout. Timing depends on worker count and hardware. [Published run provenance](results/benchmark.md#provenance)

Run `npm run dev` and open the URL it prints. Use `/debug` for a top-down view with tick-by-tick playback. `npm run build` type-checks the workspaces and builds the static app in `apps/web/dist`.

For the desktop browser tests, run `npm exec -- playwright install chromium`, then `npm run test:browsers`. `npm run bench:smoke` exercises the benchmark CLI on a validation seed.

## Limits

All performance comparisons are simulation results. The corridor geometry, driving parameters and detector behaviour use documented assumptions. The model omits pedestrians and parking, and the emissions estimate is illustrative. A field study would need measured demand, calibration and independent safety validation.

## Repository map

- Browser app, workers and rendering. [apps/web](apps/web/)
- Simulator, scenarios, controllers, training and benchmark. [packages](packages/)
- Published runs, validation and engineering measurements. [results](results/)
- Design specifications, roadmap and release commands. [plan](plan/) · [ROADMAP.md](ROADMAP.md) · [HANDOFF.md](HANDOFF.md)

## Credits and licences

Source code is MIT-licensed. The asset credits list the model, font and media licences. [MIT licence](LICENSE) · [Asset credits](assets/CREDITS.md)

## Team

Maintained by [Junaid Ahamed](https://github.com/JunaidAhamed-7777).
