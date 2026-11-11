# Round 2 — Technical Implementation Review: AQUIFER vs GREENWAVE

Lens: depth, correctness, and whether it can be built and work reliably by 15 Nov 23:55 IST. Nothing else. Same scale as [judge-2-technical.md](judge-2-technical.md), where GREENWAVE scored depth 8, demo 9, 6 person-days.

**Evidence tags.** `[V]` = checked by web search on 12 Nov 2026 (link given). `[I]` = my inference, arithmetic or recollection, not checked. Search results were read as listings and snippets; I could not open the actual download files (the India Data Portal page returned 403 to my fetcher, the CGWB data-access page failed on its TLS certificate). Treat "downloadable" as "listed as downloadable" until someone on the team has the CSV on disk.

## Summary

| | AQUIFER | GREENWAVE |
|---|:---:|:---:|
| Depth a judge reading the repo would credit | **7** | 8 |
| Probability the demo works flawlessly on first click | **8** | 9 |
| Person-days, honest version | **7.5 uncut, 6.5 after cuts** | 6 |
| Biggest breakage risk | No village-scale data, so the "real village" and the forecast are disconnected from the simulator; the AI core collapses into a trivial LP unless built carefully | Sim parity; RL not beating max-pressure |

**Verdict: GREENWAVE on technical grounds.** AQUIFER is buildable and its physics can be validated better than GREENWAVE's, but it is three subsystems that do not share data, its learned component is the weakest part, and it costs more for a lower score on both axes.

---

## 1. Data

### What exists

- **CGWB / India-WRIS observation wells, mirrored on India Data Portal.** Listed as a network of 22,965 observation wells, measured four times a year (January, March/April/May, August, November), records back to 1969, with station, state, district, basin, latitude, longitude and depth to water level; CSV of about 75 MiB, last updated 6 Sep 2024; one listing gives the licence as Open Data Commons Attribution, another says no licence specified `[V]` ([IDP listing](https://ckandev.indiadataportal.com/dataset/groundwater/resource/580a8f6e-3d86-4ca7-ac7d-cd5df12b443c), [IDP dataset](https://ckandev.indiadataportal.com/dataset/8ff1419c-89d0-4be0-bf2a-25d2822b8006)).
- **Wider India-WRIS extract.** Another listing cites around 54,000 stations including telemetric (high-frequency) ones, covering 1965-2025, with well depth among the fields `[V]` ([IDP manual-readings listing](https://ckandev.indiadataportal.com/dataset/groundwater-level/resource/06d6e79c-61ac-46bb-9e03-c7138911c619)). The well counts across listings disagree (22,965 / ~25,000 / ~54,000); do not quote one without checking the file.
- **Registration.** India Data Portal redirects to a sign-in page before download and then asks for a purpose-of-download form `[V]` ([IDP docs](https://docs.indiadataportal.com/how-to/download-a-dataset)). That is trivial registration, not none. Whether India-WRIS itself (`indiawris.gov.in/wris/#/groundWater`) allows anonymous bulk export was **not** confirmed; my recollection is a state/district picker with per-query export that is slow and sometimes down `[I]`.
- **Atal Bhujal Yojana.** The MIS hosts block-level hydrogeological report PDFs whose annexures list observation wells with gram panchayat names, coordinates and historical water levels `[V]` ([example report](https://ataljal.hid.gov.in/MIS/data/HydrogeologicalReport/Report_638733116859309656.pdf)). The programme guideline calls for about ten monitoring wells per gram panchayat across 8,203 panchayats `[V]` ([India Water Portal](https://www.indiawaterportal.org/groundwater/atal-bhujal-yojana-atal-jal-managing-indias-groundwater-for-the-future-2)), so panchayat-scale series exist, but I found no bulk download; it is PDF tables. This is the only public source at anything near village scale, and it means PDF table extraction.
- **Other.** A UK-hosted dataset of Punjab/Haryana wells (pre- and post-monsoon, irregular coverage) `[V]` ([data.gov.uk](https://ckan.publishing.service.gov.uk/dataset/03339fce-3ab1-413e-a237-69583c21e50a)). No Kaggle or Zenodo mirror surfaced in search; I would not plan on one.

### What it means

- **Resolution.** Four readings a year, so a 30-year well has at most ~120 points, fewer with gaps `[I]`.
- **Density.** ~23,000 wells over 3.29 million km2 is one well per ~140 km2, roughly one per 25-30 villages `[I: arithmetic]`. There is no village in India with enough CGWB wells to draw a water-table surface from data.
- **Datum trap.** Values are depth below ground level, so comparing wells or building a surface needs ground elevation at each well `[V]` ([datameet thread](https://groups.google.com/g/datameet/c/D9FHumhoufc)). A 30 m DEM has metre-scale error, comparable to the seasonal signal `[I]`.
- **Private borewells.** Locations, depths and pumping rates of farmers' wells are not public anywhere `[I]`. The concept's "real well locations" is not deliverable.

### Honest fallback

1. Pick one stressed block that has both CGWB wells and an Atal Jal block report (Maharashtra, Karnataka, Rajasthan, Gujarat, Haryana, MP, UP are the seven states). Use the district/block CGWB series to calibrate two numbers: specific yield times recharge (monsoon rise per mm of rain) and net dry-season decline.
2. Take a real village boundary and field pattern from OSM or satellite tracing for the surface, and place wells synthetically at a density taken from the Minor Irrigation Census or the block report.
3. Say it in the first paragraph of the README: "real hydrograph, real village outline, synthetic well layout". Calling it "a real village's wells" is the kind of claim that loses a technical judge.

**Step zero tonight:** one person signs in and downloads the CSV. If that takes more than an hour, the forecast module is dead and so is the "public records" claim.

---

## 2. Physics

### Model choice

- **Bucket model** (one storage, `Sy * A * dh/dt = R - sum(Q)`): correct for the village-average trend, shows no cones. Too thin alone, but it is what actually determines "years until wells fail" in a closed domain. A hydrogeologist will notice that the headline number is bucket arithmetic and the 2D model only redistributes it `[I]`.
- **Theis superposition:** analytic, exact for a confined (linear) aquifer, no grid. Cannot handle boundaries, spatially varying recharge or drying without image wells. Use it as a test oracle, not as the model.
- **2D Boussinesq, finite difference** (`Sy * dh/dt = div(K h grad h) + R - Q`): the right choice. Around 150 lines. Defensible as "single-layer unconfined, Dupuit assumption", which is exactly what MODFLOW does for one convertible layer.

### Traps

- **Explicit timestep.** FTCS is stable only for `dt <= Sy * dx^2 / (4 T)`. With Sy = 0.02, T = 100 m2/day, dx = 20 m that is 0.02 days: about 18,000 steps per simulated year `[I: arithmetic]`. Fine for a 64x64 animation, far too slow as an optimizer inner loop over 20 years. Either coarsen (64x64 at 25-30 m, T <= 30 m2/day gives ~0.15-day steps) or go implicit (backward Euler with Jacobi/CG, or ADI), which is unconditionally stable but another half day and another place for bugs.
- **Well-cell head is not well head.** The grid cell averages the cone. Drawdown in the bore needs a Thiem/Peaceman correction, `s_well = s_cell + Q / (2 pi T) * ln(0.208 dx / r_w)` `[I]`. Without it wells "survive" years too long, and the dry-well count, which is the headline, is wrong.
- **Drying.** When saturated thickness approaches zero, a fixed Q drives head negative and the solver blows up or creates water. Pumping must taper with saturated thickness and the taper must be in the mass balance.
- **Boundaries.** No-flow all round is a bathtub that only ever empties; fixed-head is an infinite reservoir that makes the commons problem vanish. Neither is right; a general-head boundary with a stated conductance is the least bad, and the result is sensitive to it. State that.
- **Parameters span orders of magnitude.** Measured transmissivity in Indian hard rock: 68-2,239 m2/day in Aravalli granite/gneiss `[V]` ([Appl Water Sci 2016](https://link.springer.com/doi/10.1007/s13201-016-0462-8)); 0.1-500 for Deccan basalt in Maharashtra `[V]` ([IGU journal](https://iguonline.in/journal/Archives/18-4/6-paper.pdf)). Specific yield in granitic gneiss is highly variable, sometimes only just above 1% `[V]` ([EGU22-9975](https://meetingorganizer.copernicus.org/EGU22/EGU22-9975.html)). From memory: hard rock Sy 0.01-0.03, alluvium 0.08-0.2, alluvial T 500-5,000 m2/day, rainfall infiltration factor roughly 5-12% in hard rock and 20-25% in alluvium `[I]`. The GEC 2015 norm tables exist in CGWB's methodology document `[V]` ([CGWB PDF](https://www.cgwb.gov.in/cgwbpnm/public/uploads/documents/174823942869654426file.pdf), tables 2.1 and 2.2) but I did not retrieve the values; read them before hard-coding anything.
- **Cones are small.** For Q = 100 m3/day and T = 50 m2/day, `Q / (2 pi T)` is 0.3 m per log-unit of radius, so about 1 m of drawdown at grid-cell scale `[I: arithmetic]`. The dramatic funnels in the pitch need 10-20x vertical exaggeration or an unrealistically low T. Label the exaggeration on screen.
- **Hard rock.** Borewells in peninsular India draw from fractures at 60-300 m, not from a smooth water table `[I]`. The concept already scopes this out; choosing an alluvial or weathered-zone setting (north Gujarat, Punjab/Haryana, or dug wells in the weathered layer) makes the physics honest instead of merely disclaimed.

### Validation

FloPy ships a MODFLOW 6 tutorial for exactly this case, an unconfined single-model flow problem with a pumping well `[V]` ([FloPy tutorial](https://flopy.readthedocs.io/en/latest/Notebooks/mf6_tutorial01.html)), and the MODFLOW 6 examples include unconfined radial drawdown `[V]` ([ex-gwf-radial](https://modflow6-examples.readthedocs.io/en/latest/_notebooks/ex-gwf-radial.html)). FloPy has a `get-modflow` helper that fetches the Windows executable `[I]`.

Plan: (1) mass-balance unit test, (2) single well versus Theis with small drawdown, (3) three wells plus seasonal recharge versus MODFLOW 6 on the same grid, report head RMSE in centimetres. **Half a day**, and it is the best credibility-per-hour item in the project. GREENWAVE has no equivalent external oracle.

---

## 3. AI core

### Forecast

- With ~4 readings a year the signal is trend plus a seasonal cycle driven by monsoon rain. A per-well LSTM on ~100 points is not credible. The defensible model is a **pooled** gradient-boosted regressor across thousands of wells: lagged levels, same-season-last-year, cumulative rainfall (Open-Meteo archive or CHIRPS), latitude/longitude, aquifer type.
- Baselines that must be in the table: persistence (last reading), seasonal-naive (same season last year), and seasonal-naive plus linear trend. The last one is strong; expect ML to gain 10-25% RMSE at best, and possibly nothing `[I]`. I found plenty of Indian groundwater ML papers but none in the search results that reports skill against a persistence baseline `[V: absence in results]` ([example](https://arxiv.org/pdf/1912.05934)), which tells you how soft this literature is, and that an honest table is a small differentiator.
- Split by well (spatial hold-out) **and** by time. A random row split leaks.
- **Structural problem:** the forecast is district-scale and the simulator is village-scale. Nothing learned in the forecast feeds the twin unless you make it: use the fitted rise-per-mm and decline rates to set Sy and recharge in the simulator. Without that link, a reader sees a Kaggle notebook stapled to a WebGL demo.

### Optimizer

- The naive formulation (choose crop areas to maximise income subject to a village water budget) is a five-variable LP whose answer is "grow less paddy and sugarcane". That is thin and a judge will see it.
- The formulation that earns credit is the **response-matrix method**: linearise the aquifer, run one unit-pumping simulation per well to get drawdown coefficients, then drawdown at well i in period t is a linear function of everyone's pumping. Constraint: head at each well stays above its pump depth. Variables: crop area per farm per season. That is an LP/MILP with a few thousand variables, standard in groundwater management since the 1980s `[I]`, and it uses the simulator rather than sitting beside it.
- **Baseline matters as much as the optimum.** "Business as usual" should be a Nash/best-response equilibrium: each farm maximises its own income given the others' pumping, iterate to a fixed point. Then also report two dumb policies, uniform x% pumping cut and a paddy ban. Beating BAU is guaranteed by construction; beating the uniform cut is the result that means something.
- **In the browser:** HiGHS compiled to WebAssembly is on npm as `highs`, MIT licence, supports MILP `[V]` ([npm](https://npmjs.com/package/highs), [repo](https://github.com/lovasoa/highs-js)). glpk.js also works but is GPL-3.0 `[V]` ([npm](https://www.npmjs.com/package/glpk.js)). A few thousand continuous variables should solve in well under a second `[I]`. Ship a precomputed plan for the default scenario and solve live only after the judge edits something.
- RL and evolutionary search are the wrong tools: the problem is near-linear and an LP gives a provable optimum. Differentiable simulation is elegant but JS has no autodiff, so it would be offline PyTorch and precomputed, which loses the interactivity.

### Is it real AI?

Honestly: the optimizer is operations research and the simulator is physics. The only learned model is the forecast, and it is the weakest and least connected piece. Against a rubric that asks for an "AI core", GREENWAVE's trained policy is a cleaner answer. What makes AQUIFER's core strong in 3.5 days:

1. Forecast table with three baselines, spatial and temporal hold-out, committed notebook.
2. Forecast-derived parameters calibrating the simulator (the link).
3. Response-matrix LP validated by re-running the plan through the nonlinear simulator and reporting the linearisation error.
4. Nash BAU versus cooperative optimum versus uniform cut, over 20 rainfall sequences.

Drop any one of 2-4 and depth falls to 6.

---

## 4. Rendering

- **Do not use `MeshPhysicalMaterial` transmission** for the glass earth. It renders the scene to an extra buffer and is the first thing to halve frame rate on integrated graphics at high device pixel ratio `[I]`.
- **Sorting.** three.js sorts transparent objects back to front per object and has no built-in order-independent transparency; the standard advice is `depthWrite: false` on transparent materials, and objects can flip order as the camera moves `[V]` ([three.js forum](https://discourse.threejs.org/t/threejs-and-the-transparent-problem/11553), [OIT thread](https://discourse.threejs.org/t/order-independent-transparency-oit/56765)). Avoid the problem rather than solve it: at most three transparent layers (earth shell, water surface, cone glow) with explicit `renderOrder`, and a camera constrained to orbit above ground so the order never changes.
- **Make most things opaque.** Wells as instanced opaque emissive cylinders, crops as `InstancedMesh`, the cutaway side walls as opaque quads whose shader draws strata and the water line from the head field. The side walls carry most of the "see-through" impression and cost nothing.
- **Water table.** A 64x64 plane; update 4,096 vertex heights on the CPU each frame from the Worker's head array. Do not put the head field in a float texture: linear filtering of float textures is an extension that some mobile and older integrated GPUs lack `[I]`. Normals by finite difference in the shader.
- **Sim stays on the CPU** in a Web Worker at fixed timestep. A 64x64 grid does not need the GPU, and that removes the whole class of float-render-target failures that sank DELUGE's reliability score.
- **What breaks on integrated GPUs:** full-screen transparent overdraw at native 4K/retina resolution (cap pixel ratio at 1.5), bloom at full resolution (half-res), thousands of alpha-tested crop cards (use opaque low-poly). All avoidable.
- **Design risk, not GPU risk:** crops and soil sit on top of the thing the judge is meant to look at. The cutaway angle, an "X-ray" toggle that fades the surface, and vertical exaggeration all need a day of look-development in Blender and in the shader. This is the part the concept itself calls unproven, and it has no fallback that keeps the pitch.

---

## 5. Effort, cuts, headline metric

| Component | Person-days |
|---|:---:|
| Simulator (Boussinesq, well correction, drying, boundaries) + tests + MODFLOW validation | 1.5 |
| Data download, cleaning, forecast with baselines | 1.25 |
| Response-matrix optimizer, Nash BAU, policy baselines, HiGHS in browser | 1.5 |
| 3D twin: cutaway, water surface, wells, crops, look-dev | 2.0 |
| Interaction, autoplay tour, counters, deploy, README, video | 1.25 |
| **Total** | **7.5** |

**Cuts to reach ~6.5:** synthetic-but-calibrated layout only (no attempt at real private wells); satellite crop demand dropped, FAO-56 crop coefficients from a table; explicit solver on a coarse grid, no implicit scheme; forecast shipped as a notebook plus one panel, not interactive; four crops; no drill-deeper animation beyond a depth slider. It still does not reach GREENWAVE's 6, and the first thing to slip under pressure will be the forecast-to-simulator link, which is the piece holding the AI story together.

**Headline metric.**

- *Plan:* median years until half the wells are dry, and village net income over 20 years, cooperative plan versus Nash business-as-usual versus uniform pumping cut, median and interquartile range over 20 rainfall sequences resampled from the district record. In simulation; say so.
- *Forecast:* RMSE in metres of depth to water on held-out wells and held-out years, versus persistence and versus seasonal-naive-plus-trend.
- *Correctness:* head RMSE in centimetres versus MODFLOW 6 on the benchmark case.

The plan number is "agreement with ourselves", the same criticism I made of DELUGE's surrogate. GREENWAVE's number is also in its own simulator, but it is measured against max-pressure, a baseline the field recognises. AQUIFER's uniform-cut baseline is the nearest equivalent and must be reported.

---

## 6. Scores

- **Technical depth: 7.** Validated PDE solver, a proper response-matrix optimisation with a game-theoretic baseline, and a forecast with honest baselines is real engineering. It loses a point to GREENWAVE because the learned component is marginal and the three parts are joined by assumption rather than data. If the optimizer ships as a five-variable crop-mix LP, this is a 5.
- **Demo reliability: 8.** Static site, CPU sim, no keys, no backend, deterministic with a seeded rainfall sequence. One point below GREENWAVE for layered transparency on unknown GPUs and a WASM solver that must load before the cooperative toggle works (mitigated by the precomputed default plan).

---

## 7. Verdict and outline

**GREENWAVE.** Reasons, in order of weight:

1. **Coherence.** GREENWAVE is one simulator, one trained policy, one metric. AQUIFER is a forecast on district data, a simulator on a synthetic village, and an optimizer on a linearisation of that simulator. Each seam is a place a reader can ask "how do you know?".
2. **Data.** GREENWAVE needs none and claims none. AQUIFER's pitch says "real village" and "public records", and the public records turn out to be one well per ~140 km2 behind a sign-in. The honest version is weaker than the pitch.
3. **AI core.** A policy trained in the repo's own environment answers "where is the AI?" in one sentence. AQUIFER's answer is "an LP and a gradient-boosted regressor".
4. **Cost.** 6.5-7.5 person-days against 6, with the unproven item (transparent subsurface look) on the critical path.

What AQUIFER does better, and it is not nothing: its result does not depend on RL converging; its physics can be checked against MODFLOW in half a day; and its optimizer gives a provable optimum instead of a hoped-for one. If GREENWAVE's PPO fails to beat max-pressure, the two would be level on depth. That is the only scenario in which I would switch.

### Day-by-day for AQUIFER, if chosen anyway

Freeze by 18:00 IST on 15 Nov, submit by 21:00.

- **D0 (12 Nov, half day).** Sign in and download the CGWB CSV; if not on disk in an hour, cut the forecast now. Pick the block. Boussinesq solver in TypeScript with no DOM dependency, mass-balance test, Theis test. Deploy an empty three.js scene so hosting is settled.
- **D1 (13 Nov).** *Person A:* well-bore correction, drying taper, general-head boundary, MODFLOW 6 comparison via FloPy, calibrate Sy and recharge to the district hydrograph. *Person B:* forecast notebook with the three baselines, spatial and temporal split. *Person C / Blender:* cutaway block, strata walls, water surface driven by a fake head field, instanced wells and crops. Decision gate at end of day: if the cutaway does not read clearly in a screenshot, switch the visual to a 2.5D cross-section and accept the lower ceiling.
- **D2 (14 Nov).** Response matrix from unit-pumping runs; LP in HiGHS (Node first, then browser); Nash best-response BAU; uniform-cut and paddy-ban baselines; 20-sequence benchmark script that prints the results table; re-simulate the plan in the nonlinear model and record the linearisation error. Wire sim Worker to the scene; wells go dark when head drops below pump depth.
- **D3 (15 Nov).** Click-a-farm interaction (depth slider, crop switch), cooperative toggle on the same seeded rainfall, counters, autoplay tour, pixel-ratio cap and low-quality mode, test on an integrated-GPU laptop and a phone. README: results table, MODFLOW validation, the synthetic-layout statement, hard-rock limitation, vertical exaggeration factor. 60-second video as insurance.

---

## Verified vs inferred

**Verified by search (12 Nov 2026):** the India Data Portal listing of CGWB wells (22,965 wells, four readings a year, since 1969, latitude/longitude, ~75 MiB CSV, updated Sep 2024) and the conflicting well counts and licences across listings; India Data Portal requiring sign-in and a purpose form; Atal Jal block reports containing well annexures with panchayat names and coordinates, and the ten-wells-per-panchayat design; the depth-below-ground datum; the Punjab/Haryana dataset; measured transmissivity ranges for Aravalli hard rock and Deccan basalt and the variability of specific yield in gneiss; existence (not contents) of the GEC 2015 norm tables; FloPy's unconfined MODFLOW 6 tutorial and the radial example; `highs` (MIT, WASM, MILP) and glpk.js (GPL-3.0); three.js transparency sorting behaviour and the absence of built-in OIT.

**Not verified (inference, arithmetic or recollection):** that the CSV actually downloads today (my fetch was blocked); anonymous export from India-WRIS itself; absence of Kaggle/Zenodo mirrors (none surfaced, which is not proof); well density per village; private borewell data being unavailable; all specific-yield, alluvial-transmissivity and recharge-factor numbers quoted from memory; the timestep and drawdown arithmetic (derived, not sourced); the Peaceman-style correction constant; FloPy `get-modflow`; cost of three.js transmission and float-texture filtering support on integrated GPUs; LP solve times; expected ML gain over seasonal-naive; all person-day estimates and scores.
