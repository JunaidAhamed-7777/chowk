# 07 — Architecture

## Stack

| Concern | Choice | Why |
|---|---|---|
| Language | TypeScript, `strict` | One language for simulator, training, benchmark and app |
| Runtime | Node 22 LTS for tooling | `worker_threads`, native test runner compatibility |
| Package manager | pnpm workspaces | Fast, strict, monorepo-friendly |
| App build | Vite | Fast dev server, simple static output, worker bundling |
| UI | React | Ecosystem for react-three-fiber |
| 3D | three.js, `@react-three/fiber`, `@react-three/drei`, `postprocessing` | Instancing, bloom, controllable render loop |
| State | zustand | Updates outside React's render cycle |
| Styling | Tailwind CSS | Speed, consistency with tokens |
| Charts | Hand-written SVG components | Few chart types; no heavy dependency; full control of look |
| Unit tests | Vitest | Shares Vite config |
| Browser tests | Playwright (Chromium, Firefox, WebKit) | Cross-engine determinism and smoke tests |
| Lint and format | ESLint + Prettier (or Biome) | Pick one at setup and keep it |
| CI | GitHub Actions | Tests, determinism, benchmark smoke, build |
| Hosting | Static host: Vercel, with GitHub Pages as fallback | No backend needed |

Install the latest stable versions at setup time and check that the react-three-fiber major version matches the React major version. Record exact versions in the lockfile; do not upgrade mid-project.

No backend. No database. No API keys. No analytics that need consent.

## Repository layout

```
/
├─ AGENTS.md
├─ ROADMAP.md
├─ README.md
├─ package.json, pnpm-workspace.yaml, tsconfig.base.json
├─ .github/workflows/ci.yml
├─ apps/
│  └─ web/                      the application
│     ├─ index.html
│     ├─ public/
│     │  ├─ models/             built .glb files
│     │  ├─ policies/           greenwave.json, checkpoints, training-curve.json
│     │  └─ poster.webp
│     └─ src/
│        ├─ main.tsx, App.tsx, routes/
│        ├─ scene/              R3F components: City, Roads, Vehicles, Signals, Lights, Overlays, Cameras, Effects
│        ├─ sim/                worker hosts, clock, snapshot interpolation
│        ├─ workers/            sim.worker.ts, bench.worker.ts
│        ├─ ui/                 TopBar, MetricCards, Controls, Wipe, Tour, Toasts
│        ├─ views/              Live, Results, Method, Limits
│        ├─ charts/             SVG chart components
│        ├─ state/              zustand stores
│        ├─ tour/               timeline JSON and player
│        └─ fallback2d/         canvas renderer
├─ packages/
│  ├─ sim/                      @greenwave/sim: the simulator (zero dependencies)
│  │  ├─ src/                   network, vehicles, dynamics, signals, demand, events, metrics, sense, hash, rng
│  │  ├─ networks/              corridor.json, grid-holdout.json
│  │  └─ test/
│  ├─ controllers/              @greenwave/controllers: baselines, greenwave policy, driver, explain
│  ├─ scenarios/                @greenwave/scenarios: scenario definitions, calibration loader
│  ├─ bench/                    @greenwave/bench: CLI, statistics, report generation
│  └─ train/                    @greenwave/train: ES, worker pool, checkpoints, export
├─ assets/
│  ├─ blender/                  Python scripts
│  └─ CREDITS.md
├─ results/                     calibration.json, benchmark.json, benchmark.md (committed)
├─ runs/                        training runs (git-ignored except what is exported)
├─ plan/
└─ docs/
```

## Dependency rules

```
sim  ←  scenarios  ←  controllers  ←  bench
                              ↑          ↑
                            train       web
```

- `@greenwave/sim` imports nothing.
- `@greenwave/controllers` imports `sim` and `scenarios` only. It must run in Node and in browser workers: no Node built-ins, no DOM.
- `bench` core (run one episode, compute statistics) is environment-neutral and is imported by the web app's bench worker. Only its CLI entry uses Node built-ins.
- `train` is Node-only.
- `web` imports `sim`, `scenarios`, `controllers` and the neutral part of `bench`.

## Runtime architecture in the browser

```
                    Main thread
   ┌───────────────────────────────────────────────┐
   │ React UI  ── zustand stores ──  R3F render loop│
   │        ▲            ▲                 ▲        │
   │        │ metrics    │ commands        │ snapshots (interpolated)
   │        └────────────┴── SimHost ──────┘        │
   └──────────────┬───────────────────┬─────────────┘
                  │ postMessage        │ postMessage
        ┌─────────▼────────┐  ┌────────▼─────────┐      ┌──────────────────┐
        │ Sim worker A     │  │ Sim worker B     │      │ Bench worker pool │
        │ sim + controller │  │ sim + controller │      │ (Results view)    │
        └──────────────────┘  └──────────────────┘      └──────────────────┘
```

### Clock and lockstep

The main thread owns simulated time. Each animation frame it computes the target tick from wall time and the speed multiplier and sends `advanceTo(tick)` to both workers. Workers step to that tick and reply with a snapshot. Both simulations therefore stay at the same simulated time, and events are sent with a target tick so they land identically in both.

If a worker falls behind (slow device at 16x), the clock slows rather than letting the two drift apart.

### Snapshots

Workers write vehicle state into a `Float32Array` from a small pool and **transfer** it to the main thread (no copy); the main thread returns used buffers. `SharedArrayBuffer` is not used, so no cross-origin isolation headers are needed and the app works on any static host.

The main thread keeps the last two snapshots per simulation and interpolates for rendering (`05-rendering.md`).

### Worker protocol

```ts
// main → worker
type ToSim =
  | { type: 'init'; network: Network; scenario: Scenario; seed: number; controller: string; policy?: PolicyWeights; maxVehicles?: number }
  | { type: 'advanceTo'; tick: number; buffer?: ArrayBuffer }
  | { type: 'event'; atTick: number; event: SimEvent }
  | { type: 'setController'; controller: string; policy?: PolicyWeights }
  | { type: 'setOverlayData'; pressure: boolean; decision: boolean }
  | { type: 'pause' } | { type: 'dispose' };

// worker → main
type FromSim =
  | { type: 'ready' }
  | { type: 'frame'; tick: number; count: number; vehicles: ArrayBuffer; signals: Uint8Array;
      metrics?: Metrics; sense?: JunctionSense[]; explain?: Explanation[] }
  | { type: 'error'; message: string };
```

Metrics are attached four times per simulated second at most; sense and explanation data only when their overlay is on.

### State stores

| Store | Holds | Update rate |
|---|---|---|
| `useSession` | Scenario, seed, controllers A and B, speed, paused, overlay, camera, quality, tour state | On interaction |
| `useMetrics` | Rolling metrics for A and B, sparkline history, event marks | 4 Hz |
| `useBench` | Published results, reproduction progress and results | On progress |

The render loop reads snapshot buffers and a few transient values directly; it does not go through React state.

### Changing things mid-run

- **Controller change:** applied at the next decision step on that side; the simulation is not reset, so the visitor sees the effect on the same traffic.
- **Scenario or seed change:** both simulations are re-initialised and fast-forwarded through warm-up before the scene fades back in.
- **Events:** broadcast to both with the same target tick.

## Build-time integrity

A small Vite plugin and a prebuild script:

- compute `simVersion`, a hash over `packages/sim/src`, `packages/controllers/src` and `packages/scenarios/src`, and inject it as a constant;
- compute `policyHash` over the policy file;
- **fail the build** if either differs from `results/benchmark.json`'s `meta`, unless `ALLOW_STALE_RESULTS=1` is set for development. A deployed build therefore always matches its published numbers.

## Policy file format

```ts
interface PolicyWeights {
  format: 'greenwave-mlp-v1';
  layers: Array<{ in: number; out: number; w: string; b: string }>; // base64 Float32, row-major
  beta: number;
  obsVersion: number;
  meta: { generation: number; validationFitness: number; gitCommit: string; configHash: string };
}
```

## Scripts (root `package.json`)

| Script | Does |
|---|---|
| `pnpm dev` | Web dev server |
| `pnpm build` | Integrity check, type-check, production build |
| `pnpm test` | Vitest across packages |
| `pnpm test:browsers` | Playwright determinism and smoke tests |
| `pnpm sim:bench` | Simulator speed measurement |
| `pnpm train` | Start or resume a training run |
| `pnpm train:export` | Export chosen checkpoints to the web app |
| `pnpm bench:*` | See `04-benchmark.md` |
| `pnpm assets:build`, `pnpm assets:check` | See `06-assets.md` |
| `pnpm lint`, `pnpm typecheck` | Static checks |

## Deployment

- Static output from `apps/web/dist`.
- Long cache lifetimes for hashed assets; models and policies are fingerprinted or versioned in the URL.
- Client-side routes need a fallback to `index.html` (host rewrite rule, or use hash routing if the host cannot rewrite).
- Deploying needs the user's hosting account. An agent prepares the build and configuration; the user authorises the deployment.

## Decisions already made (do not reopen without the user)

| Decision | Chosen | Rejected |
|---|---|---|
| Simulator language | TypeScript, shared everywhere | Python or SUMO for training with a port for the demo (train/deploy mismatch) |
| Training method | Evolution strategies | PPO first (tooling and tuning risk) |
| Controller form | Residual on area max-pressure | Pure network (risk of not beating baseline) |
| Activation | ReLU | tanh (not bit-identical across engines) |
| Inference | Hand-written TypeScript | ONNX Runtime Web (size, non-determinism risk) |
| Phasing | Approach-based | Movement-based (needs lane separation) |
| Worker data | Transferable buffers | SharedArrayBuffer (needs special headers) |
| Network source | Authored JSON | OpenStreetMap import (schedule risk) |
| Split screen | Fragment discard by screen x | Two render passes with scissor |
