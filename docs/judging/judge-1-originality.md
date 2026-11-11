# Judge 1 — Originality and Innovation

Lens: originality and innovation only. Technical quality, impact and polish are ignored except where they change how new the idea feels.
Date: 12 Nov 2026.

## How to read this

- **[V]** = verified by a web search I ran today (source listed at the bottom).
- **[I]** = my inference or background knowledge, not checked today.
- "Not found" means a handful of targeted searches did not surface it. That is weak evidence of absence, not proof.
- I could not find the INNOVEX 2026 listing or its past entries by search [V: the search returned nothing relevant], so every estimate of "how many of these will be in this hackathon" is inference from what the five problem statements invite.

## Score table

| # | Idea | Score /10 | Strongest "seen it before" objection |
|---|------|-----------|--------------------------------------|
| 6 | DELUGE | 6.5 | Sponge-city flood simulators with placeable green infrastructure are already hackathon projects (HydroGrid, twice); GPU shallow water in WebGL is an old bachelor thesis (WebFlood). |
| 5 | GREENWAVE | 5.5 | RL traffic signals with an ambulance green corridor is a textbook SUMO project with papers back to 2020-22; only the in-browser packaging is new. |
| 1 | PULSE | 5 | Webcam rPPG in the browser is a solved, open-sourced demo (heartbeat-js, Sean Reid's Pulse, Devpost "sixth", Devfolio VibeSens); the 3D heart is a skin on it. |
| 7 | MULEHUNT | 4.5 | FraudNets on Devfolio is the same pitch: GNN for circular flows and smurfing, shown as a three.js 3D network graph. |
| 3 | TERRA | 4 | Sentinel-2 NDVI + irrigation advice + leaf-disease photo is the default smart-agriculture entry; "digital twin" is already ESA / Texas A&M / Libelium vocabulary. |
| 4 | KINETIC | 4 | Google shipped this in the Gemini app in April 2026: ask a question, get an interactive 3D simulation with sliders. |
| 8 | ECHOGUARD | 3.5 | At least six hackathon projects do live scam-call plus voice-clone detection (ACSA, CallerIDK, CallPilot AI, ScamShield AI, Scam Call Shield, CallShield), some naming "digital arrest". |
| 2 | FUNDUS | 3 | Diabetic retinopathy grading with Grad-CAM is the most recycled medical-imaging project there is (APTOS Kaggle, DrRetina, RetiSpec, ClairVue). |

No idea on the list reaches 7. Nothing here is new at the level of the AI core; the best ones are new combinations.

## Per-idea findings

### 1. PULSE — 5/10
- **Prior art [V]:** prouast/heartbeat-js (browser rPPG, open source); dengbuqi/heartbeat-js-faceapi; Sean Reid's "Pulse" (MediaPipe landmarks, motion-amplified pulse in the browser); Devpost "sixth" (browser webcam, HR + HRV + respiration, WASM); Devfolio "VibeSens"; Tsinghua FacePhys; EmoPulse on DEV (biometric signals from a webcam).
- **Not found [V]:** an entry pairing rPPG with a beating 3D heart.
- **Commercial prior art [I]:** Binah.ai, NuraLogix Anura, Google Fit camera heart rate.
- **Judge reaction [I]:** "Camera heart rate, I have had that on my phone for years." The on-device privacy claim is also standard. The AF flag from webcam rPPG will read as overclaiming rather than as innovation.
- **Expected duplicates in this hackathon [I]:** 1-3 rPPG entries; none with comparable visuals.

### 2. FUNDUS — 3/10
- **Prior art [V]:** DrRetina (lablab.ai hackathon), RetiSpec (GitHub, five-stage grading, Grad-CAM++), ClairVue (ICCSCE 2025, EfficientNet + Grad-CAM), a ResNet50 multi-disease retinal demo with LLM plain-language reports, several MSc/MTech theses.
- **Not found [V]:** heatmap projected inside a 3D eye.
- **Judge reaction [I]:** the 3D eye is correctly identified in the idea's own risk list as decoration. A fundus photo is already a flat projection of the retina; wrapping it back onto a sphere adds no information. The local-language report is an LLM wrapper.
- **Expected duplicates [I]:** 3-8 DR or generic "disease from image" classifiers in PS01.

### 3. TERRA — 4/10
- **Prior art [V]:** DEV write-up of a GEE + Sentinel Hub farm platform giving NDVI-based irrigation advice; Akvelon NASA HLS field-NDVI prototype; AquaTwin (Cassini hackathon, Sentinel-2 + twin); FarmVerse 3D (real-time 3D web farm twin); EO-AgriTwin (HU Berlin); ESA "pixel twins"; Texas A&M crop digital twins; Libelium agriculture twin.
- **Not found [V]:** one browser app joining 3D terrain twin + Sentinel-2 + water balance.
- **Judge reaction [I]:** three overdone things stapled together do not sum to one new thing. The leaf-disease classifier (PlantVillage) actively lowers the originality score because it is the single most common agri-hackathon artefact.
- **Expected duplicates [I]:** 5-15 leaf-disease or "smart farming dashboard" entries in PS02; 1-2 using satellite data.

### 4. KINETIC — 4/10
- **Prior art [V]:** Gemini interactive 3D models and real-time simulations (reported April 2026; double-slit example with wavelength and slit sliders); Google student hub with 3D simulations (TechCrunch, Aug 2026); LivePhys (arXiv 2607.20990, LLM to intermediate representation to Matter.js); PhysTalk (LLM fills a physics-engine template); Augmented Physics (UIST 2024); Warwick AI-generated virtual lab project; a "physics-sims" LLM-generated repo.
- **Judge reaction [I]:** "Gemini does this for free." The constrained-DSL design is exactly the LivePhys/PhysTalk pattern. The knowledge constellation is a familiar skill-map trope.
- **What is not covered by prior art [I]:** a tutor that watches interaction traces inside the sim. That is the only fresh part and it is buried third in the pitch.
- **Expected duplicates [I]:** PS03 will be the most crowded track; a large share of all entries will be some "AI tutor", and several will generate visuals.
- **Wildcard:** see "Twist that would rescue KINETIC" below; with it this idea would move to roughly 6.5.

### 5. GREENWAVE — 5.5/10
- **Prior art [V]:** SUMO-RL (every signal an RL agent, OSM import); LibSignal benchmark; PPO green-corridor paper on SUMO grids plus a real layout; DQN emergency-vehicle priority repo; Meta x PyTorch OpenEnv hackathon traffic-signal environment with an ambulance penalty; an ESP32 "Green Corridor" abstract; MATLAB rl-agent-based-traffic-control; MetaTraffic/CityMap (three.js 3D browser map with learned driving, Python backend).
- **Not found [V]:** RL signal control running fully in the browser via ONNX on a 3D OSM city.
- **Judge reaction [I]:** "smart traffic lights with ambulance priority" has been a Smart India Hackathon staple for years, usually with a YOLO vehicle counter. The algorithmic idea scores 3; the zero-install, toggle-and-watch delivery lifts it.
- **Expected duplicates [I]:** 3-6 traffic entries in PS04 (it is a named sub-problem), mostly YOLO density counters with a rule-based timer; maybe one SUMO-RL video.

### 6. DELUGE — 6.5/10
- **Prior art [V]:** HydroGrid (Next Byte Hacks V3: real-time sponge-city green-infrastructure simulator with cloudburst triggers); a second HydroGrid (HackED 2026, three.js + Leaflet, stormwater planning); WebFlood (bachelor thesis, semi-Lagrangian shallow water on WebGL, Iowa City DEM); CLDNet (arXiv 2605.13761, neural surrogate of shallow-water equations for metropolitan flood twins); Next Rain (Barcelona AI Hackathon, street-segment flood sim with a what-if planner); TRACE Kampala (3D terrain + drainage before/after); Orbyfy Aqualyt (commercial flood twin).
- **Not found [V]:** browser solver + learned surrogate + budgeted intervention optimizer in one tool.
- **Judge reaction [I]:** every component exists and "place a pond, watch it drain" has been done at hackathons. The surrogate-plus-optimizer loop is what is new, and it is the part a skimming judge will not see unless it is the headline.
- **Fit risk affecting novelty [I]:** it sits off the named PS04 sub-problems, which cuts both ways: fewer duplicates (I expect 0-2 flood entries), but a strict judge may dock it.

### 7. MULEHUNT — 4.5/10
- **Prior art [V]:** FraudNets (Devfolio: GNN for circular flows and smurfing, three.js 3D network graph for investigators); RingWatch (Indian Bank Hackathon 2026: heterogeneous graph transformer, ring roles such as coordinator / relay / cash-out mule); Financial Crime Agent (FalkorDB hackathon, community detection for wash rings); "The mule that wasn't" (DEV, a mule graph model on synthetic data and its failure modes); Thoughtworks and Hawk AI write-ups.
- **Judge reaction [I]:** near-identical to FraudNets down to the rendering library. Elliptic / PaySim / IBM AML are the datasets everyone uses. 3D force graphs are a recognised "looks impressive, says little" trope.
- **Expected duplicates [I]:** 2-5 fraud-detection entries in PS05, most tabular; 0-1 graph-based.

### 8. ECHOGUARD — 3.5/10
- **Prior art [V]:** ACSA and CallerIDK (Devpost); CallPilot AI (flags "digital arrest" and OTP requests, quotes the caller's words); ScamShield AI (India AI Impact Buildathon 2026); Scam Call Shield (lablab.ai AMD hackathon); CallShield (GitHub); FraudCallDetection (Devfolio); Resemble AI's HughKnew.
- **Commercial prior art [I]:** Truecaller AI Call Scanner, Pindrop, Google's on-device scam detection in Android.
- **Judge reaction [I]:** the most front-page problem attracts the most entries. The annotated-tactics transcript is CallPilot AI's feature. Weakest visual and most duplicated concept on the list.
- **Expected duplicates [I]:** 3-8 in PS05 (phishing and deepfake detection included).

## Top 3 and the one twist each needs

### DELUGE: stop showing where the water goes; show where the flood is caused
Every prior tool, including both HydroGrids, paints depth where water ends up. The new mechanism is a **blame map**: differentiate through the neural surrogate to colour each parcel of the city by how much downstream damage one square metre of it causes. The flooded street is the victim; the paved-over lake bed two kilometres uphill is the culprit. The optimizer then reads straight off that gradient. This turns the surrogate from a speed-up (which is all CLDNet claims) into the thing that makes a new question answerable. [I: I found no prior tool doing gradient-based flood attribution in a browser, but I did not search for that specifically.]

### GREENWAVE: train on the traffic that SUMO projects assume away
Every prior project inherits SUMO's lane-disciplined, car-shaped traffic. Indian junctions are lane-less and two-wheeler-dominated, with vehicles seeping through gaps to the stop line. The twist is a **lane-free, mixed-vehicle simulator and a controller trained in it**, with the claim "published RL controllers were trained on a road that does not exist in India." Let the judge try to run Silk Board by hand first and fail, then hand over. [I: lane-free heterogeneous traffic modelling exists in transport research; I did not verify whether an RL signal controller has been trained on it.]

### PULSE: the heart is a simulation driven by your beat intervals, not an animation synced to your rate
All prior art outputs numbers. The twist is to feed the judge's beat-to-beat interval series into a small **cardiac electrophysiology model** on the 3D heart, so irregularity emerges on the mesh instead of being a triggered animation, and to replay public ground-truth AF recordings through the identical pipeline so the same heart visibly fibrillates. Reframe from "vitals monitor" to "see your rhythm." This is the weakest of the three twists: the sensing remains fully prior art, and I would not expect it to lift PULSE above 6. [I]

### Twist that would rescue KINETIC (not in my top 3 on base score)
Do not simulate the correct physics; **simulate the learner's wrong physics**. Ask the student to predict first, infer their misconception (heavier falls faster, motion needs a force), and render two universes side by side: theirs, where their rule is law and things go visibly wrong, and the real one. Gemini generates correct simulations for anyone; nothing I found generates a world governed by your specific misconception. With this as the headline KINETIC would be about 6.5 and would compete with DELUGE on originality. [I]

## New ideas that I think beat the list on originality

I am including two. Both follow the DELUGE pattern (real geodata, GPU simulation, learned model, budgeted optimizer) but in spaces where my searches found no software prior art, rather than two existing hackathon projects.

### A. AQUIFER — a see-through 3D twin of a village's shared groundwater (PS02, irrigation) — est. 7.5/10
Reframe irrigation from "schedule my field" to "we all pump from one bowl." Pick a real village; the ground becomes glass and you see every borewell as a straw into one falling water table, with the cone of depression from each pump interfering with its neighbours. An ML model forecasts the water table from public well records (CGWB / India-WRIS) plus satellite-derived crop water demand; a cooperative optimizer proposes a village crop plan and pumping calendar that keeps every well alive, and shows the year each well runs dry under business as usual. One number: years of water gained.
- **Prior art [V]:** WOTR's CoDriVE-VI does this reframing with physical, hand-built 3D models in Maharashtra village workshops, with published evidence of behaviour change (Water Policy, 2022). The search found no software, ML or web version.
- **Why it beats the list [I]:** the underground see-through view is a visual judges have not seen; the commons framing is an idea rather than a combination; an NGO having validated the physical version is a ready answer to "would anyone use this."
- **Risks [I]:** groundwater-level ML papers are plentiful, so the forecast alone is not novel; well data are sparse and coarse; a simple analytic drawdown model must carry the visuals; availability of the public well data was not checked today.

### B. PASSAGE — where should the highway let the forest through? (PS04, conservation) — est. 7/10
Take a real Indian landscape cut by a road or railway. A learned habitat model turns land cover and species records into a resistance surface; hundreds of thousands of GPU random walkers stream across 3D terrain as glowing animal movement and visibly pile up against the road. An optimizer chooses where to put a fixed number of underpasses or overpasses; you place one and watch the flow punch through.
- **Prior art [V]:** Circuitscape, Omniscape and Linkage Mapper are the established research tools; one Substack post describes Bayesian optimisation of green-crossing placement with no confirmed demo. The search found no browser, 3D or hackathon implementation.
- **Why it beats the list [I]:** conservation is a named PS04 sub-problem that almost everyone will answer with a camera-trap classifier; this is a flow-and-intervention answer with an immediate visual payoff.
- **Risks [I]:** judges may not know the domain well enough to see why it is new; validating against real roadkill or collar data in 3.5 days is hard; structurally similar to DELUGE, so do not build both.

**Ranking on originality alone:** AQUIFER 7.5 > PASSAGE 7 = DELUGE-with-blame-map about 7 > KINETIC-with-wrong-physics 6.5 = DELUGE as written 6.5. The margins are small and rest on negative search results.

## Sources (searched 12 Nov 2026)

rPPG
- https://github.com/dengbuqi/heartbeat-js-faceapi
- https://awesome.ecosyste.ms/projects/github.com%2Fprouast%2Fheartbeat
- https://sean-reid.github.io/blog/pulse.html
- https://devpost.com/software/sixth
- https://devfolio.co/projects/vibesens-3c64
- https://pi.cs.tsinghua.edu.cn/lab/people/YuntaoWang/projects/facephys/
- https://dev.to/emopulse/i-built-an-ai-that-reads-47-biometric-signals-from-your-webcam-try-it-free-413h

Diabetic retinopathy
- https://lablab.ai/submissions/zbnb0q61v5mrt68l16cxwbtp
- https://gh.hhj520.top/dbee-4/RetiSpec
- https://www.atlantis-press.com/proceedings/iccsce-25/126017326
- https://blueraymusic.github.io/Retinal

Farm twin
- https://dev.to/jinisha_bose_831d12423d6a/climate-intelligence-platform-for-small-farmers-epp
- https://akvelon.com/engineering-an-end-to-end-geospatial-prototype-with-nasa-earth-data/
- https://taikai.network/cassinihackathons/hackathons/space-for-water/projects/cmoe27glw00kvfndpr83xrtit/idea
- https://contra.com/p/BPcBYLcr-farm-verse-3-d-is-an-interactive
- https://eolab.geographie.hu-berlin.de/research_projects/eoagritwin/
- https://www.esa.int/Enabling_Support/Preparing_for_the_Future/Discovery_and_Preparation/Creating_Earth_s_pixel_twins_for_smart_farming

Text-to-simulation tutoring
- https://chromeunboxed.com/googles-gemini-just-got-a-massive-upgrade-with-interactive-3d-models-and-simulations/
- https://techcrunch.com/2026/08/19/google-launches-new-study-tools-for-students-across-search-and-gemini/
- https://arxiv.org/pdf/2607.20990
- https://arxiv.org/pdf/2512.24986
- https://abvx.substack.com/p/physics-simulations-are-what-vibe

Traffic RL
- https://pyshine.com/SUMO-RL-Reinforcement-Learning-Traffic-Simulation/
- https://www.scitepress.org/Papers/2022/110403/110403.pdf
- https://arxiv.org/pdf/2008.00335
- https://awesome.ecosyste.ms/projects/github.com%2Fharshramani00%2Ftrafficsignaloptimizationforsmartcitiesusingdeep-reinforcementlearning
- https://huggingface.co/Nas0877676/MetaEnv
- https://github.com/TensorCraft/CityMap
- https://arxiv.org/pdf/2206.11996

Flood
- https://github.com/yaf7/hydrogrid
- https://gh.r-mj.com/Sadat41/HydroGrid
- https://gh.r-mj.com/aeplay/WebFlood
- https://arxiv.org/pdf/2605.13761
- https://contra.com/p/mXL3BNUl-next-rain-4th-of-29-at-the-barcelona-ai-hackathon
- https://trace-ug.pages.dev/

Fraud graphs
- https://devfolio.co/projects/fraudnets-9b2d
- https://github.yxlr123.workers.dev/ThelastC0debenders/Intellitrace-Hack
- https://dev.to/shaktieighteen/financial-crime-agent-461b
- https://dev.to/gbadedata/the-mule-that-wasnt-a-graph-model-synthetic-data-and-the-accounts-that-broke-it-2cn8

Scam calls
- https://devpost.com/software/acsa
- https://devpost.com/software/caller_idk
- https://dev.to/manohar_paturi_2e0c6213f4/callpilot-ai-5b1m
- https://huggingface.co/spaces/Gankit12/scam/blob/main/Docs/Doc.md
- https://lablab.ai/ai-hackathons/amd-developer-hackathon-act-ii/team-hsa/scam-call-shield
- https://devfolio.co/projects/fraudcalldetection-application-2d36

New ideas
- https://wotr.org/participatory-3d-modelling-an-approach-to-sustainable-water-management/
- https://www.indiawaterportal.org/climate-change/disasters/making-invisible-visible
- https://circuitscape.org/
- https://petedonhurley.substack.com/p/ecological-connectivity
