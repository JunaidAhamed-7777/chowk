# 03 — Controllers and Training

Package `@chowk/controllers` (runs everywhere) and `@chowk/train` (Node only).

## Controller interface

```ts
interface Controller {
  readonly id: string;                       // 'webster' | 'actuated' | 'mp-count' | 'mp-area' | 'chowk' | 'chowk-pure'
  init(network: Network, scenario: Scenario): void;
  /** Called every 5 s per junction. Returns the phase to request. */
  act(junctionId: number, sense: JunctionSense, neighbours: NeighbourSense): number;
  /** Optional: scores and reason for the Decision overlay. */
  explain?(junctionId: number): Explanation;
}
interface Explanation {
  scores: number[];            // per phase, final
  prior?: number[];            // per phase, from max-pressure
  learned?: number[];          // per phase, from the network
  reason: string;              // short human-readable line
}
```

A shared **driver** steps the simulator and calls controllers every 20 ticks. The same driver is used by the demo, the benchmark and training.

### Rules applied to every adaptive controller

So comparisons are fair, these wrap all controllers except fixed-time:

- **Starvation guard:** if any approach has waited more than 150 s, it is served next.
- **Phase mask:** phases that do not exist at a junction (T-junctions) cannot be chosen.
- Minimum green, yellow, all-red and maximum green are enforced by the simulator for everyone.

## Baselines

Baselines must be strong. A weak baseline makes the result worthless to anyone who knows the field.

### 1. Fixed-time (Webster) — `webster`

- For each junction and phase, flow ratio `y = q / s`: `q` is the scenario's **true mean arrival rate** for that approach (the baseline is told the real demand), `s` is the saturation flow measured in this simulator for the scenario's vehicle mix.
- Lost time `L = phases × (yellow + allRed)`. Cycle `C = (1.5·L + 5) / (1 − Σy)`, clamped to 40–150 s. Greens split in proportion to `y`, each at least minimum green.
- If minimum greens leave any phase above a degree of saturation `y·C / g` of 0.9 (assumed practical limit), the cycle is lengthened one second at a time, up to 150 s, until none is; otherwise the cycle with the lowest peak is kept. Without this, light cross streets padded to minimum green starved the arterial in off-peak demand.
- Offsets between junctions along the arterial set from free-flow travel time for the heavier direction.
- When the scenario has time-varying demand, plans are recomputed per 15-minute period from that period's true mean.

### 2. Actuated — `actuated`

Cycles through phases in order. Extends the current green while vehicles are still arriving (`areaNear` above a threshold) up to maximum green; skips phases with nothing waiting.

### 3. Max-pressure, vehicle counts — `mp-count`

The standard formulation. For each phase (approach `a`):

```
pressure(a) = count(a) − Σ over exits r of turnRatio(a→r) · count(exit r)
```

Request the phase with the highest pressure; switch only if it beats the current phase by a small margin (hysteresis, tuned on validation seeds).

### 4. Max-pressure, area — `mp-area`

The same, with occupied road area in place of vehicle counts on both sides. This is the lane-free adaptation and the fairest strong baseline; **CHOWK must be judged against this one first.**

### Emergency variants

For the ambulance tests, each baseline also runs with a rule-based pre-emption: if an approach reports `emergency`, serve it. Reported as `mp-area+preempt` and so on, so CHOWK's learned behaviour is compared with the standard engineering answer, not with baselines that ignore the ambulance. CHOWK also runs with the same rule as `chowk+preempt`, which is the variant a deployment would use.

## CHOWK — the learned controller

### Design: a residual on area max-pressure

```
score(p) = β · prior(p) + net_θ(obs)[p]
action   = argmax over valid phases of score(p)
```

- `prior(p)` is the area max-pressure of phase `p`, scaled to roughly unit range.
- `net_θ` is a small neural network. Its **final layer is initialised to zero**, so at the start of training CHOWK behaves exactly like `mp-area`.
- Training then moves it away from the baseline only where that reduces delay.

Why: plain reinforcement learning on signal control often fails to beat max-pressure in the time available. A residual starts at the baseline, so the risk is removed, and the learned part is cleanly separable for explanation ("the classical rule said North; the network overrode it because a bus is waiting on East").

`β` is a trained scalar, initialised to 1.

### Observation (50 values per junction)

Approaches are **re-indexed so index 0 is the approach that currently has green**, then clockwise. This makes the policy symmetric across junction orientations and shareable across junctions. Missing approaches are zero-filled with `exists = 0`.

Per approach (10 values × 4):

| Feature | Scale |
|---|---|
| `areaNear`, `areaMid`, `areaFar` | 0–1 |
| `stoppedArea` | 0–1 |
| `people` | ÷ 100, clipped to 3 |
| `waitMax` | ÷ 120, clipped to 2 |
| `emergency` | 0 or 1 |
| `outArea` | 0–1 |
| `isGreen` | 0 or 1 |
| `exists` | 0 or 1 |

Per approach, from the upstream neighbour junction if there is one (2 values × 4): whether that neighbour is currently releasing traffic towards us, and for how long (÷ 60). This lets the policy anticipate platoons and coordinate along the corridor.

Global (2 values): elapsed green ÷ 60; whether the junction is in yellow or all-red.

### Network

`50 → 64 → 64 → 4`, **ReLU** activations, about 7,700 parameters.

ReLU is required, not a preference: inference must be bit-identical across browsers for the reproducible benchmark, and `tanh`/`exp` are not guaranteed identical between JavaScript engines. Inference is hand-written TypeScript using only add, multiply and max, in a fixed order, in double precision, from weights stored as 32-bit floats. No ONNX runtime, no tensor library.

### Action

Every 5 s, per junction: one of up to four phases. Choosing the current phase extends it.

### Objective

Minimise **person-delay per person** over the episode, as defined in `02-simulator.md`, with:

- an ambulance counted as 200 people for delay purposes (training only; reported metrics use real definitions);
- a penalty added for every second any approach waits beyond 150 s.

Episode fitness is expressed **relative to `mp-area` on the same seed and scenario**: `fitness = delay(policy) / delay(mp-area)`. Lower is better; 1.0 means equal to the baseline. This normalises across easy and hard scenarios and gives a directly readable training curve.

## Training

### Method: evolution strategies

OpenAI-style ES with antithetic sampling, rank-based fitness shaping and Adam.

Why ES rather than PPO:

- The simulator is TypeScript; ES needs only "run an episode, get a number", so there is no gradient tooling, no Python bridge, and no train/deploy mismatch.
- It parallelises trivially across CPU cores with `worker_threads`.
- It optimises the true episode objective directly, with no reward-shaping or credit-assignment tuning.
- With about 7,700 parameters it is well within ES's comfortable range.

PPO is a P2 stretch only, and only as an additional ablation row.

### Hyperparameters (starting point)

| Setting | Value |
|---|---|
| Population | 64 (32 antithetic pairs) |
| Noise σ | 0.05, decayed to 0.02 |
| Optimiser | Adam, learning rate 0.02, decayed |
| Episodes per candidate | 2, different scenarios, **same seeds for the whole generation** (common random numbers) |
| Episode | 300 s warm-up + 900 s measured |
| Generations | as many as the time allows; expect a few hundred overnight |
| Weight decay | 0.005 on network weights |

### Domain randomisation

Each generation draws its scenarios from:

- demand level: volume-to-capacity uniform in 0.6–1.1;
- vehicle mix: a random perturbation around the default mix, plus cars-only with 10% probability;
- directional split and cross-street share: randomised;
- events: surge (30% of episodes), blocked lane (20%), ambulance (50%);
- monsoon modifier (15%);
- sensor noise 0–10%.

Training uses the corridor network only.

### Seed discipline

Enforced in code, not by convention:

| Set | Seeds | Used for |
|---|---|---|
| Training | 0 – 99,999 | ES fitness |
| Validation | 500,000 – 500,019 | Choosing the checkpoint, tuning baseline hysteresis and any hyperparameter |
| Test (held-out) | 1,000,000 – 1,000,019 (and onward if more are needed) | The published benchmark only |

`@chowk/train` refuses to run on any seed outside the training and validation ranges. The benchmark CLI is the only code that touches test seeds. **Nothing is ever tuned on test seeds.** If a result on test seeds is disappointing, it is reported as is.

### Compute budget

Target simulator speed is at least 100x real time per core. One candidate evaluation is 2 × 1,200 simulated seconds. On 7 worker threads that is roughly 20 evaluations per minute at 100x, so a generation of 64 takes about 3 minutes and an 8-hour overnight run gives about 150 generations. At 300x it gives about 450. Measure the real figure on day one and resize the population or episode length to fit.

### Outputs

- `runs/<run-id>/log.jsonl`: per generation, mean and best fitness, validation fitness every 10 generations, σ, wall time.
- `runs/<run-id>/checkpoints/gen-XXXX.json`: weights (base64 float32), `β`, config hash, git commit, generation, validation fitness.
- The final model is the checkpoint with the **best validation fitness**, not the last one.
- Export to the web app: `apps/web/public/policies/chowk.json` plus the "watch it learn" checkpoints (generation 0, about 5, 20, 60 and final) and `training-curve.json`.

### Run plan

| Run | When | Purpose |
|---|---|---|
| Smoke | As soon as simulator and driver exist | 10 generations, tiny population; proves the pipeline end to end and that generation 0 equals `mp-area` exactly |
| Main | Overnight 13→14 Nov | Full run |
| Second | Overnight 14→15 Nov | Re-run with whatever the first taught us; only replaces the main model if validation is better |

### Runs completed

| Run | Simulator | Population | Generations | Selected | Validation fitness |
|---|---|---|---|---|---|
| `main` | Junction rules before 13 Nov | 24 | 20 | 20 | 0.9957 |
| `junction-v2` | Shared-box junctions (13 Nov) | 48 | 400 | 130 | 0.9816 |
| `ablation-v2-count` | Shared-box junctions | 24 | 150 | 10 | 0.9996 |
| `ablation-v2-pure` | Shared-box junctions | 24 | 150 | 5 | 1.0863 |
| `ablation-v2-solo` | Shared-box junctions | 24 | 150 | 120 | 0.9794 |
| `ablation-v2-vehicle` | Shared-box junctions | 24 | 150 | 120 | 0.9935 |
| `capacity-v1` | Capacity fix (12 Nov) | 48 | 20 of 250 (stopped) | — | 1.0698 at generation 20; unstable at σ = 0.005 |
| `capacity-v2` | Capacity fix (12 Nov) | 64, 4 episodes per candidate | 300 | 220 | 0.9386 |
| `capacity-v2-vehicle` | Capacity fix | 32, 4 episodes per candidate | 150 | 100 | 0.9453 |
| `capacity-v2-count` | Capacity fix | 32, 4 episodes per candidate | 150 | 70 | 1.1090 |
| `capacity-v2-pure` | Capacity fix | 32, 4 episodes per candidate | 150 | 20 | 3.9125 |
| `capacity-v2-solo` | Capacity fix | 32, 4 episodes per candidate | 150 | 10 | 0.9793 |

Runs up to `capacity-v1` used σ = 0.005 and a learning rate of 0.001, annealed over the run, with two episodes per candidate. After the capacity fix, queues are short and area-pressure differences small, so that noise swamped the max-pressure prior (validation worsened to 1.07 by generation 20). Following the failure rule below, `capacity-v2` used σ = 0.001, a learning rate of 0.0002 and four episodes per candidate. Validation fitness is mean delay relative to area max-pressure on the 20 validation seeds; below 1 is better. On the new simulator the earlier `main` policy scored 0.9914, so `junction-v2` replaced it. The ablations used half the population and fewer generations than the main run; the Results page notes that the variants use separate, shorter training runs.

### Failure handling

- If after the main run validation fitness is not below 1.0, CHOWK has not improved on `mp-area`. Ship the best checkpoint anyway, report the true number, and shift the pitch to the simulator, the lane-free finding (area versus counts), the live demo and the reproducible benchmark. Do not hide or soften the result.
- If training is unstable, lower σ and the learning rate and shorten episodes before changing anything structural.

## Ablations (trained variants)

Each is a separate, shorter training run, reported in `04-benchmark.md`. Priority order:

| Variant | Change | Shows | Priority |
|---|---|---|---|
| `chowk-vehicle` | Objective is vehicle-delay, not person-delay | What weighting by people buys buses and total person-delay | P1 |
| `chowk-count` | Observations and prior use vehicle counts instead of area | Whether area perception matters in mixed traffic | P1 |
| `chowk-pure` | No prior (`β = 0`), random initialisation | What the residual design buys | P1 |
| `chowk-solo` | No neighbour features | Whether corridor coordination is learned | P2 |

## Explanation, for the Decision overlay

`explain()` returns:

- `prior` and `learned` scores per phase, so the overlay can show the classical rule and the network's adjustment separately;
- a `reason` string built by occlusion: zero out each approach's feature group in turn, see which change moves the chosen phase's margin most, and name it using the largest raw feature in that group. Templates: "East: 64% of road occupied", "North: bus waiting, 43 people", "West: ambulance approaching", "South: waited 2 min", "Exit ahead is full, holding".

This is a cheap local explanation, described as such on the Method page; it is not a formal attribution method.
