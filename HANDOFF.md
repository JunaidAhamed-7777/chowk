# CHOWK handoff

Start with [AGENTS.md](AGENTS.md) and the acceptance checks in [ROADMAP.md](ROADMAP.md). The production app is a static Vite build. Live, Results, Method and Limits run in the browser. Both Live workers use the same simulator and controller driver as the published benchmark.

## Verify a clean checkout

Use the Node version in [.node-version](.node-version).

```sh
npm ci
npm run lint
npm test
npm run assets:check
npm run build
npm exec -- playwright install chromium
npm run test:browsers
```

Run `npm run dev` and open the URL it prints. `/` starts the tour, `/?tour=off` opens the comparison controls and `/debug` provides tick-by-tick simulator playback in development. The Results replay checks the published metrics and final state hashes in browser workers. To exercise all three Playwright engines, install `chromium`, `firefox` and `webkit`, then set `CHOWK_BROWSER_MATRIX=1` and `CHOWK_VERIFY_REPRO=1` before running the browser tests. The GitHub Actions workflow also accepts a `browser_matrix` input.

## Benchmark and engineering data

The held-out runs, policy hashes and paired intervals live in [results/benchmark.json](results/benchmark.json). The generated [benchmark report](results/benchmark.md) and README results block come from that file. Use a clean checkout of the benchmark inputs. `npm run bench:smoke` exercises the runner on a validation seed. `npm run bench -- --suite B1 --replace` recomputes a B1-only publication. `npm run bench:all -- --replace` recomputes every suite. The seed rules in [AGENTS.md](AGENTS.md) govern training, validation and evaluation.

```sh
npm run sim:bench -- --write
npm run bench -- measure-policy
npm run build
npm run browser:budgets -- load
npm run browser:budgets -- soak
npm run capture -- measure
npm run bench -- --suite B8
```

Run the rendering, shaped-load and replay measurements with other heavy processes idle. `CHOWK_WRITE_ENGINEERING=1` asks the Playwright determinism and exact-replay tests to preserve machine-readable evidence under `runs/`. Capture merges the available measurements into [results/engineering.json](results/engineering.json). B8 copies them into the benchmark and regenerates the reports. The load trials and memory samples are in [results/browser-budgets.json](results/browser-budgets.json). `CHOWK_CAPTURE_GPU_LUID` accepts a machine-specific Windows DXGI adapter identifier in `high,low` form for the High tier and the video.

## Media

Install desktop Chrome and put FFmpeg on `PATH`. The capture script builds and serves the production app locally. The stills mode uses `/?capture=hero` and saves the loading poster and README stills. The video mode records the tour, a placed road closure, the published browser replay and the checkpoint slider from the real app. It exports an open-captioned MP4 and GIFs to `assets/demo/`. The `edit` mode reuses the captured source and timeline in `runs/capture/`. [Separate WebVTT file](assets/demo/captions.vtt)

```sh
npm run capture -- stills
npm run capture -- video
```

## Public release checks

- The Vercel production site deploys automatically from GitHub `main` and serves Live, Results, Method and Limits publicly. [Live](https://chowk-seven.vercel.app/) · [Results](https://chowk-seven.vercel.app/results) · [Method](https://chowk-seven.vercel.app/method) · [Limits](https://chowk-seven.vercel.app/limits) · [Vercel config](vercel.json)
- Fresh desktop sessions verified the production app and exact benchmark replay. The native macOS smoke workflow also passed against the public URL from GitHub’s network. [Public browser smoke](https://github.com/JunaidAhamed-7777/chowk/actions/runs/43120182193)
- Desktop coverage includes Chrome and Edge on Windows and macOS, native Safari on macOS, Firefox on WSL and Playwright WebKit on Windows. The [macOS workflow](.github/workflows/safari.yml) exercises the installed browsers. The 2D fallback and portrait touch-emulated Low tier passed locally. Physical iOS and Android checks remain open.
- Regenerate the Unstop draft with `npm run submission:prepare -- --demo https://chowk-seven.vercel.app/`. The command takes the headline from the committed benchmark, uses the published video URL and writes `docs/SUBMISSION.md`. [Submission draft](docs/SUBMISSION.md)
- The user submits the form on Unstop. Verify the links from the submitted page and record the final CI-green commit under the `v1.0-submission` tag as specified in [plan/08-submission.md](plan/08-submission.md).

## Interface pass (loading, guide, layout)

- `apps/web/src/ui/LoadingScreen.tsx` covers the scene until both simulations are ready. Its steps reflect real state (`policiesReady`, `ready`); do not turn them into timed animation.
- `apps/web/src/ui/Onboarding.tsx` is the first-visit guide (spec L13 in [plan/01-product-spec.md](plan/01-product-spec.md)). `/?guide=on` forces it, `/?guide=off` hides it, and automated browsers skip it by default. A Playwright test covers it.
- `apps/web/src/ui/liveLayout.css` holds the Live layout overrides and loads last.
- **Media is out of date.** `apps/web/public/poster.webp`, the README stills and GIFs and the demo video show the previous layout. Run `npm run capture -- stills` and `npm run capture -- video`, then check the README. Until then the loading card hides the poster's old interface behind a blur.
- Phone layout is not a target; do not spend time on it.
