# CHOWK

![Two live controllers sharing the CHOWK corridor at night](assets/demo/hero.gif)

**A learned signal controller for lane-free Indian traffic, running live in the browser.**

**[Open the live demo](https://chowk-seven.vercel.app/)**

[![CI](https://github.com/JunaidAhamed-7777/chowk/actions/workflows/ci.yml/badge.svg)](https://github.com/JunaidAhamed-7777/chowk/actions/workflows/ci.yml) [![Tests](https://img.shields.io/badge/tests-Vitest%20%2B%20Playwright-2b5763)](#run-locally) [![MIT licence](https://img.shields.io/badge/licence-MIT-34d399)](LICENSE)

[One-page brief (PDF)](docs/CHOWK-brief.pdf) · [Download the captioned 90-second demo](https://github.com/JunaidAhamed-7777/chowk/raw/refs/heads/main/assets/demo/chowk-demo.mp4) · [WebVTT captions](assets/demo/captions.vtt)

*Chowk* is Hindi for a junction. CHOWK pairs a playable night-time arterial with a benchmark you can reproduce in the browser. It is an INNOVEX 2026 entry for PS04, Smart Cities & Sustainability.

<!-- results:start -->

## Simulation results

On 20 held-out seeds in simulated Indian mixed traffic, CHOWK reduced delay per person by 4.6% versus area max-pressure (95% CI −7.5% to −1.7%), with 60.0% lower delay versus Webster fixed-time (95% CI −62.7% to −57.2%). Simulation result.

| Controller | Delay per person (s) | Stops per vehicle | Throughput (people/h) | Estimated CO₂ (kg) |
|---|---:|---:|---:|---:|
| CHOWK | 84.0 [75.1, 93.3] | 2.40 [2.30, 2.51] | 6282 [6034, 6517] | 241.3 [233.1, 249.2] |
| Area max-pressure | 88.0 [79.2, 97.3] | 2.43 [2.33, 2.53] | 6285 [6028, 6518] | 242.8 [234.5, 250.8] |
| Count max-pressure | 99.8 [91.8, 107.8] | 2.15 [2.04, 2.27] | 6244 [5982, 6484] | 242.4 [233.9, 250.6] |
| Actuated | 125.1 [113.4, 137.4] | 2.94 [2.82, 3.04] | 6092 [5850, 6316] | 250.0 [241.3, 258.3] |
| Fixed-time (Webster) | 209.7 [192.7, 226.1] | 3.21 [3.10, 3.31] | 5571 [5336, 5787] | 264.1 [254.5, 273.2] |

![Paired delay differences for mixed traffic and lane-disciplined cars](results/lane-free.svg)

<details>
<summary><strong>Engineering measurements</strong></summary>

Measured on AMD Ryzen 9 5900HX with Radeon Graphics · win32 10.0.26300 · Node 26.8.1.

- The simulator ran at 1007.7× real time with about 501 vehicles, 291.1× real time with about 1,504 vehicles, 138.0× real time with about 3,045 vehicles.

- Policy inference took 6.20 µs per decision.

- Node, Chromium, WebKit, Firefox all reached state hash 119b6db7 after 10,000 ticks.

- Rendering measurements were 163.9 fps median and 161.3 fps 1% low on low (AMD Radeon(TM) Graphics), 163.9 fps median and 160.4 fps 1% low on medium (AMD Radeon(TM) Graphics), 163.9 fps median and 158.5 fps 1% low on high (AMD Radeon(TM) Graphics).

- A cold localhost load transferred 873.0 KiB and became interactive in 1.00 s.

- Initial JavaScript was 525.8 kB compressed.

- The 34 delivered GLB models totalled 107.4 KiB.

- On Broadband (10 Mbps down, 40 ms latency), the poster painted in 0.31 s and Live became interactive in 1.61 s. Medians from 3 fresh Chrome contexts.

- On Slow connection (2 Mbps down, 150 ms latency), the poster painted in 1.17 s and Live became interactive in 4.94 s. Medians from 3 fresh Chrome contexts.

- During a 10-minute Live soak, sampled post-GC renderer V8 heap went from 13.31 to 13.37 MiB, with 0.25 MiB spread on the plateau and 2 dedicated workers.

- Chromium reproduced all 9 benchmark episodes exactly in 2.52 s.

- Firefox (WSL Ubuntu 6.18.33.2-microsoft-standard-WSL2) reproduced all 9 benchmark episodes exactly in 3.43 s.

- WebKit reproduced all 9 benchmark episodes exactly in 2.96 s.

- 92 tests passed and 0 failed.

</details>

[Full benchmark and provenance](results/benchmark.md) · [Raw runs](results/benchmark.json)

<!-- results:end -->

## Why lane-free traffic matters

Two-wheelers filter through gaps while auto-rickshaws and buses share the same road width. CHOWK observes occupied road area and learns to reduce delay to people, including those still waiting to enter the network. TomTom estimates that Bengaluru drivers lost 168 hours to rush-hour traffic in 2025. [TomTom Traffic Index](https://www.tomtom.com/traffic-index/city/bengaluru/)

## In the live demo

- **Compare controllers.** Drag the divider to see both respond to the same demand. Swap either controller while traffic keeps moving. [Wipe clip](assets/demo/wipe.gif)
- **Disrupt traffic.** Trigger a demand surge or click a road to place a stalled bus. The event starts at the same tick in both simulations. [Surge clip](assets/demo/surge.gif)
- **Follow an ambulance.** Send it through both simulations and switch to the ambulance camera. [Ambulance clip](assets/demo/ambulance.gif)
- **Inspect a signal.** Use Pressure to see occupied road area or Decision to see what each controller scored. Watch it learn swaps in a saved training checkpoint while the run continues. [Pressure clip](assets/demo/decisions.gif)
- **Beat the AI.** Run junction J3 by hand against CHOWK for three simulated minutes on the same traffic, and see who leaves fewer person-hours of delay.
- **Read the corridor like an engineer.** Time-space opens a live trajectory diagram for both simulations, with each junction's green for each direction.
- **Rewind a minute.** Both simulations return to their state a minute ago and replay exactly, so you can change a controller or add an event and watch a different future.
- **See why it chose.** How it decides lists the inputs that moved CHOWK's learned correction most, and checks that the browser's arithmetic matches the controller.
- **Re-run the benchmark.** Choose **Run benchmark** in Results to check the published metrics and final state hashes in your browser, or pick any published comparison and replay a single seed. [Open Results](https://chowk-seven.vercel.app/results) · [Exact replay clip](assets/demo/reproduce.gif)

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

All performance comparisons are simulation results. The corridor geometry, driving parameters and detector behaviour use documented assumptions. The model omits pedestrians and parking, and the emissions estimate is illustrative. Its turning model is conservative: junctions with turning traffic discharge well below Indo-HCM's base saturation flows for the same widths, as the Limits page shows. A field study would need measured demand, calibration and independent safety validation.

## Repository map

- Browser app, workers and rendering. [apps/web](apps/web/)
- Simulator, scenarios, controllers, training and benchmark. [packages](packages/)
- Published runs, validation and engineering measurements. [results](results/)
- Design specifications, roadmap and release commands. [plan](plan/) · [ROADMAP.md](ROADMAP.md) · [HANDOFF.md](HANDOFF.md)

## Credits and licences

Source code is MIT-licensed. The asset credits list the model, font and media licences. [MIT licence](LICENSE) · [Asset credits](assets/CREDITS.md)

## Team

Maintained by [Junaid Ahamed](https://github.com/JunaidAhamed-7777).
