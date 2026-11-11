# 00 — Vision and Winning Strategy

Read this first. Every other file in `plan/` serves what is written here.

## Product in one sentence

GREENWAVE is a traffic-signal controller that learned to manage lane-free Indian traffic, shipped as a live, playable 3D night city in a browser tab, with a benchmark any visitor can re-run themselves.

## Context

- INNOVEX 2026, problem statement **PS04 Smart Cities & Sustainability — traffic optimization**.
- Submission: title, description, technologies, GitHub URL, live demo link, on Unstop. Deadline **15 Nov 2026, 23:55 IST**.
- Stated criteria: **originality, innovation, technical implementation, real-world impact**.
- Judging is asynchronous. Assume a judge gives the entry 2–5 minutes on an ordinary laptop, possibly an integrated GPU, and that most rival entries are Streamlit apps and chatbots.
- Background and the reasoning behind this choice: `docs/02-judging-synthesis.md`, `docs/03-final-concept.md`.

## How we win

We cannot out-originate everyone (originality scored 5.0 of 10 in judging). We win by being so far ahead on four other things that the gap is obvious in seconds:

1. **Nothing else will look like this.** A cinematic night city with thousands of moving lights, in the first frame, with no clicks.
2. **Nothing else will be this alive.** The simulation and the trained policy run live in the visitor's browser. The visitor can attack the system and watch it respond. No video, no canned result.
3. **Nothing else will be this provable.** A full benchmark suite with strong baselines, held-out seeds, confidence intervals, ablations and generalisation tests, and a button that re-runs it in the visitor's own browser and matches our published numbers.
4. **Nothing else will be this honest.** Prior work is cited, limits are stated, every number is labelled as simulation. Judges who have read a hundred inflated claims notice the one entry that does not inflate.

## The five pillars

Every feature belongs to one of these. If a proposed feature serves none, it is cut.

| Pillar | What it means | Detail in |
|---|---|---|
| **Spectacle** | The first 10 seconds stop a tired judge. Cinematic, premium, smooth. | `05-rendering.md`, `06-assets.md` |
| **Play** | The visitor can break traffic and watch the controller cope. | `01-product-spec.md` |
| **Proof** | Benchmarks that survive a sceptical engineer, reproducible on the spot. | `04-benchmark.md` |
| **Insight** | The visitor can see what the controller perceives and why it acts. | `01-product-spec.md`, `03-controllers-and-training.md` |
| **Craft** | A repository a senior engineer respects: tested, deterministic, documented, fast. | `07-architecture.md`, `09-quality.md` |

## What is ours, stated honestly

Prior work exists and we cite it (see `08-submission.md` for wording):

- Nandakumar, Banerjee, Vanajakshi, arXiv 2509.21745 (2025): PPO signal control on a laneless heterogeneous intersection in SUMO.
- C-DAC's CoSiCoSt: adaptive control designed for lane-free traffic, deployed in Bengaluru.
- Max-pressure control and Webster's method: the classical baselines.

Our contributions:

1. **A browser-native, deterministic, lane-free mixed-traffic micro-simulator** in TypeScript, the same code for training, benchmarking and the live demo.
2. **Corridor-scale control** with one shared policy across several junctions. Whether this is new for lane-free traffic was not searched; describe it as an extension, not a first.
3. **Area-based perception and person-weighted objective.** The controller observes occupied road area rather than vehicle counts, and minimises delay to people rather than to vehicles, so a bus with forty passengers counts for more than a car with one. Novelty of the person-weighted objective in this setting was not searched; do not claim it as a first.
4. **A learned controller built as a residual on max-pressure**, so it starts at the classical baseline and can only be trained upward from there.
5. **An in-browser reproducible benchmark.** The visitor runs the evaluation themselves.
6. **A live adversarial demo.** Surges, lane blocks, ambulances, sensor failures, on demand.

## The judge's journey

This is the script the product is built to deliver. Timings are targets.

| Time | What the judge experiences | Criterion served |
|---|---|---|
| 0–3 s | Page paints. Night city fades in, traffic already flowing. No spinner longer than 2 s. | Spectacle |
| 3–15 s | Autoplay tour. Camera glides down a corridor; a caption says what this is. A vertical wipe sweeps across: left half jams in red under fixed timers, right half flows under GREENWAVE. Three big live numbers diverge. | Spectacle, impact |
| 15–40 s | Tour continues: an ambulance gets a green corridor; a surge hits and the controller absorbs it; the perception overlay shows what the controller sees. | Play, insight, innovation |
| 40–90 s | Judge takes over. Drags the wipe. Presses "Block a lane". Changes the controller. Rides along on a two-wheeler. | Play |
| 90–180 s | Opens Results. Sees the benchmark table with confidence intervals and ablations. Presses "Run it yourself"; their browser reproduces a row in under a minute and it matches. | Proof, technical implementation |
| 180 s+ | Opens the repository. Sees a clean README with a hero GIF, the numbers, the architecture, a passing CI badge, a method page that cites prior work and states limits. | Craft, originality |

## Non-negotiables

1. **The demo works on first click** in current Chrome, Edge, Firefox and Safari, with no login, no key, no backend, no permission prompt.
2. **Autoplay by default.** A judge who never touches the mouse still sees the whole story.
3. **30 fps or better on an integrated GPU** at the default quality tier; automatic downgrade if not.
4. **Every number shown is computed**, by the live simulation or by the committed benchmark output. No hard-coded results, anywhere.
5. **Held-out seeds are never used for training or tuning.**
6. **Every result is labelled a simulation result.** No claim about real-world deployment.
7. **Prior work is cited** wherever we describe the idea.
8. **One simulator.** Training, benchmark and demo import the same package. No second implementation.

## What "overfit to the judging criteria" means here

Each criterion has a named artefact a judge will hit without looking for it:

| Criterion | Artefact |
|---|---|
| Originality | Method page section "What is new here and what is not", in-browser reproducible benchmark, person-weighted lane-free control |
| Innovation | Residual-on-max-pressure controller, area-based perception overlay, "watch it learn" checkpoint slider |
| Technical implementation | Deterministic simulator with tests, benchmark suite with CI, architecture diagram, performance numbers |
| Real-world impact | Live delay / stops / CO2 / people-hours counters, ambulance response time, cited problem statistics, honest limits |

It does not mean tuning on test seeds, cherry-picking scenarios, or presenting simulation as field results. Those would lose the entry on inspection.

## Scope boundary

**In:** one authored corridor (plus one held-out network used only for evaluation), five vehicle classes, six controllers, a scenario library, the live 3D demo, the benchmark, method and limits pages, README, video.

**Out:** OpenStreetMap import, arbitrary cities, pedestrians and crossings, real sensor feeds, a backend, user accounts, mobile-first design (mobile must work, at reduced quality).

## File map

| File | Contents |
|---|---|
| `00-vision.md` | This file |
| `01-product-spec.md` | Every screen, control and feature |
| `02-simulator.md` | The lane-free traffic simulator |
| `03-controllers-and-training.md` | Baselines, the learned controller, training |
| `04-benchmark.md` | Evaluation protocol and results pipeline |
| `05-rendering.md` | Art direction and real-time rendering |
| `06-assets.md` | Blender asset list and pipeline |
| `07-architecture.md` | Repository layout, stack, module interfaces |
| `08-submission.md` | README, video, Unstop text, citations |
| `09-quality.md` | Tests, performance budgets, CI, release checklist |
| `../ROADMAP.md` | Ordered tasks with acceptance criteria |
| `../AGENTS.md` | Rules for AI agents working in this repository |
