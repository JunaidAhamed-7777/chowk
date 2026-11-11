# Final Concept — GREENWAVE (working title)

> Locked in on 12 Nov 2026. The detailed, authoritative specification is in [`plan/`](../plan/00-vision.md) and the task list in [`ROADMAP.md`](../ROADMAP.md). Where this summary and `plan/` differ, `plan/` wins.

**Problem statement:** PS04 Smart Cities & Sustainability — traffic optimization.

## One line

Traffic signals that learned to drive Indian roads: a reinforcement-learned signal controller trained on lane-free, two-wheeler-dominated traffic, running live in a 3D night city in your browser.

## The idea

Adaptive signal research assumes cars queue in lanes. Indian traffic does not: two-wheelers filter to the front, autos and buses share width, and a "queue" is an area of road, not a count of cars. Controllers designed for lane-disciplined roads misjudge demand on these junctions.

This insight is not ours. Nandakumar, Banerjee and Vanajakshi ([arXiv 2509.21745](https://arxiv.org/abs/2509.21745), 2025) trained PPO signal control on a laneless heterogeneous intersection in SUMO and found a much larger gain over Webster there than on lane-based traffic. C-DAC's CoSiCoSt, designed for lane-free traffic, runs Bengaluru's adaptive signals. We cite both and build on them.

**What is ours:** that research lives in papers and desktop simulators. GREENWAVE puts a lane-free simulator and a trained controller in a browser tab, at corridor scale, where anyone can watch it, attack it, and check the result for themselves.

GREENWAVE has three parts:

1. **A lane-free mixed-traffic micro-simulator** written in TypeScript. Vehicles (two-wheelers, auto-rickshaws, cars, buses) have real footprints and move in continuous lateral space, so filtering and width-sharing emerge on their own.
2. **A learned signal controller.** One shared policy controls every junction in a corridor. It observes occupied road area per approach rather than vehicle counts, and is trained in the same simulator running headless in Node.
3. **A live 3D twin.** The simulator and the trained policy run in the browser on a night-time city. Nothing is pre-recorded.

## What the judge sees

- **0–10 s, no clicks:** an aerial night view of a corridor, thousands of head- and tail-lights. A vertical wipe splits the screen: the same traffic, same random seed, under fixed timers on one side and GREENWAVE on the other. Red queues on one side, flow on the other. Three large live numbers: delay per vehicle, stops, CO2.
- **First interaction:** drag the wipe. Queues dissolve or re-form under it.
- **Break it:** buttons to inject a surge, block a lane, or dispatch an ambulance. The policy adapts live, and the ambulance gets a green corridor.
- **See it think:** each approach glows by the pressure the controller perceives, and a signal change shows which approach won and why.
- **Autoplay:** the demo opens in a guided camera tour that hits all of the above without a click. The visual judge's storyboard is in [judging/judge-4-visual.md](judging/judge-4-visual.md).

## The number

Mean delay per vehicle on held-out seeds, GREENWAVE versus two baselines, with 95% confidence intervals:

- Webster fixed-time (what most junctions run)
- Max-pressure (the strong classical adaptive baseline)

Reported for two traffic mixes: lane-disciplined cars only, and Indian mixed traffic. The 2025 paper reports that the gap to Webster widens in laneless traffic. We test whether that holds in an independent simulator and against the stronger max-pressure baseline, and report what we measure either way.

These are simulation results and will be labelled as such everywhere.

## Technology

| Layer | Choice |
|---|---|
| Simulator | TypeScript, deterministic and seeded, shared by training and demo |
| Training | Headless Node with worker threads. Default: evolution strategies on a small shared MLP policy, since it needs no gradient tooling and exports plain weights. PPO is a stretch goal. |
| Fallback controller | Learned residual on top of max-pressure, if plain RL is not ahead by the end of day 2 |
| Rendering | three.js / react-three-fiber, instanced vehicles, emissive lights with bloom, quality tiers for integrated GPUs and mobile |
| 3D assets | Blender: low-poly vehicle set, modular building and road kit, exported as glTF |
| Hosting | Static site (Vercel). No backend, no keys, no login. |

## Scope

**In:** one hand-authored corridor of 4–6 junctions modelled on a Bengaluru arterial; four vehicle classes; two baselines; split-screen comparison; surge, lane-block and ambulance events; perception overlay; autoplay tour; results page with method and limits.

**Out:** OpenStreetMap import, arbitrary cities, pedestrians, real sensor feeds, any claim about real-world deployment results.

## Plan

| Day | Goal | Done when |
|---|---|---|
| 12 Nov | Simulator core and baselines | Headless sim runs a corridor with mixed traffic; Webster and max-pressure produce delay numbers; no vehicle overlaps |
| 13 Nov | Training, and 3D scene in parallel | Policy trains overnight; night city renders 2,000+ vehicles smoothly on an integrated GPU. **Checkpoint:** if RL is not ahead of max-pressure, switch to the residual controller. |
| 14 Nov | Product | Split-screen wipe, events, perception overlay, live counters, Blender assets in |
| 15 Nov | Proof and polish | Benchmark table with confidence intervals, autoplay tour, README with hero GIF, 90-second video, submit well before 23:55 IST |

The technical judge's fuller day-by-day outline is in [judging/judge-2-technical.md](judging/judge-2-technical.md).

## Risks

| Risk | Mitigation |
|---|---|
| RL does not beat max-pressure | Residual controller; honest reporting; the lane-free simulator and live demo stand on their own |
| Lane-free vehicle model is unstable or slow | Start with a simple lateral-gap model; cap vehicle count; correctness tests for overlap and conservation |
| Looks cheap | Night scene, bloom, Blender kit, camera choreography; never show daylight grey boxes |
| Poor frame rate on judge's laptop | Quality tiers, instancing, vehicle cap, auto-detect and degrade |
| Originality read as "another traffic RL project" (scored 5.0 in round 2) | Do not claim the lane-free idea as new. Lead with "the first one you can play with": live policy, judge-triggered disruptions, corridor scale. Cite the prior work openly. |

## Open questions

- Team size and who owns simulator, training, and 3D.
- Final name. "Green wave" is a generic traffic-engineering term; a distinctive name would help.
- Which Bengaluru stretch to model the corridor on.
- Whether multi-junction corridor control in lane-free traffic has been published; the 2025 paper covers a single intersection, and corridor-scale prior work was not searched.
- Whether to add a second original mechanism to lift originality, if time allows after the core works.

## Alternatives considered

AQUIFER (shared-groundwater twin) was evaluated head-to-head in a second judging round and scored higher on originality (6.5 versus 5.0) but lower on feasibility, fit and visual power. See [02-judging-synthesis.md](02-judging-synthesis.md) and [04-aquifer-concept.md](04-aquifer-concept.md).

## Fallback

If the simulator is not producing sane traffic by the end of 12 Nov, switch to the runner-up: fraud-ring detection on the IBM AML dataset with a 3D transaction graph (4.5 person-days, demo reliability 9). See [02-judging-synthesis.md](02-judging-synthesis.md).
