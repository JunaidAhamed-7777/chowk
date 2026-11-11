# Round 2 — Originality: AQUIFER vs GREENWAVE

Lens: originality and innovation only. Goal: disprove both novelty claims with prior art.
Date: 12 Nov 2026. Searches from round 1 ([judge-1-originality.md](judge-1-originality.md)) were not repeated.

## How to read this

- **[V]** = I saw it in a search result or fetched page today. Search summaries are second-hand; where I only saw a summary and not the page itself I say so.
- **[I]** = inference or background knowledge, not checked today.
- "Not found" = several targeted searches did not surface it. Weak evidence of absence.

## Verdict

| Concept | Round 1 | Round 2 | Change |
|---|---|---|---|
| AQUIFER | 7.5 (est.) | **6.5** | Down 1. Every component now has named prior art; only the combination survives. |
| GREENWAVE | 5.5 | **5.0** | Down 0.5. The "nobody trained RL on lane-free Indian traffic" claim is false. |

AQUIFER is still the more original concept, by about **1.5 points**, not the 2 that round 1 implied. The gap is real but narrower, and it now rests on one specific thing: nobody was found putting a physics-based shared aquifer, a real village layout, a cooperative optimiser and a see-through 3D view in one interactive piece.

## 1. AQUIFER — prior art hunt

Round 1 said "the search found no software, ML or web version" of the groundwater-commons reframing. That is wrong. There are several.

### Kill-shot candidates

| Prior art | What overlaps | What does not | Status |
|---|---|---|---|
| **MARVI groundwater game** (marvi.org.in/game) | A digital game for Indian villages: "one shared well", a whole village on one aquifer, players choose high / moderate / low-water crops, "watch the watertable", can the village last five years after monsoon. This is AQUIFER's first-interaction beat and its commons framing, from an Indian field project. | Page shows no 3D, no flow physics, no cones of depression, no real village layout, no optimiser or forecast. | [V] fetched page. Platform and visuals not stated on the page; a second search did not find independent coverage. |
| **FES / IFPRI / Arizona State groundwater game** (Meinzen-Dick, Janssen et al.) | Crop choice between thirsty-profitable and frugal crops, game ends if the water table falls below a threshold, with and without communication (i.e. selfish vs cooperative). Played in 17 Andhra Pradesh villages in 2013-14; more villages adopted water rules afterwards. Published in Ecology and Society (2016) and World Development (2018). FES lists "Experimental Game" and "Crop Water Budgeting" as India Observatory tools. | Facilitated field game, not a simulator; no spatial aquifer, no 3D, no optimiser. | [V] |
| **Groundwater Commons Game** (Castilla-Rho et al., Nature Human Behaviour 2017; code on CoMSES) | Agent-based farmers coupled to a finite-difference groundwater flow solver (FlowLogo), cooperation vs defection, run for the Punjab aquifer among others. This is AQUIFER's simulator-plus-commons architecture, published and open source. | NetLogo desktop research model, 2D, regional scale, social-norm dynamics instead of an optimiser, not built for a lay viewer. | [V] |
| **AquiPulse** (AWS Bharat Builds "Environmental Hacks", Oct 2026) | A hackathon team one month ago: India borewells, a 2D unconfined groundwater PDE, an "aquifer digital twin" with a live dashboard, each well's marginal damage to neighbours computed by adjoint. Same aquifer model class, same country, same season of hackathons. | Sensing-and-payments product (motor telemetry, cash bonuses, DISCOM console); no 3D subsurface view described, no crop planning, commons framing not explicit. | [V] fetched write-up; self-reported. |
| **AquiferLab** (TypeScript + three.js, GPL) | Browser 3D aquifer with pumping wells, hydraulic head and drawdown, scenario comparison, no install. This is the "see-through twin" rendering idea, already shipped. | Steady-state confined aquifer teaching tool; no village, no crops, no commons, no optimiser. | [V] via a search summary of the author's LinkedIn post; demo not opened. |
| **Cooperative vs non-cooperative pumping and cropping models** (Oman coastal aquifer ABM; Sahu et al., Water Resources Research 2021; Ogallala game-theory model) | The optimiser's headline comparison, "cooperative plan vs everyone for themselves", with optimal crop and withdrawal strategies and a computed value of cooperation. | Academic papers, not interactive, not Indian villages. | [V] search summaries. |

### Supporting prior art (weakens individual parts)

- **Village water budgeting tools [V]:** FES Crop Water Budgeting, CLART, Groundwater Monitoring Tool; CoRE Stack's Commons Connect (Android, groundwater stress per micro-watershed, field-tested in Bhilwara, Dumka, Gujarat); Jaltol; NITI Aayog block water budgeting app; MyWell (MARVI, villager-collected well levels). The "NGO facilitator runs a village water-budget meeting with an app" user story is occupied.
- **Groundwater ML forecasting for India [V]:** Malakar et al. 2021 (LSTM on 5,367 CGWB wells), Udupi district LSTM, several others. Confirms the concept doc's own admission that the forecast is not novel.
- **Indian hackathon groundwater entries [V]:** "Levels" (Smart India Hackathon 2020 first prize, national groundwater-level dashboard); Borewell Ledger and BoreWise (both AWS environmental hackathon 2026, borewell monitoring with neighbour comparison). Borewell projects are a current hackathon theme, not an empty field.
- **Other commons games [V]:** EDF/IGRAC Groundwater Game (spreadsheet plus app), ETH/ZHdK "Save the Water" (includes a browser game, built for Chinese farmers), Irrigania, Bogazici groundwater appropriation simulation game.
- **Physical version [V, round 1]:** WOTR CoDriVE-VI.

### What survived

Not found in any search: a single interactive piece that (a) runs transient flow physics with interfering cones of depression, (b) on a real village's well and crop layout, (c) rendered as a cutaway transparent 3D subsurface, (d) with a cooperative crop-and-pumping optimiser toggled against business as usual. Also not found: any Devpost/Devfolio/SIH entry with a 3D underground view of a village aquifer.

### Strongest "seen it" objection

"MARVI already has a shared-well crop-choice game for Indian villages, FES and IFPRI ran the same game in 17 Andhra Pradesh villages and published it, and Castilla-Rho coupled farmer agents to a groundwater flow model for Punjab in 2017. You have added three.js." Sources: marvi.org.in/game; Meinzen-Dick et al. 2016/2018; Castilla-Rho et al. 2017.

This objection is fair against the idea and unfair against the artefact. A judge who knows the water sector will make it; most hackathon judges will not know any of these [I].

### Score: 6.5 / 10

The commons framing is not an original idea; it is the standard framing in Indian groundwater governance, with at least two digital or field games built on it. The originality is now entirely in the synthesis and the visual. That is the same kind of novelty DELUGE had in round 1 (6.5), and AQUIFER should not score above it.

## 2. GREENWAVE — is the lane-free twist rare?

No. It is an active, named research line with Indian groups publishing on it. It is less crowded than generic RL signal control, but "published RL controllers were trained on a road that does not exist in India" cannot be said.

### Kill-shot

**Nandakumar, Banerjee, Vanajakshi, "Reinforcement Learning Based Traffic Signal Design to Minimize Queue Lengths", arXiv 2509.21745 (Sept 2025) [V, fetched abstract page].**
- PPO signal control evaluated on a "laneless, heterogeneous (LLHE) intersection" and on a lane-based homogeneous one.
- Releases a laneless, heterogeneous-vehicle SUMO framework with RL signal control.
- Results: about 15-23% lower queue than Dynamic Webster on the lane-based site, 66-73% lower on the laneless heterogeneous site.

That last line is GREENWAVE's planned headline ("the gap to classical control widens in mixed traffic"), already measured and published. Vanajakshi is at IIT Madras [I; the page did not state affiliation].

### Other prior art

| Prior art | Overlap | Gap | Status |
|---|---|---|---|
| **Agarwal et al., arXiv 2406.19305**, hybrid Max Pressure + RL for heterogeneous traffic | Indian intersection (Ludhiana video counts), SUMO, benchmarked against actuated, CoSiCoSt and max pressure. A max-pressure-plus-RL hybrid is also GREENWAVE's stated fallback controller. | Whether it uses SUMO's sublane model or an area-based state was not confirmed. | [V] search summary; my direct fetch of the arXiv ID failed to return readable text. |
| **FrugalLight** (Chauhan and Sen, IIT Delhi) | Deep RL intersection control for non-lane-based heterogeneous traffic, driven by per-approach **density** instead of vehicle counts, with a 40-day New Delhi dataset and public code. Density-not-counts is close to GREENWAVE's "occupied road area" observation. | Single intersection, focus on cheap sensing; simulator not confirmed. | [V] search summary. |
| **CoSiCoSt** (C-DAC), deployed as Bengaluru B-ATCS, Hyderabad, Bhubaneswar | An adaptive controller designed for lane-free heterogeneous Indian traffic is already on the street in the very city GREENWAVE models. "Controllers assume lanes" is false for India's own deployed system. | Not RL. | [V], sources partly promotional. |
| **SmartMARL** (GitHub) | Multi-agent RL on a 5x5 SUMO grid with an Indian mix (45% motorcycles, 15% autos) and "non-lane-disciplined lateral behavior"; reports a larger gain on Indian traffic than on standard traffic. | Unreviewed README seen via a mirror. | [V], low confidence. |
| **BanTRel** (Hugging Face, 2026) | PPO on a Bangalore intersection with cars, motorcycles, auto-rickshaws. | Lane-based, single junction, fixed-time baseline only. | [V] fetched. |
| Intel DevMesh "Smart Traffic Signals in India using Deep RL"; Chaudhuri et al. Bengaluru DQN/A2C; Thamilselvam et al. (IIT Hyderabad) coordinated heterogeneous control | More Indian RL/adaptive signal work. | Mostly lane-based. | [V] search summaries. |
| Lane-free simulators: cellular-automata signalised intersection with seepage (Singh and Rao, 2024), HetroTraffSim, TraffiSim "India Mode" (Python) | Lane-free two-wheeler seepage to the stop line is a modelled, published behaviour. | Not browser, not RL. | [V] search summaries. |

### What survived

- Not found: a lane-free heterogeneous micro-simulator written for the browser, with the policy running live client-side. All prior work is SUMO or Python.
- Not found: an explicit "occupied road area per approach" observation (FrugalLight's density is the nearest).
- Not found: a multi-junction corridor with a shared policy on lane-free traffic that is peer reviewed (SmartMARL claims it, unreviewed).

So the science is prior art and the packaging is new. That is exactly where round 1 left GREENWAVE before the twist was added.

### Strongest "seen it" objection

"IIT Madras published PPO signal control on a laneless heterogeneous intersection in 2025, released the SUMO framework, and already showed the gain is bigger than on lane-based traffic. C-DAC's CoSiCoSt handles lane-free traffic in Bengaluru today." Sources: arXiv 2509.21745; CoSiCoSt / B-ATCS.

### Score: 5.0 / 10

The twist was supposed to lift GREENWAVE from 5.5 toward 7. Instead it is a known research topic with the headline result already published, and traffic remains the most duplicated PS04 sub-problem [I]. The browser-native lane-free simulator is a real engineering novelty and keeps it from dropping further.

## 3. Which would a judge find more original?

AQUIFER, by about 1.5 points (6.5 vs 5.0).

- A generalist judge sees "RL traffic lights" as a category they have seen many times, whatever the twist; they have probably never seen under a village [I].
- A specialist judge can sink either one with a named source. For GREENWAVE the source refutes the central claim. For AQUIFER the sources refute the idea's newness but none of them looks like the artefact.
- Risk to the margin: I did not open the MARVI game or AquiferLab demos. If the MARVI game turns out to render a spatial aquifer with wells, AQUIFER drops to about 6.

## 4. Honest framing that maximises AQUIFER's perceived novelty

> Groundwater games already teach Indian villages that they share one aquifer; AQUIFER is the first we could find that runs the physics on a real village's wells, lets you see through the ground to watch each pump pull its neighbours' water down, and computes the crop plan that keeps every well alive.

Rules for using it:
- Name MARVI, FES/IFPRI and WOTR as the work it builds on. Citing them turns the kill-shot into evidence of demand.
- Say "the first we could find", never "the first".
- Do not claim the commons framing, the forecast, or the flow model as new. Claim the combination and the view.

## If GREENWAVE is chosen anyway

Drop "RL controllers were trained on a road that does not exist in India." Replace with: "Lane-free RL signal control has been studied in SUMO (IIT Madras 2025); this is the first version we could find that runs entirely in a browser, on a corridor, where you can watch and break it." Cite arXiv 2509.21745 and CoSiCoSt on the results page.

## Sources (searched 12 Nov 2026)

AQUIFER
- http://marvi.org.in/game/
- https://www.ifpri.org/blog/world-water-week-experimental-games-spark-community-cooperation-groundwater-india
- https://doaj.org/article/29767afa67fe4641b3461d5b2fa9184c
- https://econpapers.repec.org/RePEc:eee:wdevel:v:107:y:2018:i:c:p:40-53
- https://comses.net/codebases/5634
- https://builder.aws.com/content/3KVevqdtASx2icQ8NIEuMIk3Uvt/aquipulse-listening-to-the-electrical-heartbeat-of-30-million-pumps-to-save-indias-aquifers-on-aws
- https://pe.linkedin.com/in/jimmy-vasquez-ochoa (AquiferLab)
- https://squ.elsevierpure.com/en/publications/the-value-of-cooperation-in-coastal-aquifer-management-lessons-fo
- https://pure.iiasa.ac.at/id/eprint/17787/
- https://arxiv.org/pdf/1607.02376
- https://core-stack.org/enhancing-water-security-in-rural-india-with-digital-tools-insights-from-field-testing/
- https://geospatialworldforum.org/2023/presentation/Climate-and-Disaster-Resilience/Increasing-Climate-Disaster-Resilience-with-Geospatial-Technologies-Chiranjit_Guha.pdf
- https://medium.com/centre-for-social-and-environmental-innovation/our-vision-for-jaltol-cded167c73e
- https://www.x-mol.com/paper/1385747007939829760 (Malakar et al. 2021)
- https://github.com/mahajanhrishikesh/Levels
- https://github.com/Pratik01-Techi/borewell-ledger
- https://github.com/omkar281006/bore-well-
- https://www.edf.org/ecosystems/groundwater-game
- https://ceur-ws.org/Vol-2359/paper23.pdf (Save the Water)

GREENWAVE
- https://arxiv.org/abs/2509.21745
- https://bohrium.dp.tech/paper/arxiv/2406.19305
- https://www.cse.iitd.ac.in/~rijurekha/papers/jcss24.pdf (FrugalLight)
- https://indianinfrastructure.com/2026/04/06/smart-mobility-a-case-study-of-the-bengaluru-adaptive-traffic-control-system/
- https://1clonegithubbyxjn.1934672944.workers.dev/shivamsingh190103/SmartMARLResearchPaper
- https://huggingface.co/BJyotibrat/BanTRel-v1.0.0
- https://devmesh.intel.com/projects/smart-traffic-signals-in-india-using-deep-reinforcement-learning-and-advanced-computer-vision
- https://people.iith.ac.in/~subruk/pdf/comsnets.pdf
- https://journals.sagepub.com/doi/10.1177/03611981231211317
- https://pypi.org/project/TraffiSim/0.1.1
