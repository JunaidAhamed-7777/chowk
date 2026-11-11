# Judge 2 — Technical Implementation Review

Lens: depth, correctness, and whether it can be built and work reliably by 15 Nov 23:55 IST. Nothing else.

**Evidence tags.** `[V]` = I checked it by web search on 12 Nov 2026 (link given). `[I]` = my inference or recollection, not checked; treat as a claim to verify before relying on it.

**Budget assumption `[I]`.** 3.5 calendar days for a 2-3 person team with an AI coding assistant is roughly 7-9 nominal person-days, about 6 effective after integration, deployment, README, video and sleep. Anything I estimate above 6 person-days does not fit without the cuts listed.

**A rule that applies to every idea.** The three ideas that survive are the ones whose live demo is a static site with no backend, no key and no model larger than a few MB. Every external call at demo time (LLM, STAC, weather, a sleeping Hugging Face Space) is a way to lose a judge in the first 10 seconds.

---

## Score table

| # | Idea | Depth (repo) | Demo reliability | Person-days (honest version) | Biggest breakage risk |
|---|------|:---:|:---:|:---:|---|
| 5 | GREENWAVE | 8 | 9 | 6 | Sim parity between training and browser; RL not beating max-pressure |
| 7 | MULEHUNT | 7 | 9 | 4.5 | GNN loses to a gradient-boosted baseline; precomputed scores look like a canned animation |
| 1 | PULSE | 6 | 6 | 5 | Webcam lighting / auto-exposure; AF flag cannot be validated |
| 6 | DELUGE | 9 | 5 | 9 | 30 m DSM cannot resolve streets; three hard subsystems in series |
| 2 | FUNDUS | 5 | 9 | 3 | Lesion segmentation from 54 training images; 3D is decoration |
| 3 | TERRA | 4 | 5 | 8+ | Live satellite fetch latency and cloud cover; no ground truth for any claim |
| 4 | KINETIC | 4 | 4 | 7+ | Free LLM quota on a public demo; "generated" sims are template selection |
| 8 | ECHOGUARD | 5 | 3 | 7 | Spoof detector near chance on audio the judge actually plays |

---

## 1. PULSE — camera vitals + 3D heart

**Stack.** `@mediapipe/tasks-vision` Face Landmarker (478 landmarks, WASM + GPU delegate) for forehead/cheek ROIs `[V]` ([guide](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js)); POS/CHROM in a Web Worker; band-pass + peak detection; small 1D-CNN denoiser in ONNX Runtime Web (WASM, <1 MB); react-three-fiber heart driven by detected beat times.

**Hardest component.** Beat-to-beat interval accuracy. Average heart rate from a webcam is easy. HRV and any rhythm flag need inter-beat intervals accurate to tens of milliseconds from a 30 fps stream with frame-time jitter, auto-exposure and auto-white-balance. That is where it breaks `[I]`.

**What will break.**
- **AF classifier has no valid test set.** MIMIC PERform AF exists and is downloadable (35 adults, 19 AF / 16 non-AF, 20 min each, 125 Hz, ~111 MB CSV on Zenodo) `[V]` ([Zenodo](https://zenodo.org/records/6807403), [docs](https://ppg-beats.readthedocs.io/en/latest/datasets/mimic_perform_af/)). But it is contact PPG from ICU bedside monitors. Training on that and applying it to webcam rPPG is an unmeasured domain shift, and with 35 subjects any subject-wise split has enormous variance. I found no public rPPG dataset with AF labels `[I]`. So the AF flag would ship with zero evidence. A judge who knows the field will mark it as a medical claim without validation.
- **UBFC-rPPG.** Downloadable via Google Drive / OneDrive links with no request form; 42 shared videos in dataset 2; no explicit licence, "shared for research purpose" `[V]` ([project page](https://sites.google.com/view/ybenezeth/ubfcrppg)). Do not redistribute its videos as the demo fallback. The videos are uncompressed and the set is tens of GB `[I]`, which is slow to move through Colab.
- **Prior art.** rPPG-Toolbox (NeurIPS 2023) already ships POS/CHROM and deep models with UBFC/PURE loaders `[V]` ([repo](https://github.com/ubicomplab/rPPG-Toolbox)). Using it for training is sensible; it also means the judge can find the same thing in one search.
- **Stranger's webcam.** Permission prompt, backlit rooms, low-light noise, 15 fps laptop cameras, darker skin tones with lower signal-to-noise. Expect a real fraction of first clicks to show a wrong or unstable number `[I]`. Needs a signal-quality gate that refuses to show a number, plus a self-recorded fallback clip (team member wearing a fingertip oximeter, consent given).
- **Respiration rate** from rPPG amplitude modulation is weak; cut it.

**Person-days.** 5. Cut to fit: AF classifier becomes an "irregularity index" (RMSSD / Poincaré), explicitly not a diagnosis; no respiration; heart animation is beat-synced only, no conduction-system simulation.

**Scores.** Depth 6. Demo 6.

**Thin-AI flag.** POS is about 20 lines of linear algebra. MediaPipe is someone else's model. Without the learned denoiser there is no ML that is yours. Make it real: train the 1D denoiser on UBFC (POS trace in, oximeter PPG out), leave-subject-out, and report MAE against raw POS on the same folds.

---

## 2. FUNDUS — DR grading on a 3D eye

**Stack.** EfficientNet-B0 or ConvNeXt-Tiny fine-tuned on APTOS 2019 in Colab; U-Net lesion segmentation on IDRiD; export to ONNX, int8 quantised (~5-20 MB), ONNX Runtime Web WASM; Grad-CAM precomputed or replaced by the segmentation mask; r3f eyeball.

**Hardest component.** Lesion segmentation that is not embarrassing. IDRiD has pixel masks for only 81 images (54 train) `[I]`, and microaneurysms are a few pixels wide. Published results on that class are weak `[I]`.

**What will break.**
- **Data.** IDRiD is CC BY 4.0, hosted on IEEE DataPort, free login required, segmentation archive ~557 MB `[V]` ([Grand Challenge](https://idrid.grand-challenge.org/Data/), [HF licence file](https://huggingface.co/datasets/amin-nejad/idrid-disease-grading/blob/main/LICENSE.txt)). APTOS licence could not be confirmed by search; it is Kaggle competition data governed by competition rules `[I]`. Do not redistribute APTOS images as samples; use IDRiD images for samples.
- **Training.** 1-2 h on a free T4 `[I]`. Not a risk.
- **In-browser.** Classifier is fine. Segmentation at 512-1024 px in WASM is 1-5 s on a low-end laptop `[I]`; acceptable with a progress bar.
- **Geometry trap.** A 45-50 degree fundus photo covers the posterior pole only. Wrapping it over the whole inner hemisphere is anatomically wrong. Map it as a cap with the correct angular extent or an ophthalmologist-judge will notice `[I]`.
- **Shortcut learning.** APTOS has known acquisition artefacts (image size / crop correlate with grade) `[I]`. In-distribution kappa overstates everything.

**Person-days.** 3. Nothing must be cut; the problem is the ceiling, not the fit.

**Scores.** Depth 5. Demo 9.

**Thin-AI flag.** The model is real but it is the most reproduced Kaggle exercise in medical imaging. The 3D eye adds no information over a 2D overlay. What would make it credible: cross-dataset evaluation (train APTOS, test IDRiD grading set) reported next to in-distribution kappa, and calibrated referable / non-referable sensitivity at fixed specificity.

---

## 3. TERRA — 3D farm twin

**Stack.** MapLibre for field selection; Earth Search STAC + Sentinel-2 L2A COGs read with geotiff.js range requests; Open-Meteo for weather; FAO-56 soil-water balance; PlantVillage classifier in ONNX; r3f terrain.

**Hardest component.** Getting a cloud-free multi-date NDVI stack for an arbitrary field fast enough to count as a demo.

**What will break.**
- **Satellite access.** Earth Search v1 is anonymous, no key, collection `sentinel-2-l2a`, COGs on AWS open data `[V]` ([repo](https://github.com/Element84/earth-search), [AWS registry](https://registry.opendata.aws/sentinel-2-l2a-cogs/)). Browser CORS on the API and the bucket was **not** confirmed by search. Test with a cross-origin `fetch` before writing any code that depends on it.
- **Latency.** A season is 30-70 scenes x 2-3 bands, each needing several range requests `[I]`. Tens of seconds in the browser on a good connection. Kills the 10-second rule.
- **Cloud.** Kharif season in India is monsoon; usable optical scenes are sparse `[I]`. The time slider will be mostly gaps unless Sentinel-1 is added, which is another project.
- **Resolution.** 10 m pixels. A 1 ha smallholding is ~100 pixels, fewer after edge masking `[I]`. "Per-zone" irrigation scheduling inside such a field is not supported by the data.
- **Terrain.** Copernicus GLO-30 is open on AWS without credentials `[V]` ([registry](https://registry.opendata.aws/copernicus-dem/)), but at 30 m a field is a flat quad. The 3D terrain is decoration.
- **Leaf disease.** PlantVillage-trained models report ~99% in-distribution and fall to roughly 54-81% on field images depending on setup `[V]` ([Frontiers 2025](https://www.frontiersin.org/journals/plant-science/articles/10.3389/fpls.2025.1522985/pdf), [arXiv 2603.07356](https://arxiv.org/pdf/2603.07356)). A judge uploading a real leaf photo gets a wrong answer.
- **No ground truth.** No yield labels, no soil moisture truth, no irrigation logs. Nothing here can produce an honest headline number.

**Person-days.** 8+. To fit: pre-bake 3 fields (scenes downloaded offline, stored as small PNG/JSON), drop live field drawing, drop leaf model.

**Scores.** Depth 4. Demo 5 (9 if fully pre-baked, at which point it is a visualisation).

**Thin-AI flag.** NDVI anomaly detection is a z-score. FAO-56 is a deterministic textbook model. The leaf model is the standard tutorial. Three shallow parts do not sum to depth. Real version: pick one thing, for example crop-type or sowing-date mapping from Sentinel-1/2 time series against a labelled public dataset, and report accuracy.

---

## 4. KINETIC — LLM-generated 3D simulations

**Stack.** Next.js on Vercel with a serverless proxy to an LLM; JSON-schema constrained output into a scene DSL; hand-written simulation primitives (symplectic integrator for orbits, rigid body via Rapier WASM, etc.); r3f.

**Hardest component.** The primitive library. Each physically correct, interactive primitive is 0.5-1 day. The LLM contributes little to that.

**What will break.**
- **LLM quota.** Search could not establish current Gemini free-tier limits; Google may no longer publish per-model figures, and third-party numbers range from 20 to 1,500 requests/day `[V: that they conflict]` ([official page](https://ai.google.dev/gemini-api/docs/rate-limits)). Groq free tier is 30 req/min with daily caps reported between 1,000 and 14,400, per organisation `[V: conflicting]` ([docs](https://console.groq.com/docs/rate-limits)). Either way one shared key serves every judge and every scraper. A 429 at the wrong moment is a dead demo.
- **Latency.** 3-10 s per generation plus a serverless cold start `[I]`.
- **Correctness.** Free-form questions will fall outside the primitive set. The honest response ("I can't simulate that") reads as failure; the dishonest one (nearest template) teaches wrong physics.
- **Knowledge tracing** has no data. A DKT model trained on ASSISTments says nothing about these sims `[I]`.
- **Misconception detection from interaction traces** has no labels; in 3.5 days it will be an LLM prompt.

**Person-days.** 7+. To fit: 6-8 primitives, canned example prompts served from cache, free-text as a secondary path.

**Scores.** Depth 4. Demo 4 (7 if the cached prompts are the main path).

**Thin-AI flag.** This is the clearest wrapper of the eight. The LLM picks a template and fills parameters. It also violates the document's own hard requirement ("not just an LLM API wrapper"). Real version: a verifier that rejects generated scenes by checking invariants (energy drift, dimensional consistency), and a published eval set of 100+ questions with a pass rate against an unconstrained-LLM baseline. That is a result; the rest is UI.

---

## 5. GREENWAVE — RL traffic signals

**Stack.** One simulator core in TypeScript: IDM car-following, lane queues, signal phases with yellow/all-red, turning ratios, spillback. Run headless in Node for training and in the browser for the demo, so there is exactly one implementation. PPO or DQN with parameter sharing across intersections (PyTorch talking to a batched Node env over a pipe, or a small DQN written directly in TS). Policy is a small MLP exported to ONNX (<100 KB), ONNX Runtime Web WASM. Three.js `InstancedMesh` for vehicles, emissive materials + bloom for the night look.

**Hardest component.** A micro-sim that is correct at intersections (conflicting movements, blocked exits, gridlock) and identical between training and demo. If the sim is written twice (Python for training, JS for the browser) the policy will silently underperform in the browser and nobody will know why.

**What will break.**
- **Baseline honesty.** Beating a badly timed fixed cycle is trivial and judges know it. The baselines that matter are Webster-optimised fixed time and max-pressure, both ~30 lines. The RESCO benchmark includes Fixed Time, Greedy and Max Pressure next to IDQN/IPPO/MPLight `[V]` ([RESCO](https://github.com/UnivOfAlabama-BittleResearchGroup/RESCO)); its headline finding as I recall it is that well-tuned classical controllers are competitive with RL `[I]`. Plan for the case where RL only ties max-pressure and decide now what you report then.
- **Building blocks exist.** sumo-rl provides Gymnasium/PettingZoo environments `[V]` ([PyPI](https://pypi.org/project/sumo-rl)); traffic-simulation.de is an open-source JavaScript IDM simulator `[V]` ([repo](https://github.com/movsim/traffic-simulation-de)). Check its licence before borrowing code; reading it for the IDM/MOBIL equations is fine. SUMO itself cannot run in the browser, which is exactly why the own-simulator route is the differentiator and should be said so in the README.
- **Training time.** A queue-level sim at 1 s control steps runs fast headless; a shared-policy PPO on a 3x3 or 4x4 grid should converge in 1-3 h on CPU `[I]`. Reward shaping (pressure or queue-length delta) matters more than compute. Budget a full day for it not working the first three times.
- **OSM import.** Silk Board is a multi-level interchange with flyovers. OSM lane counts and turn restrictions in Bengaluru are incomplete `[I]`. Auto-importing it is a multi-day side quest. Hand-author the network.
- **Sim-to-real.** Indian traffic is lane-less and two-wheeler dominated; IDM assumes lane discipline `[I]`. State it as a limitation instead of pretending.
- **CO2.** Needs an emissions model. A speed/acceleration/idle fuel model is fine; label it an estimate.
- **Ambulance green corridor** is rule-based pre-emption. Do not call it AI.
- **Performance.** A few thousand instanced vehicles is fine on integrated graphics; run the sim in a Worker at fixed timestep, cap bloom resolution, offer a low-quality toggle `[I]`.

**Person-days.** 6. Cut to fit: synthetic 3x3 or 4x4 arterial grid styled as a city district (no OSM import, no named real junction), one policy shared across intersections, two demand profiles, no lane changing (MOBIL) unless day 1 ends early.

**Scores.** Depth 8. Demo 9. No server, no key, no camera, no upload; deterministic with a seeded RNG, so the A/B toggle shows the same traffic under both controllers.

**Thin-AI flag.** None, provided the policy is actually trained in the repo's simulator and the training script, seeds and curves are committed. It becomes decoration the moment the "RL" controller is a hand-tuned heuristic.

---

## 6. DELUGE — flood twin with surrogate and optimiser

**Stack.** Shallow-water solver on the GPU (virtual-pipes or local-inertial scheme) in WebGPU with a WebGL2 float-texture fallback; Copernicus GLO-30 DEM + OSM buildings burned into the height field; U-Net surrogate (PyTorch to ONNX); greedy or Bayesian-optimisation intervention placement using the surrogate as the inner loop.

**Hardest component.** Three hard subsystems in series: a stable wet/dry GPU solver, a surrogate trained on data that solver must first generate, and an optimiser on top. Any one slipping a day sinks the rest.

**What will break.**
- **Terrain resolution.** GLO-30 is open on AWS with no account `[V]` ([registry](https://registry.opendata.aws/copernicus-dem/)), but it is a 30 m surface model (file names are `Copernicus_DSM_COG_...`) `[V]`, so buildings and canopy are in the heights and streets are narrower than one cell. Vertical error is metres `[I]` while urban flood depths are tens of centimetres. "Water rising through real streets" is not physically supported by this data. Without a 1-2 m LiDAR DTM (not openly available for Indian cities `[I]`) the output is illustrative, and saying otherwise is the kind of claim that loses a technical judge.
- **No drainage network.** Urban pluvial flooding is dominated by storm-drain capacity. There is no open drain data. "Drain upgrade" as an intervention has nothing to act on.
- **Surrogate training data.** Real datasets exist: FloodCastBench (21.6 GB on Zenodo, 30-480 m, river-scale events) `[V]` ([Zenodo](https://zenodo.org/records/14017092)); UrbanFlood24 (Shenzhen, 56 rainfall events, 1-minute steps) `[V]` ([page](https://holmescao.github.io/datasets/urbanflood24)); UrbanFloodBench (CC BY-NC 4.0, four catchments) `[V]` ([USyd](https://ses.library.usyd.edu.au/handle/2123/35562)). None covers your chosen neighbourhood, so the surrogate ends up trained on your own unvalidated solver, and the reported accuracy is "agreement with ourselves".
- **Surrogate inference.** A U-Net at 256x256 in WASM is 0.5-3 s on a low-end laptop `[I]`. If the GPU solver is real-time, the surrogate is only justified as the optimiser's inner loop. Say that explicitly or it looks redundant.
- **WebGPU reach.** Not confirmed by search for late 2026. Chrome/Edge desktop are safe; Firefox and Safari support is recent and uneven `[I]`. The WebGL2 fallback is mandatory, which means writing the solver twice or writing it only in WebGL2.
- **Name and concept collision.** A Devpost project called "Deluge" already exists: WGSL shallow-water solver, local-inertial scheme, real USGS terrain, over a million cells `[V]` ([Devpost](https://devpost.com/software/deluge)). Rename, and assume the solver alone is not novel. WebFlood (GLSL, city scenes) is another prior `[V]` ([repo](https://gh.r-mj.com/aeplay/WebFlood)).

**Person-days.** 9. Cut to fit (leaves about 6): one pre-baked 2-4 km tile, WebGL2 only, two intervention types (retention basin, permeable surface as infiltration rate), greedy optimiser, surrogate at 128x128.

**Scores.** Depth 9 if all three parts are real. Demo 5: GPU feature detection, float-texture support and thermal throttling on unknown laptops are the usual failures.

**Thin-AI flag.** The solver is physics, not AI. The AI is the surrogate and the optimiser, and those are exactly the parts most likely to be cut on day 3. If they are cut, this is a (very good) WebGL water demo with no AI core.

---

## 7. MULEHUNT — GNN fraud rings

**Stack.** PyTorch Geometric in Kaggle/Colab; IBM AML HI-Small as primary data, Elliptic as secondary; edge-classification GNN (GIN/PNA with edge features, reverse message passing, port numbering as in Multi-GNN); XGBoost baselines; GNNExplainer or simple edge-mask attribution; `3d-force-graph` (three.js) with precomputed layout; static JSON on Vercel.

**Hardest component.** Making the graph model beat a strong tabular baseline on a temporal split. That is the entire scientific claim ("banks miss rings because they score transactions individually") and it is not guaranteed to hold.

**What will break.**
- **Data and licence.** IBM AML data is on Kaggle under CDLA-Sharing-1.0; the Multi-GNN reference code is Apache-2.0 `[V]` ([AML-Data](https://github.com/IBM/AML-Data), [Multi-GNN](https://github.com/IBM/Multi-GNN), [paper](https://arxiv.org/pdf/2306.16424.pdf)). Redistribution of a derived subgraph is allowed under share-alike terms; include the licence. Elliptic is in PyG with a built-in temporal split (steps 1-34 train, 35-49 test), 46,564 labelled nodes, 4,545 illicit `[V]` ([PyG source](https://pytorch-geometric.readthedocs.io/en/stable/_modules/torch_geometric/datasets/elliptic.html)); its licence was not confirmed.
- **GNN vs. tabular.** On Elliptic, an MLP is reported to beat GNNs, and a 2026 paper argues graph structure becomes a liability under temporal shift `[V]` ([arXiv 2604.19514](https://arxiv.org/pdf/2604.19514)). The original Elliptic paper had random forest ahead of GCN `[I]`. So Elliptic is the wrong dataset on which to make the graph claim. IBM AML is the right one because the laundering patterns (fan-in, fan-out, cycles, scatter-gather) are structural by construction and the Multi-GNN paper shows GNN gains over GBDT there `[I]`.
- **Imbalance.** Laundering rate in HI-Small is on the order of 0.1% `[I]`. Report minority-class F1 or PR-AUC, never accuracy.
- **Training.** ~5M transactions, ~500k accounts in HI-Small `[I]`. Neighbour-sampled training fits a free T4 in a few hours. Start it on day 1, not day 3.
- **In-browser inference.** PyG scatter/gather ops export to ONNX badly `[I]`. Do not attempt full-graph inference in the browser. Precompute scores; optionally run a tiny dense-adjacency GNN on a selected 200-node subgraph live to prove the model exists.
- **Rendering.** Force layout of more than ~5k nodes computed live stutters on integrated graphics `[I]`. Precompute positions offline, ship them, animate only edges/particles.
- **Synthetic data.** It is synthetic. Say so in the first paragraph and cite IBM's calibration claims instead of hiding it.

**Person-days.** 4.5. Cut to fit: one dataset (IBM HI-Small), Elliptic dropped or relegated to an appendix, "live stream" is a time-ordered replay of the held-out test period (state that), freeze-the-funds is a counterfactual sum over downstream flagged transactions.

**Scores.** Depth 7. Demo 9.

**Thin-AI flag.** A precomputed-scores demo is indistinguishable from a hand-coloured animation. Counter it with: committed training notebook and weights, a results table with baselines and ablations, and the scores shown strictly on the temporal held-out period. The "why flagged" panel must be driven by real attribution output, not templated text.

---

## 8. ECHOGUARD — scam-call and voice-clone shield

**Stack.** AASIST (pretrained) exported to ONNX for spoof detection; Whisper tiny/base through transformers.js (WebGPU with WASM fallback) for ASR; small text classifier for scam tactics; r3f audio-reactive shader.

**Hardest component.** Spoof detection that works on audio it was not trained on, arriving through a laptop speaker and microphone.

**What will break.**
- **Generalisation.** Pretrained AASIST weights exist (0.83% EER on ASVspoof 2019 LA) `[V]` ([repo](https://github.com/clovaai/aasist)). That number does not transfer: the In-the-Wild dataset was built to show exactly this (paper title: "Does audio deepfake detection generalize?") `[V]` ([Fraunhofer](https://deepfake-demo.aisec.fraunhofer.de/in_the_wild)), and Deepfake-Eval-2024 reports audio detector AUC dropping by about 48% against 2024 real-world fakes `[V]` ([arXiv 2503.02857](https://arxiv.org/html/2503.02857v4)). A judge who pastes in a current commercial voice clone will likely get "genuine".
- **Channel mismatch.** Playing a clip through speakers into the mic is a replay (physical-access) condition; LA-trained models are not trained for it `[I]`.
- **Retraining is not an option.** ASVspoof 5 is 142.3 GB `[V]` ([Zenodo](https://zenodo.org/records/14498691)). Not in 3.5 days on free compute.
- **ASR.** Whisper in the browser needs manual chunking (not natively streaming); recommended sizes are tiny/base; whisper-base is quoted at ~200 MB for web `[V]` ([LogRocket](https://blog.logrocket.com/how-to-build-a-real-time-voice-ai-agent-in-the-browser), [HackerNoon](https://hackernoon.com/turn-audio-to-text-on-your-device-free-whisper-webgpu-guide)). Hindi and code-mixed accuracy at those sizes was not found by search and I expect it to be poor `[I]`. "Across Indian languages" is not deliverable.
- **Scam classifier data.** No public labelled corpus of Indian scam-call transcripts that I know of `[I]`. Training on LLM-generated scripts and testing on LLM-generated scripts is circular.
- **First load.** 100-200 MB of models before anything happens.

**Person-days.** 7. To fit: uploaded/sample audio only, English only, spoof detector presented with its measured In-the-Wild error rate.

**Scores.** Depth 5. Demo 3.

**Thin-AI flag.** Both models are downloaded checkpoints; the only original component is a text classifier on synthetic data. Real version: fine-tune the detector on In-the-Wild plus codec/replay augmentation and report cross-dataset EER before and after. That is a result worth submitting, but it has no visual.

---

## Ranking: technical impressiveness achievable in 3.5 days with a reliable demo

1. **GREENWAVE** — real, self-contained ML; zero runtime dependencies; an A/B toggle that is itself the proof.
2. **MULEHUNT** — real model on a real benchmark with published baselines; static demo; lowest schedule risk of the credible ideas.
3. **PULSE** — real signal processing with a measurable result and the only demo that reacts to the judge; reliability is the price. Only viable with the AF claim removed.
4. **DELUGE** — highest ceiling, but 9 person-days, physically shaky at 30 m, and the AI parts are the ones that get cut. Also has a same-name prior.
5. **FUNDUS** — will work, will be finished, will look like 40 other entries in the repo.
6. **TERRA** — broad, shallow, and nothing in it can be validated.
7. **KINETIC** — wrapper, with a quota-limited third-party dependency at demo time.
8. **ECHOGUARD** — the core claim fails on the first clip a judge supplies.

---

## Top 3: build outlines and the number to report

Days: D0 = 12 Nov (half day), D1 = 13 Nov, D2 = 14 Nov, D3 = 15 Nov (freeze by 18:00 IST, submit by 21:00, not 23:55).

### 1. GREENWAVE

- **D0.** Sim core in TypeScript with no DOM dependency: network graph, IDM, signal phases, seeded demand generator, metrics (delay, stops, queue length). Unit tests for vehicle conservation and no-collision. Headless Node runner. Deploy an empty r3f scene to Vercel tonight so hosting is never the problem.
- **D1.** Baselines first: fixed-time, Webster-optimised, max-pressure, with a benchmark script that prints mean delay over 20 seeds. Gym-style batched env. Start PPO with shared policy (observation: per-approach queue and pressure, current phase, time in phase; action: hold or switch). In parallel: Blender city blocks, instanced vehicles, bloom, camera path.
- **D2.** Iterate reward and observation until RL beats Webster and at least ties max-pressure on unseen seeds and on an unseen demand level. Export ONNX; a parity test asserts the browser policy outputs match PyTorch on 1,000 recorded observations. Wire the toggle, split-screen or same-seed replay, live counters.
- **D3.** Ambulance pre-emption (rule-based, labelled as such), low-quality mode, mobile check, README with training curves, results table, limitations (lane discipline, synthetic network). Record a 60 s video as insurance.

**Number to report.** Mean delay per vehicle (seconds) on held-out demand seeds, RL vs. Webster fixed-time and vs. max-pressure, mean and 95% CI over 20+ seeds, plus the same on a demand level not seen in training. The max-pressure comparison is the one that earns credit; report it even if it is a tie.

### 2. MULEHUNT

- **D0.** Download IBM AML HI-Small from Kaggle; temporal split following Multi-GNN's formatting script; XGBoost baseline on transaction features, then with hand-built graph features (in/out degree, fan-in/out counts). Record minority F1 and PR-AUC. This is the bar.
- **D1.** GNN: edge classifier with edge features, reverse edges, port numbering (follow Multi-GNN, which is Apache-2.0, and credit it). Train on Kaggle GPU. In parallel: pick a held-out-period subgraph of 3-5k accounts containing several labelled laundering patterns; precompute a 3D layout; first render with `3d-force-graph`.
- **D2.** Ablation table (GNN without reverse MP, without ports, without edge features). Attribution per flagged ring. Front end: time scrubber over the test period, particles for money flow, ring isolation, "why flagged" from attribution output, funds-frozen counterfactual.
- **D3.** Optional live inference on a selected subgraph with a dense-adjacency ONNX model. README with results table, data licence, the synthetic-data caveat. Video.

**Number to report.** Minority-class (laundering) F1 on the temporal held-out split of IBM AML HI-Small, GNN vs. XGBoost on per-transaction features, with the published Multi-GNN figure quoted as external reference. Secondary: share of labelled laundering patterns in the test period with at least half their transactions flagged, at a stated false-positive rate.

### 3. PULSE

- **D0.** Browser pipeline end to end with no ML: Face Landmarker, ROI means, POS, band-pass, FFT heart rate, a signal-quality index. Test on three team members under three lighting conditions against a fingertip oximeter. If the classical pipeline is not within ~5 bpm on your own faces tonight, drop this idea and promote FUNDUS.
- **D1.** Offline: run the identical ROI + POS code on UBFC-rPPG (use rPPG-Toolbox loaders), leave-subject-out folds, baseline MAE. Train the 1D denoiser (POS window in, ground-truth PPG out). Blender heart: low-poly, baked beat animation as a shape key or bone, driven by beat timestamps.
- **D2.** ONNX export of the denoiser, in-browser inference in a Worker, beat detection on the denoised trace, RMSSD and an irregularity index with a hard "not a diagnosis" label and a quality gate that withholds numbers when the signal is poor. Fallback clip of a consenting team member with oximeter overlay.
- **D3.** Lighting guidance UI, no-webcam path as the default-visible option, privacy note (verifiable: no network requests carry frames), README with fold-wise results, limitations including skin-tone performance if you can measure it. Video.

**Number to report.** Heart-rate MAE in bpm on UBFC-rPPG, leave-subject-out, denoiser vs. raw POS on the same folds. Secondary: mean absolute inter-beat-interval error in ms, since that is what any HRV or rhythm output depends on. Do not report anything about AF.

---

## What I verified vs. what I inferred

**Verified by search (12 Nov 2026):** UBFC-rPPG download route and absence of a stated licence; MIMIC PERform AF size and composition; rPPG-Toolbox existence; MediaPipe Face Landmarker web package; IDRiD CC BY 4.0 and IEEE DataPort hosting; Earth Search anonymous access; Copernicus GLO-30 open bucket and DSM naming; PlantVillage field-accuracy drop; conflicting/unpublished Gemini and Groq free-tier limits; sumo-rl, RESCO and traffic-simulation.de; FloodCastBench, UrbanFlood24, UrbanFloodBench; the existing Devpost "Deluge" and WebFlood; IBM AML licence and Multi-GNN licence; Elliptic temporal split and the GNN-vs-MLP critique; AASIST pretrained weights; ASVspoof 5 size; In-the-Wild and Deepfake-Eval-2024 generalisation results; Whisper browser chunking and model-size guidance.

**Not verified (my inference or recollection):** all person-day estimates and scores; CORS behaviour of Earth Search and the Sentinel-2 bucket; APTOS and Elliptic licences; UBFC total size; IDRiD mask counts; WebGPU browser coverage in late 2026; training-time estimates; IBM AML illicit rate and graph size; RESCO's and the Elliptic paper's baseline findings; Whisper Hindi quality; GLO-30 vertical error; in-browser inference timings; ONNX export behaviour of PyG models.
