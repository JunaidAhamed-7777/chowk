# Judging Synthesis

Four independent judges scored the eight candidates in [01-candidate-ideas.md](01-candidate-ideas.md), each through one lens. Full reports: [originality](judging/judge-1-originality.md), [technical](judging/judge-2-technical.md), [impact](judging/judge-3-impact.md), [visual](judging/judge-4-visual.md).

All scores are the judges' opinions. Each report lists which of its facts were checked by search and which are inference.

## Score matrix (1–10)

| Idea | Originality | Tech depth | Demo reliability | Impact | PS fit | Visual wow | Visual integrity | Premium look achievable | Person-days |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| **5 GREENWAVE** | 5.5 | 8 | 9 | 6 | 10 | 9 | 9 | 7 | 6 |
| 7 MULEHUNT | 4.5 | 7 | 9 | 7 | 10 | 7 | 7 | 8 | 4.5 |
| 6 DELUGE | 6.5 | 9 | 5 | 7 | 5 | 9 | 10 | 5 | 9 |
| 1 PULSE | 5 | 6 | 6 | 4 | 8 | 6 | 6 | 6 | 5 |
| 3 TERRA | 4 | 4 | 5 | 6 | 10 | 6 | 8 | 5 | 8+ |
| 2 FUNDUS | 3 | 5 | 9 | 6 | 10 | 5 | 3 | 7 | 3 |
| 4 KINETIC | 4 | 4 | 4 | 4 | 9 | 5 | 8 | 3 | 7+ |
| 8 ECHOGUARD | 3.5 | 5 | 3 | 7 | 10 | 4 | 3 | 6 | 7 |

Roughly 6 effective person-days are available (technical judge's assumption).

## Where each judge ranked the leaders

| Judge | 1st | 2nd | 3rd |
|---|---|---|---|
| Originality | DELUGE | GREENWAVE | PULSE |
| Technical | GREENWAVE | MULEHUNT | PULSE |
| Impact | MULEHUNT | ECHOGUARD | GREENWAVE |
| Visual | GREENWAVE | DELUGE | MULEHUNT |

GREENWAVE is the only idea in every judge's top three, and it is first on the two lenses we weight most (visual, and a demo that actually works).

## Stress test: why the others lose

- **DELUGE** has the highest ceiling (visual integrity 10, tech depth 9) but fails three independent tests: 9 person-days against 6 available; demo reliability 5 because free 30 m elevation data is a surface model that cannot resolve streets; PS fit 5 because flooding is not one of the named PS04 topics. A Devpost project already named "Deluge" does a WebGPU shallow-water flood on real terrain. Rejected.
- **MULEHUNT** is the safe runner-up: cheapest to build, reliable demo, best impact statistic (Rs 22,845 crore lost to cyber fraud in 2024). It loses on originality (FraudNets on Devfolio is a GNN mule detector with a three.js graph), the 3D position of nodes carries no meaning, and there is a real risk the GNN loses to XGBoost. RBI already ships "MuleHunter.AI", so the name is unusable. **Kept as the fallback.**
- **PULSE** puts its wow behind a camera permission, the arrhythmia flag cannot be validated on any public webcam dataset, and impact scored 4.
- **FUNDUS, TERRA, KINETIC, ECHOGUARD** each fail at least one hard requirement: most-recycled project type (FUNDUS, TERRA), LLM-wrapper core with unreliable free quota (KINETIC, which Gemini shipped natively in April 2026), or a demo that fails on a judge's own input (ECHOGUARD).

## Stress test: GREENWAVE's own kill shots

| Kill shot | Raised by | Answer built into the concept |
|---|---|---|
| "Textbook SUMO-RL project" (originality 5.5, then 5.0 in round 2) | Originality | Simulate lane-free, two-wheeler-dominated mixed traffic. Round 2 found this has been published (see below), so the claim becomes: the first version anyone can run and attack live in a browser, at corridor scale, citing that work. |
| "Fixed timers are a strawman baseline" | Impact | Report against Webster fixed-time **and** max-pressure, on held-out seeds, with confidence intervals. |
| "RL may not beat max-pressure" | Technical | Checkpoint at end of day 2. If plain RL is not ahead, switch to a learned residual on top of max-pressure, which cannot do worse than it. Report whatever the number is. |
| "Train sim and browser sim will diverge" | Technical | One TypeScript simulator, run headless in Node for training and in the browser for the demo. |
| "Importing real OSM junctions eats the schedule" | Technical | Cut it. Hand-author one corridor modelled on a real Bengaluru stretch, and describe it as modelled-on, not a replica. |
| "Sim-to-real" | Impact | State plainly that results are simulation results; calibrate vehicle mix and sizes to published Indian mixed-traffic figures. |
| "Daylight boxes on strips, clipping cars" | Visual | Night scene, emissive head/tail lights with bloom, instanced vehicles, Blender-built vehicle and building kit, no vehicle overlap in the sim by construction. |
| "Looks like a canned video" | Technical (general) | The policy runs live in the browser; the judge can inject a surge, block a lane or send an ambulance and watch it adapt. |

## Round 2: AQUIFER versus GREENWAVE

The originality judge proposed **AQUIFER** (a see-through 3D twin of a village's shared groundwater, with a cooperative pumping optimizer), estimating 7.5 on originality. It was written up in [04-aquifer-concept.md](04-aquifer-concept.md) and scored by four fresh judges on the same scales as GREENWAVE. Reports: [originality](judging/round2-originality.md), [technical](judging/round2-technical.md), [impact](judging/round2-impact.md), [visual](judging/round2-visual.md).

| Lens | AQUIFER | GREENWAVE | Winner |
|---|:-:|:-:|---|
| Originality | 6.5 | 5.0 | AQUIFER |
| Technical depth | 7 | 8 | GREENWAVE |
| Demo reliability | 8 | 9 | GREENWAVE |
| Person-days (about 6 available) | 7.5 (6.5 after cuts) | 6 | GREENWAVE |
| Impact | 6 | 6 | tie |
| PS fit | 7 (8 if reframed) | 10 | GREENWAVE |
| Visual wow / integrity / achievable | 7 / 9 / 6 | 9 / 9 / 7 | GREENWAVE |

**What round 2 found against AQUIFER**

- No village-scale well data is public. The national observation network is about one well per 140 km², behind a sign-in, and private borewell locations are not published. The village would have a real outline and a synthetic well layout.
- The three parts do not share data: district-scale forecast, synthetic-village simulator, and an optimizer that reduces to "grow less paddy" unless built with care.
- The see-through subsurface look has no live web precedent the visual judge could find, and it is on the critical path.
- Groundwater commons games already exist in software (MARVI, FES/IFPRI, a Punjab agent-based model) and a hackathon entry from October 2026 built a 2D aquifer twin for Indian borewells. Round 1's "no software version" was wrong.
- "Smart irrigation" is a stretch for village groundwater governance, and evidence that groundwater budgeting programmes change water levels is weak.

**What round 2 found against GREENWAVE**

- The lane-free twist is published: Nandakumar, Banerjee and Vanajakshi, [arXiv 2509.21745](https://arxiv.org/abs/2509.21745) (2025), apply PPO signal control to a laneless heterogeneous intersection in SUMO and report a larger gain over Webster on laneless traffic than on lane-based. C-DAC's CoSiCoSt, built for lane-free traffic, already runs Bengaluru's adaptive signals.
- What survives as new: a browser-native lane-free simulator with the policy running live, which a judge can attack. Extending from one intersection to a coordinated corridor may also be new; that was not searched.

**PASSAGE** (wildlife-crossing placement) was not evaluated further.

## Verdict

**Build GREENWAVE.** It wins or ties six of seven rows and leads on the two things we weight most: visual power and a demo that works on first click. AQUIFER is more original by 1.5 points but is over budget, weaker on fit, and depends on a look nobody has shown working on the web.

GREENWAVE's originality (5.0) is its weak point, and no concept guarantees a podium. The entry must cite the 2025 paper as the work it builds on rather than claim the twist as its own, and compete on being live, playable and visually far ahead of the field. See [03-final-concept.md](03-final-concept.md).

Switch condition (technical judge): if RL is not beating max-pressure and the residual controller also fails, AQUIFER's optimizer has a provable optimum and does not depend on training converging.
