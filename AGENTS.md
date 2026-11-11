# AGENTS.md

Instructions for AI agents working in this repository.

## What this is

**CHOWK**: a reinforcement-learned traffic-signal controller for lane-free Indian mixed traffic, delivered as a live 3D city in the browser with a reproducible benchmark. It is an entry for the INNOVEX 2026 hackathon (problem statement PS04, Smart Cities & Sustainability). Deadline: **15 Nov 2026, 23:55 IST**; submit by 20:00 IST.

The name is Hindi for a junction or crossroads. Ideation documents under `docs/` (other than `03-final-concept.md`) use the earlier working title GREENWAVE; treat the two as the same project.

The goal is a top-three finish. The strategy is to be far ahead of other entries on visual quality, liveness, proof and honesty. Read `plan/00-vision.md` before doing anything.

## Read in this order

1. `plan/00-vision.md` — strategy, pillars, non-negotiables
2. `ROADMAP.md` — what to do next and how to know it is done
3. The spec for your task:

| Working on | Read |
|---|---|
| Any interface or feature | `plan/01-product-spec.md` |
| The simulator | `plan/02-simulator.md` |
| Controllers, the policy, training | `plan/03-controllers-and-training.md` |
| Benchmarks, results, statistics | `plan/04-benchmark.md` |
| 3D, shaders, look and feel | `plan/05-rendering.md` |
| Blender models | `plan/06-assets.md` |
| Repository structure, workers, build | `plan/07-architecture.md` |
| README, video, submission text | `plan/08-submission.md` |
| Tests, budgets, risks, what to cut | `plan/09-quality.md` |

Background on why this concept was chosen is in `docs/`; you do not need it to build.

## Current state

The roadmap tracks which parts of the project are implemented. `HANDOFF.md` records the latest pass and what to do next. Commands below include planned work from `plan/07-architecture.md`. Check the corresponding task in the roadmap if a command does not exist yet.

## Commands (once scaffolded)

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

Environment: Windows 11. Use forward slashes in paths inside code and config. Scripts must work in both PowerShell and Git Bash; prefer Node scripts over shell scripts.

## Hard rules

These are not style preferences. Breaking one can lose the entry.

### Integrity of results

1. **Never write a result by hand.** Every number in the README, the app and the submission text is generated from `results/benchmark.json` or computed live. Never fill a `{{placeholder}}` with an expected, estimated or remembered value.
2. **Never touch test seeds** (1,000,000 and above) outside the benchmark CLI and the in-browser reproduction. Never train, tune, debug or select checkpoints on them. Use validation seeds (500,000–500,019) for every choice.
3. **Never weaken a baseline** to improve a comparison. Baselines get the true demand, tuned hysteresis and pre-emption variants as specified.
4. **Publish unfavourable results as they are.** If the learned controller does not beat max-pressure, the generated headline says so and stays.
5. **Label simulation as simulation.** No claim about real roads, real deployments or field validation.
6. **Do not claim novelty that was not confirmed.** No "first", "novel" or "state of the art". Cite prior work wherever the idea is described (`plan/08-submission.md`).
7. **Do not add statistics or citations from memory.** Open the source, confirm, link it, or leave it out.

### Integrity of the simulator

8. **One simulator.** Training, benchmark and demo import `@chowk/sim`. Never fork it, port it or write a "fast version".
9. **Determinism.** In `packages/sim` and in policy inference: no `Math.random`, `Date`, `performance.now`, `Math.pow`, `sin`, `cos`, `exp`, `tanh`, and no iteration whose order depends on insertion. Use the package PRNG. Fixed loop orders.
10. **No overlaps.** Vehicles never intersect. Fix the dynamics; never hide it in rendering.
11. **Metrics stay uncensored.** Delay accrues for vehicles in the network and in the entry backlog.

### Integrity of the experience

12. **The demo works on first click**: no login, key, backend, permission prompt or required interaction. Autoplay tour by default.
13. **Performance budgets are requirements** (`plan/09-quality.md`). Simulation never runs on the main thread. No allocation in the render loop.
14. **The look is night.** Follow `plan/05-rendering.md`. If something looks unfinished, remove it rather than ship it.
15. **Screenshots and video come from the real app.**

## Decisions already made

Listed in `plan/07-architecture.md` under "Decisions already made". Do not reopen them (TypeScript simulator, evolution strategies, residual on max-pressure, ReLU, hand-written inference, approach-based phasing, transferable buffers, authored network, fragment-discard split screen). If you believe one is wrong, stop and tell the user why, with evidence.

## Ask the user before

- Deploying, or changing hosting or domain settings
- Using paid 3D generation (`generate_3d`) or any paid service
- Importing third-party assets whose licence is not clearly CC0 or CC-BY
- Renaming the project
- Adding a dependency that is large, has a restrictive licence, or needs a network service at runtime
- Dropping a P0 feature or changing a gate in `ROADMAP.md`
- Submitting anything on Unstop, or changing repository settings on GitHub
- Force-pushing, rewriting history or deleting branches

## How to work

- **Pick tasks from `ROADMAP.md`**: lowest-numbered unblocked task in your track; P0 before P1 before P2. Tick the box when its "Done when" is verified.
- **Verify by running.** Type-checks and tests passing is necessary, not sufficient. Run the simulator, open the app, look at the scene. For anything visual, look at it at night from the aerial camera at the default quality tier.
- **Keep specs true.** If you change behaviour that a spec describes, update the spec in the same commit and add a line to the roadmap's change log.
- **Small commits, pushed often.** Commit after each roadmap task or coherent step, with a message that says what changed and why. Push to `main` after each commit unless the user says otherwise. Do not leave work uncommitted at the end of a session. Do not add `Co-Authored-By` or other attribution trailers to commit messages.
- **Report honestly.** If something does not work, a test fails, or a step was skipped, say so plainly. Do not describe unverified work as done.
- **Protect the schedule.** Check the gates in `ROADMAP.md`. When behind, cut in the order given in `plan/09-quality.md`; do not quietly reduce quality on P0 items.
- **Do not wait on other tracks.** Rendering uses a mock snapshot source until the simulator is ready; scenes use placeholder models until assets are ready.

## Code conventions

- TypeScript `strict`. No `any` in `packages/`. Named exports.
- `packages/sim`: zero runtime dependencies; typed arrays; no allocation inside `step`.
- `packages/controllers` and the neutral part of `packages/bench`: no Node built-ins, no DOM; they run in workers.
- SI units everywhere; left-hand traffic; coordinate frame as in `plan/02-simulator.md`.
- Parameters marked "(default)" in the specs are assumptions. Keep them in one constants module with a comment stating the source or "assumed".
- React: keep the render loop out of React state; stores update at low frequency.
- Tests live beside the package they test. New simulator behaviour needs a test.
- Comments explain why, not what. No commented-out code.

## Blender

Use the Blender MCP tools. Start with `get_addon_status` and `get_scene_info`; check results with `look`. Author assets with committed Python scripts under `assets/blender/`. Follow conventions and budgets in `plan/06-assets.md`. Record every imported asset in `assets/CREDITS.md` before committing it.

## Where things go

| Thing | Location |
|---|---|
| Specs | `plan/` |
| Task state | `ROADMAP.md` |
| Ideation history | `docs/` |
| Benchmark outputs | `results/` (committed) |
| Training runs | `runs/` (git-ignored) |
| Exported policies | `apps/web/public/policies/` |
| Built models | `apps/web/public/models/` |
| Blender scripts | `assets/blender/` |
