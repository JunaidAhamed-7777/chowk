# AGENTS.md

Instructions for AI agents and contributors working in this repository.

## What this is

**CHOWK** is a learned traffic-signal controller for lane-free Indian mixed traffic, delivered as a live 3D corridor in the browser with a benchmark anyone can reproduce. *Chowk* is Hindi for a junction. It is an INNOVEX 2026 entry for PS04, Smart Cities & Sustainability.

Start with [README.md](README.md). The published benchmark is [results/benchmark.md](results/benchmark.md), generated from [results/benchmark.json](results/benchmark.json).

## Layout

| Path | Contents |
|---|---|
| `packages/sim` | Deterministic lane-free traffic simulator (zero runtime dependencies) |
| `packages/scenarios` | Demand scenarios and calibration |
| `packages/controllers` | Webster, actuated, max-pressure and CHOWK controllers; hand-written policy inference |
| `packages/train` | Evolution-strategies training |
| `packages/bench` | Benchmark suites, statistics, reports and the README results block |
| `apps/web` | The browser app: React, three.js, simulation workers |
| `results/` | Published benchmark, validation and engineering measurements (committed) |
| `exports/c` | Dependency-free C export of the policy, checked against TypeScript in CI |
| `assets/` | Blender scripts, built models, demo media and credits |
| `scripts/` | Capture, submission, brief and verification scripts |
| `tests/browser` | Playwright tests |
| `docs/` | Generated submission text and one-page brief |

## Commands

```
npm install                  install
npm run dev                  web dev server
npm run build                integrity check, type-check, production build
npm run typecheck            TypeScript
npm run lint                 lint
npm test                     unit tests
npm run test:browsers        Playwright determinism and smoke tests
npm run sim:bench            simulator speed
npm run train                start or resume training
npm run train:export         export policy checkpoints to the app
npm run bench:calibrate      measure saturation flows
npm run bench -- --suite B1  run a benchmark suite
npm run bench:summarise      recompute statistics and the headline
npm run bench:readme         regenerate README results and benchmark.md
npm run assets:build         compress models into the app
npm run assets:check         verify model budgets and dimensions
```

Environment: Windows 11 is the primary development machine. Use forward slashes in paths inside code and config. Scripts must work in both PowerShell and Git Bash; prefer Node scripts over shell scripts.

## Hard rules

### Integrity of results

1. **Never write a result by hand.** Every number in the README, the app and the submission text is generated from `results/benchmark.json` or computed live. The README results block is written by `npm run bench:readme`; edit `packages/bench/src/report.ts`, not the block. Never fill a `{{placeholder}}` with an expected, estimated or remembered value.
2. **Never touch test seeds** (1,000,000 and above) outside the benchmark CLI and the in-browser reproduction. Never train, tune, debug or select checkpoints on them. Use validation seeds (500,000–500,019) for every choice.
3. **Never weaken a baseline** to improve a comparison. Baselines get the true demand, tuned hysteresis and pre-emption variants.
4. **Publish unfavourable results as they are.** If CHOWK does not beat a baseline on a metric, the generated text says so and stays.
5. **Label simulation as simulation.** No claim about real roads, real deployments or field validation.
6. **Do not claim novelty that was not confirmed.** No "first", "novel" or "state of the art". Cite prior work wherever the idea is described.
7. **Do not add statistics or citations from memory.** Open the source, confirm, link it, or leave it out.

### Integrity of the simulator

8. **One simulator.** Training, benchmark and demo import `@chowk/sim`. Never fork it, port it or write a "fast version".
9. **Determinism.** In `packages/sim` and in policy inference: no `Math.random`, `Date`, `performance.now`, `Math.pow`, `sin`, `cos`, `exp`, `tanh`, and no iteration whose order depends on insertion. Use the package PRNG. Fixed loop orders.
10. **No overlaps.** Vehicles never intersect. Fix the dynamics; never hide it in rendering.
11. **Metrics stay uncensored.** Delay accrues for vehicles in the network and in the entry backlog.
12. **The published benchmark is fingerprinted.** `packages/bench/src/provenance.ts` hashes the raw bytes of the simulator, controllers, scenarios, `packages/bench/src/{episode,metrics,suites}.ts` and `results/calibration.json`. Any edit there, comments included, fails `npm run build` until the benchmark is re-run.

### Integrity of the experience

13. **The demo works on first click**: no login, key, backend, permission prompt or required interaction. Autoplay tour by default.
14. **Performance budgets are requirements.** Simulation never runs on the main thread. No allocation in the render loop.
15. **The scene's time of day follows the scenario** (morning peak by day, evening peak at dusk, other scenarios at night, monsoon with rain). If something looks unfinished, remove it rather than ship it.
16. **Screenshots and video come from the real app.**

## Decisions already made

TypeScript simulator, evolution strategies, a residual on max-pressure, ReLU, hand-written inference, approach-based phasing, transferable buffers, an authored network and a fragment-discard split screen. Do not reopen them without evidence; if you believe one is wrong, stop and explain why.

## Ask the user before

- Deploying, or changing hosting or domain settings
- Using paid 3D generation or any paid service
- Importing third-party assets whose licence is not clearly CC0 or CC-BY
- Renaming the project
- Adding a dependency that is large, has a restrictive licence, or needs a network service at runtime
- Submitting anything on Unstop, or changing repository settings on GitHub
- Force-pushing, rewriting history or deleting branches

## How to work

- **Verify by running.** Type-checks and tests passing is necessary, not sufficient. Run the simulator, open the app, look at the scene. For anything visual, look at it at night from the aerial camera at the default quality tier.
- **Small commits, pushed often.** Commit after each coherent step with a message that says what changed and why. Push to `main` unless the user says otherwise. Do not add `Co-Authored-By` or other attribution trailers.
- **Report honestly.** If something does not work, a test fails, or a step was skipped, say so plainly.

## Code conventions

- TypeScript `strict`. No `any` in `packages/`. Named exports.
- `packages/sim`: zero runtime dependencies; typed arrays; no allocation inside `step`.
- `packages/controllers` and the neutral part of `packages/bench`: no Node built-ins, no DOM; they run in workers.
- SI units everywhere; left-hand traffic; +x east, −z north.
- Assumed parameters live in one constants module with a comment stating the source or "assumed".
- React: keep the render loop out of React state; stores update at low frequency.
- Tests live beside the package they test. New simulator behaviour needs a test.
- Comments explain why, not what. No commented-out code.

## Blender

Author assets with committed Python scripts under `assets/blender/`. Record every imported asset in `assets/CREDITS.md` before committing it. Run `npm run assets:check` after building.
