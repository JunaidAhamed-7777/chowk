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

The held-out runs, policy hashes and paired intervals live in [results/benchmark.json](results/benchmark.json). The generated [benchmark report](results/benchmark.md) and README results block come from that file. Use a clean checkout of the benchmark inputs. `npm run bench:smoke` exercises the runner on a validation seed. `npm run bench -- --suite B1` publishes the primary held-out comparison. The seed rules in [AGENTS.md](AGENTS.md) govern training, validation and evaluation.

```sh
npm run sim:bench -- --write
npm run bench -- measure-policy
npm run capture -- measure
npm run bench -- --suite B8
npm run bench:readme
```

The first three commands record simulator throughput, exported-policy inference and desktop rendering measurements. The capture script incorporates the current inference timing into [results/engineering.json](results/engineering.json). B8 copies the measurements into the benchmark and the README generator reads them from there. `CHOWK_CAPTURE_GPU_LUID` accepts a machine-specific Windows DXGI adapter identifier in `high,low` form. It selects the adapter for the High-tier measurement and video capture.

## Media

Install desktop Chrome and put FFmpeg on `PATH`. The capture script builds and serves the production app locally. The stills mode uses `/?capture=hero` and saves the loading poster and README stills. The video mode records the tour, the published browser replay and the checkpoint slider from the real app. It uses the caption track and produces the clip, looping hero and Results still in `assets/demo/`. [Caption track](assets/demo/captions.vtt)

```sh
npm run capture -- stills
npm run capture -- video
```

## Public release checks

- The static host configuration lives in [vercel.json](vercel.json). Obtain the user's deployment approval, then verify the live URL and direct Results, Method and Limits routes in a private window. Open the public demo from a different network.
- Local coverage includes desktop Chrome and Edge on Windows, Firefox on WSL, Windows Playwright WebKit, the top-down fallback and a portrait touch-emulated Low-tier run. Native Safari on macOS and iOS and Chrome on a physical Android device still need release checks.
- Once the public demo and video URLs are confirmed, generate the Unstop draft with `npm run submission:prepare -- --demo <public-demo-url> --video <public-video-url>`. The command takes the headline from the committed benchmark and writes `docs/SUBMISSION.md`.
- The user submits the form on Unstop. Verify the links from the submitted page and record the final CI-green commit under the `v1.0-submission` tag as specified in [plan/08-submission.md](plan/08-submission.md).
