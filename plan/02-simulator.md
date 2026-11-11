# 02 — The Simulator

A deterministic, lane-free, mixed-traffic micro-simulator in TypeScript. One package, `@chowk/sim`, with zero runtime dependencies, used unchanged by training (Node), the benchmark (Node and browser workers) and the live demo (browser workers).

Numbers marked **(default)** are starting values chosen to be plausible. They are not field-calibrated. The implementing agent should look for a citable source (for example the Indian Highway Capacity Manual, Indo-HCM, CSIR-CRRI 2017) and either confirm, replace, or leave the value labelled as an assumption in the Method page. Never present a default as measured.

## Design principles

1. **Deterministic.** The same config and seed produce bit-identical state in Node and in every browser.
2. **Collision-free by construction.** No two vehicles ever overlap. This is an invariant checked in tests, not something patched up visually.
3. **Lane-free.** Lateral position is a first-class state. Filtering and width-sharing emerge from the rules.
4. **Fast.** Headless, at least 100x real time with 1,500 vehicles on one core; target 300x.
5. **Small surface.** A handful of functions; everything else is internal.

## Conventions

- SI units: metres, seconds, m/s.
- **Left-hand traffic** (India). Vehicles keep left; the kerb is on the left of the direction of travel, the median on the right.
- Fixed timestep `dt = 0.25 s`. Controllers act every `5 s` (20 ticks).
- Longitudinal position `s` is the distance of the vehicle's **front** from the start of its link.
- World frame: `x` east, `z` south, `y` up, matching three.js with the corridor along `x`.

## Determinism rules

- No `Math.random`, `Date`, `performance.now` or iteration over object keys or `Map`/`Set` insertion order anywhere in the package.
- Own PRNG (`mulberry32` or `xoshiro128**`), with **separate streams** derived from the seed: `demand`, `behaviour`, `events`.
- In state updates use only `+ − × ÷`, `Math.sqrt`, `Math.min`, `Math.max`, `Math.abs`, `Math.floor`. No `Math.pow`, `exp`, `sin`, `cos`, `atan2`: their results may differ between engines. Powers are written as multiplications. Directions are precomputed unit vectors stored in the network.
- All loops run in a fixed order: links by id, vehicles within a link by descending `s`, ties broken by vehicle id.
- `sim.hash()` returns an FNV-1a hash of quantised state (positions to 1 mm, speeds to 1 mm/s, signal states, counters). Tests compare hashes across Node and headless browsers.

## Network model

Static, loaded from JSON (`networks/*.json`).

```ts
interface Network {
  id: string;
  stripWidth: number;            // 0.5 m
  nodes: Node[];                 // junctions, sources, sinks
  links: Link[];                 // directed road segments
  connectors: Connector[];       // paths through a junction
  junctions: Junction[];
  sources: Source[];             // where demand enters
  routes: Route[];               // precomputed link sequences per origin-destination pair
}
interface Link {
  id: number; from: number; to: number;
  length: number;                // m
  strips: number;                // width / stripWidth
  speedLimit: number;            // m/s
  origin: [number, number];      // world x,z of link start, left edge
  dir: [number, number];         // unit vector along travel
  left: [number, number];        // unit vector towards the kerb side
}
interface Connector {             // short link inside a junction
  id: number; junction: number;
  fromLink: number; toLink: number;
  movement: 'left' | 'through' | 'right';
  length: number; strips: number;
  path: [number, number][];      // polyline for rendering and position lookup
}
interface Junction {
  id: number; node: number;
  approaches: number[];          // incoming link ids, clockwise from north
  phases: Phase[];               // each phase lists approaches with green
  minGreen: number; yellow: number; allRed: number; maxGreen: number;
}
```

### Signal phasing

**Approach-based (split) phasing:** each phase gives green to every movement from one approach. A four-arm junction has four phases; a T-junction has three. This is a common arrangement at Indian junctions and it suits lane-free traffic, because vehicles for different movements share the same width and cannot be held separately. State it as a modelling choice on the Method page. Paired opposing-through phases are out of scope.

Timing **(default)**: minimum green 10 s, yellow 3 s, all-red 2 s, maximum green 60 s.

The simulator owns the signal state machine. A controller only *requests* a phase:

```
GREEN(p) --request q≠p and elapsed ≥ minGreen--> YELLOW(p) --3 s--> ALL_RED --2 s--> GREEN(q)
```

Requests made before minimum green are ignored. If green reaches `maxGreen`, the simulator forces a switch to the phase requested, or the next in cycle if none.

### The corridor (`networks/corridor.json`)

An east–west arterial with five signalised junctions J1…J5 and north–south cross streets. Authored, modelled on a typical Indian urban arterial; not a survey of a real place.

| Element | Value **(default)** |
|---|---|
| Arterial carriageway, each direction | 10.5 m = 21 strips |
| Major cross street (J3), each direction | 7.0 m = 14 strips |
| Minor cross streets (J1, J2, J4), each direction | 5.5 m = 11 strips |
| J5 | T-junction, cross street from the south only |
| Spacing J1–J2–J3–J4–J5 | 420, 380, 550, 460 m |
| Entry and exit stubs | 300 m |
| Speed limit | arterial 50 km/h, cross streets 40 km/h |

Irregular spacing is deliberate: it prevents a single fixed offset from producing a perfect green wave for the baseline by accident, and it looks more natural.

### The held-out network (`networks/grid-holdout.json`)

A 2×2 grid of four-arm junctions with different widths and spacings from the corridor. **Never used in training.** Used only in the generalisation test in `04-benchmark.md`.

## Vehicle classes

| Class | Length m | Width m | Strips | Desired speed km/h | Max accel m/s² | Comfort decel m/s² | Time headway s | Standstill gap m | Occupancy | Fuel |
|---|---|---|---|---|---|---|---|---|---|---|
| Two-wheeler | 1.9 | 0.7 | 2 | 50 | 2.5 | 3.0 | 0.8 | 0.5 | 1.3 | petrol |
| Auto-rickshaw | 3.2 | 1.4 | 3 | 40 | 1.2 | 2.5 | 1.2 | 1.0 | 2.2 | CNG |
| Car | 4.2 | 1.7 | 4 | 50 | 1.8 | 3.0 | 1.2 | 1.5 | 1.6 | petrol |
| Light commercial | 5.5 | 2.0 | 4 | 45 | 1.2 | 2.5 | 1.4 | 1.5 | 1.5 | diesel |
| Bus | 11.0 | 2.5 | 5 | 40 | 0.9 | 2.0 | 1.6 | 2.0 | 40 | diesel |
| Ambulance | 5.5 | 2.0 | 4 | 60 | 1.8 | 3.0 | 1.0 | 1.5 | — | diesel |

All values are **(default)**. Each vehicle's desired speed is multiplied by a factor drawn uniformly from 0.9–1.1 at spawn (from the `demand` stream) so platoons are not uniform.

Default mix for "Indian mixed traffic" **(default)**: two-wheeler 50%, car 28%, auto-rickshaw 12%, light commercial 5%, bus 5%.

## Vehicle state

Struct-of-arrays in typed arrays, capacity 4,096, with a free list.

| Field | Meaning |
|---|---|
| `link` | Current link or connector id |
| `s` | Front position along the link |
| `strip` | Index of the leftmost strip occupied |
| `lat` | Rendered lateral offset, eased towards `strip` (visual only, not used in dynamics) |
| `v`, `a` | Speed, acceleration |
| `cls` | Class |
| `route`, `routeIdx` | Route id and position in it |
| `v0` | Desired speed |
| `occ` | Occupancy |
| `tEnter` | Time entered the network |
| `delay` | Accumulated delay, seconds |
| `stops` | Number of full stops |
| `moving` | Flag used for stop counting |
| `lastShift` | Time of last lateral move |

Each link keeps its vehicles in an array sorted by descending `s`.

## Dynamics, per tick

Order of operations each tick:

1. Advance signal state machines.
2. Spawn from the demand list where there is room; otherwise the arrival waits in that source's backlog.
3. For every link in id order, every vehicle front to back: compute acceleration.
4. Lateral decisions for vehicles due one this tick.
5. Integrate positions and speeds.
6. Handle link transitions (link → connector → link), removals at sinks.
7. Update metrics.

### Longitudinal: Intelligent Driver Model against the constraining leader

For vehicle `i` the **leader** is the nearest thing ahead that overlaps any strip `i` occupies:

- another vehicle on the same link;
- the first vehicle on the next link or connector of its route, if within lookahead (mapped to strips there);
- a **virtual stopped obstacle at the stop line** if its approach does not have green, or has yellow and it can stop within its comfortable deceleration;
- a virtual obstacle at the stop line if the junction exit it needs has no room (**do not block the box**);
- a static obstacle (blocked-lane event).

Lookahead: 100 m.

IDM acceleration, with gap `g` to the leader's rear, own speed `v`, approach rate `Δv = v − v_leader`:

```
s* = s0 + max(0, v·T + v·Δv / (2·sqrt(a_max·b)))
a  = a_max · ( 1 − (v/v0)^4 − (s*/g)^2 )
```

`(v/v0)^4` is computed by squaring twice. Clamp `a` to `[−9, a_max]`. Integrate with `v ← max(0, v + a·dt)`, `s ← s + v·dt`. After integration, enforce the invariant: if the gap to the leader would be below zero, place the vehicle at zero gap and set `v` to the leader's speed. This backstop should fire rarely; count how often and expose the counter in tests.

### Lateral: strip changes

Each vehicle considers a lateral move at most once per `τ` seconds, staggered by vehicle id. `τ` **(default)**: two-wheeler 0.5 s, auto-rickshaw 0.75 s, car and light commercial 1.0 s, bus 2.0 s.

For candidate shifts of −1 and +1 strip:

1. **Feasible** if the target strips are inside the road and empty over `[s − length − g_rear, s + g_front]`, where `g_front = s0` and `g_rear` is enough that the follower in the target strips would not need to brake harder than 2 m/s² (IDM evaluated for that follower).
2. **Utility** = IDM acceleration in the new position − IDM acceleration in the current position + bias.
3. Move to the feasible candidate with the highest utility if it exceeds the class threshold **(default)**: two-wheeler 0.1, auto-rickshaw 0.2, car 0.3, light commercial 0.4, bus 0.6 m/s².

Bias terms:

- **Turn bias:** within 150 m of a junction, vehicles turning left are biased towards the kerb, vehicles turning right towards the median, by 0.3 m/s² per decision.
- **Keep-left bias:** buses and light commercial vehicles get a weak kerb-side bias (0.05).
- **Yield to emergency:** if an ambulance is within 60 m behind and overlaps your strips, bias away from it by 1.0.

The move is instantaneous in the dynamics. For rendering, `lat` eases towards the new strip at 1.5 m/s.

**Filtering is not coded as a special case.** A two-wheeler behind a stopped car sees zero acceleration where it is and positive acceleration in an adjacent free pair of strips, so it moves and advances. Narrow vehicles therefore accumulate at the front of queues. This emergent behaviour is one of the validation checks.

### Junctions

- A vehicle crossing the stop line enters the connector for its movement. Its strip is mapped proportionally to the connector's width, then again to the exit link's width.
- Inside a connector, vehicles follow only vehicles on the same connector and the first vehicle on the exit link.
- Because phasing is approach-based and all-red clears the box, connectors from different approaches are never occupied at the same time. A test asserts this.
- A vehicle may enter the junction only if the exit link has room for it in its mapped strips.

### Yellow

On yellow, a vehicle stops if it can do so at or below its comfortable deceleration; otherwise it proceeds.

## Demand

Demand is **generated ahead of time** from the seed, independent of simulation state, so two simulations with different controllers receive identical arrivals.

```ts
interface Arrival { t: number; source: number; cls: number; route: number; v0Factor: number; strip: number; }
function generateDemand(network, scenario, seed): Arrival[]
```

- Arrivals per source follow a Poisson process with a piecewise-linear rate profile from the scenario.
- Generate arrivals by inverting the integral of each rate segment. A fixed log series samples the exponential hazard between arrivals using only deterministic arithmetic.
- Class is drawn from the scenario's mix; route from the scenario's origin–destination shares.
- At spawn, the vehicle is placed at `s = length` of vehicle on its source link with speed equal to the slower of its desired speed and a safe speed for the gap ahead. If its preferred strips are blocked it tries the others in a fixed order; if none fit, it stays in the **backlog** and is retried each tick. Backlogged vehicles accrue delay.

Scenario demand levels are defined **relative to measured capacity**, not as raw numbers: a calibration script measures saturation flow at each approach in this simulator, and scenarios specify a volume-to-capacity ratio. See `04-benchmark.md`.

## Events

Injected with `sim.inject(event)`; all take effect at the next tick.

| Event | Effect |
|---|---|
| `surge` | Multiplies one source's arrival rate for a duration. Implemented by merging a pre-generated extra arrival list, seeded from the `events` stream, so twin simulations stay identical. |
| `block` | Places a static obstacle over a strip range and `s` range on a link for a duration. |
| `ambulance` | Inserts an ambulance arrival at a source with a given route. |
| `sensorFreeze` | Observations for one junction stop updating for a duration. |
| `outage` | One junction's signals go to all-red; vehicles treat the stop line as a four-way stop (enter if the box is empty and they have waited 2 s). P2. |

## Scenario modifiers

- **Monsoon:** desired speed ×0.8, max acceleration ×0.8, time headway ×1.2.
- **Lane-disciplined cars only:** mix is 100% cars; lateral moves are restricted to whole-lane changes (7 strips at a time) with car thresholds. This is the contrast case used to show how lane-free traffic differs.

## Observation interface

The simulator exposes raw sensing; controllers build their own features from it (see `03-controllers-and-training.md`).

```ts
interface ApproachSense {
  areaNear: number;      // fraction of road area occupied, 0–60 m from stop line
  areaMid: number;       // 60–150 m
  areaFar: number;       // 150–300 m (or to link start)
  stoppedArea: number;   // fraction occupied by vehicles under 1 m/s, 0–150 m
  count: number;         // vehicles within 150 m
  people: number;        // sum of occupancy within 150 m
  waitMax: number;       // longest current wait at this approach, s
  emergency: number;     // 1 if an ambulance is within 300 m on this approach
  outArea: number;       // mean occupied fraction of the first 60 m of the exit links this approach feeds
}
sim.sense(junctionId): { approaches: ApproachSense[]; phase: number; state: 'green'|'yellow'|'allRed'; elapsed: number }
```

Optional Gaussian noise and dropout can be applied to these values (seeded, from the `events` stream) for the robustness tests.

## Metrics

Uncensored by construction: delay accrues every tick for every vehicle in the network or the backlog, so a controller cannot look good by gridlocking vehicles that never finish.

| Metric | Definition |
|---|---|
| Person-delay | `Σ over ticks, over vehicles i in network or backlog: occ_i · dt · (1 − v_i / v0_i)`; backlog vehicles count as `v = 0` |
| Vehicle-delay | The same without `occ_i` |
| Delay per person | Person-delay ÷ people generated in the measurement window |
| Stops per vehicle | A stop is counted when speed falls below 0.5 m/s after having exceeded 2 m/s; total ÷ vehicles generated |
| Throughput | People reaching a sink per hour |
| Mean travel time | Over completed trips, reported with the completion rate |
| Queue area | Time-mean of stopped area summed over approaches |
| Fuel and CO2 | See below |
| Ambulance travel time | Entry to exit, per ambulance |
| Backlog | Time-mean and maximum vehicles waiting to enter |

`sim.metrics()` returns cumulative totals; callers difference them to get windows.

### Fuel and CO2 estimate

A simple instantaneous model per vehicle: `fuel rate = idle_c + k1_c · v + k2_c · v · max(0, a)`, with per-class coefficients, converted to CO2 with a per-fuel emission factor. The coefficients are **(default)** and must be sourced or clearly labelled as illustrative; the Limits page says the figure is an estimate. The relative difference between controllers is what matters, and it is driven mostly by idling and stop-start, which the model captures.

## Public API

```ts
function createSim(cfg: {
  network: Network;
  scenario: Scenario;
  seed: number;
  demand?: Arrival[];        // if omitted, generated from scenario and seed
}): Sim;

interface Sim {
  readonly time: number;
  step(n?: number): void;                          // advance n ticks
  requestPhase(junctionId: number, phase: number): void;
  sense(junctionId: number): JunctionSense;
  inject(e: SimEvent): void;
  metrics(): Metrics;
  writeSnapshot(out: Float32Array): number;        // render state; returns vehicle count
  signals(): Uint8Array;                           // per junction: phase, state
  hash(): number;
  clone(): Sim;                                    // deep copy, for look-ahead and tests
}
```

Snapshot layout, 8 floats per vehicle: `x, z, dirX, dirZ, speed, class, id, flags` (flags: braking, stopped, emergency). World position comes from the link's `origin`, `dir`, `left`, and the eased lateral offset. On connectors, position is interpolated along the polyline.

## Validation checks

These run as tests and their plots appear on the Method page. They show the simulator behaves like traffic; they are not a calibration to a real road.

| Check | Expectation |
|---|---|
| Conservation | Generated = completed + in network + backlog, at every tick |
| No overlap | No two vehicles' rectangles intersect, ever, over long random runs |
| Junction exclusivity | Connectors of different approaches are never occupied simultaneously |
| Determinism | Same seed gives the same hash after 10,000 ticks, in Node and in headless Chromium, Firefox and WebKit |
| Twin demand | Two simulations with different controllers generate identical arrivals |
| Fundamental diagram | On a single long link, flow versus density rises, peaks and falls; cars-only capacity lands in a plausible range for IDM with these parameters |
| Saturation flow | Discharge rate at a stop line stabilises after start-up loss; mixed traffic discharges more vehicles but a comparable area per second |
| Filtering | In mixed-traffic queues, the share of two-wheelers in the front 10 m is clearly above their share in the mix |
| Backstop rate | The overlap backstop fires in fewer than 1 in 10⁵ vehicle-ticks |

## Performance notes

- Typed arrays, no allocation inside `step`.
- Leader search scans the link's sorted array forward from the vehicle's index; stop at lookahead.
- Per-link occupancy bitmap by coarse cell (strip × 2 m) to make lateral feasibility checks cheap.
- Benchmark script `npm run sim:bench` reports ticks per second at 500, 1,500 and 3,000 vehicles; it must not regress.
