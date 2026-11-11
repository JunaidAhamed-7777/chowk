# INNOVEX 2026 — Candidate Ideas

## Ground rules

- **Submission window:** 14 Nov 08:00 → 15 Nov 23:55 IST. Build time from today (12 Nov): ~3.5 days.
- **What is submitted:** title, description, technologies, GitHub URL, live demo link. Judging is asynchronous, on Unstop.
- **Stated criteria:** originality, innovation, technical implementation, real-world impact.
- **Our own bar:** visually stunning within 10 seconds of opening the live demo. 3D (three.js / react-three-fiber, Blender-authored assets) is on the table.
- **Assumptions about judges:** they skim dozens to hundreds of entries, most of which are chatbots and image classifiers in Streamlit. They click the demo link, read the README top, maybe watch a video. A demo that needs a login, hardware, an API key or a 30-second cold start is dead.
- **Hard requirements for any idea:** runs in a browser with no setup; has a real AI/ML core that is ours (not just an LLM API wrapper); uses real data or is validated against real data; has one number that proves it works.

## Candidates

### 1. PULSE — camera-only vitals with a living 3D heart twin (PS01)
Point a webcam at your face; remote photoplethysmography (rPPG) extracts heart rate, HRV, respiration rate and an irregular-rhythm (AF-like) flag from skin colour changes. A Blender-made anatomical heart beats in sync with *your* pulse in real time; rhythm irregularities visibly disturb the conduction animation. All inference in-browser (MediaPipe face mesh + signal processing + small ONNX model), so no video leaves the device.
- **Wow:** the judge sees their own heartbeat drive a 3D heart within 15 seconds.
- **AI core:** rPPG signal extraction (POS/CHROM + learned denoiser), rhythm classifier trained on public PPG arrhythmia data.
- **Impact:** screening where there are no devices — ASHA workers, telemedicine, elderly at home.
- **Risks:** rPPG is known prior art; accuracy under bad lighting; medical-claims credibility; judges without a webcam (needs a recorded-sample fallback).

### 2. FUNDUS — diabetic retinopathy screening on a 3D eye (PS01)
Upload a retinal photo (or pick a sample); a model grades DR severity and the lesion heatmap is projected onto the inside of an explorable 3D eyeball, with lesions labelled (microaneurysms, exudates, haemorrhages). Referral-urgency output and a plain-language report in local languages.
- **Wow:** flying inside a 3D eye to see where the disease is.
- **AI core:** fine-tuned classifier + segmentation on APTOS / IDRiD, Grad-CAM, ONNX in browser.
- **Impact:** India has ~100M diabetics and few ophthalmologists.
- **Risks:** DR classifiers are a Kaggle staple; judges don't have a fundus image (samples only); 3D is decoration unless the projection is genuinely informative.

### 3. TERRA — a living 3D digital twin of a farm (PS02)
Draw or pick a real field on a map. The app pulls Sentinel-2 imagery and weather, builds a 3D terrain twin with per-zone crop health (NDVI/NDWI time series), flags stress zones, and runs a soil-water balance model to produce a per-zone irrigation schedule. A phone leaf photo is diagnosed and pinned onto the twin. Time slider scrubs through the season; water flows visibly through irrigation zones.
- **Wow:** a real field, in 3D, with crops growing and stress spreading as you scrub time.
- **AI core:** satellite-index anomaly detection + yield/stress forecasting, leaf-disease model, irrigation optimizer.
- **Impact:** covers all three PS02 sub-problems (monitoring, disease, irrigation) in one product; water savings are quantifiable.
- **Risks:** breadth over depth; satellite API latency/keys; leaf-disease classifiers are overdone; procedural crops may look cheap.

### 4. KINETIC — an AI tutor that builds a playable 3D simulation for any concept (PS03)
Ask "why do satellites stay in orbit?" and instead of a wall of text you get a live, interactive 3D simulation with sliders, generated on the fly from a library of physics/chemistry/maths primitives, plus a Socratic tutor that watches what you do in the sim and probes misconceptions. Mastery is tracked in a 3D knowledge constellation that lights up as you learn.
- **Wow:** type a question, a 3D experiment materialises and you can break it.
- **AI core:** LLM → constrained scene DSL → verified simulation; misconception detection from interaction traces; knowledge-tracing model for personalisation.
- **Impact:** lab-less schools; learning by doing rather than reading.
- **Risks:** reliability of generated sims; needs LLM API cost on a public demo; "AI tutor" is the most crowded category; hard to prove learning gains in 3 days.

### 5. GREENWAVE — reinforcement-learned traffic signals on a 3D city twin (PS04)
Pick a real junction network (from OpenStreetMap; ships with Bengaluru's Silk Board and others). A micro-traffic simulator runs in the browser on a night-time 3D city with thousands of glowing vehicles. Toggle between fixed-timer signals and our RL controller and watch queues dissolve; live counters show delay, stops and CO2. An ambulance mode opens a green corridor.
- **Wow:** a glowing 3D city where one switch visibly unjams traffic.
- **AI core:** multi-agent RL signal control trained in our own simulator, exported to ONNX and run live in the browser.
- **Impact:** congestion cost, emissions, ambulance response time; side-by-side numbers.
- **Risks:** RL traffic control is a known research area (SUMO projects are common); training time in 3 days; sim-to-real credibility; building a correct micro-sim is real work.

### 6. DELUGE — an AI flood twin for cities (PS04)
Pick a real neighbourhood. Real terrain (DEM) + OSM buildings become a 3D city; a GPU shallow-water simulation floods it under a chosen rainfall scenario in real time. An AI surrogate predicts the flood map instantly, and an optimizer proposes where to put interventions (retention ponds, permeable paving, drain upgrades, tree cover) for a given budget; you drop them in and watch the water recede. Shows people and roads spared.
- **Wow:** watching water rise through real streets, then placing a park and watching it drain.
- **AI core:** neural surrogate of the hydrodynamic sim + budgeted intervention optimizer (RL / Bayesian optimisation).
- **Impact:** urban flooding is an annual disaster in Bengaluru, Chennai, Mumbai, Delhi; planners lack fast what-if tools.
- **Risks:** PS04 names waste, traffic and conservation, not flooding (fit must be argued as climate resilience/sustainability); hydrology validity; GPU sim complexity; DEM resolution.

### 7. MULEHUNT — exposing fraud rings in a 3D transaction universe (PS05)
A graph neural network scores accounts and transactions for money-mule and fraud-ring behaviour. The visual is a 3D force-directed galaxy of accounts where money visibly flows; fraud rings light up and can be isolated, replayed in time, and explained ("why flagged"). A live stream mode shows a ring forming and being caught mid-flight, with freeze-the-funds simulation.
- **Wow:** a galaxy of accounts where a hidden laundering ring ignites red and unravels.
- **AI core:** temporal GNN on transaction graphs (Elliptic, PaySim, IBM AML synthetic), GNN explainability.
- **Impact:** UPI/mule-account fraud is exploding; banks miss rings because they score transactions individually.
- **Risks:** synthetic data; 3D graph views are a familiar trope; judges can't "try it on their own data".

### 8. ECHOGUARD — live scam-call and voice-clone shield (PS05)
Listens to a call (mic or uploaded audio), detects synthetic/cloned voices and recognises scam scripts ("digital arrest", KYC, OTP) in real time across Indian languages, with an audio-reactive 3D visualisation that changes state as risk rises and a live annotated transcript showing the manipulation tactics.
- **Wow:** play a cloned voice and watch the shield catch it mid-sentence.
- **AI core:** anti-spoofing audio model (ASVspoof), streaming ASR + scam-tactic classifier.
- **Impact:** "digital arrest" scams and voice-clone fraud are front-page news in India.
- **Risks:** weakest visual of the set; deepfake detection generalises poorly; streaming ASR in browser is heavy.
