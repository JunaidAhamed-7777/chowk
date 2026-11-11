# Judge 3 — Real-World Impact and Problem-Statement Fit

Lens: is the problem real and large, who exactly uses this, would they adopt it, is the claimed benefit credible and measurable. Visual wow is ignored here except where it helps or hurts credibility.

## How to read the evidence labels

- **[V]** = I found this figure in a web search on 12 Nov 2026 and the link is given. Most links are news coverage of the primary source, not the primary document itself; check the primary before quoting in a submission.
- **[I]** = my inference or recollection, not verified by search in this session. Do not cite without checking.
- Searches that returned nothing usable are stated as such.

## Score table

| # | Idea | PS | Impact | PS fit | Credibility trap |
|---|------|----|:-----:|:-----:|------------------|
| 7 | MULEHUNT | PS05 | 7 | 10 | Synthetic data; RBI already ships a tool with nearly the same name |
| 8 | ECHOGUARD | PS05 | 7 | 10 | A browser tab cannot sit inside a phone call; deepfake detectors generalise badly |
| 5 | GREENWAVE | PS04 | 6 | 10 | Sim-to-real; beating a fixed timer is a strawman |
| 3 | TERRA | PS02 | 6 | 10 | Water savings are modelled, not measured; farmer is not the real user |
| 2 | FUNDUS | PS01 | 6 | 10 | Already solved and deployed commercially; needs a fundus camera |
| 6 | DELUGE | PS04 | 7 | 5 | Off the named sub-topics; hydrology validity |
| 4 | KINETIC | PS03 | 4 | 9 | Learning gains unprovable in 3.5 days; LLM wrapper suspicion |
| 1 | PULSE | PS01 | 4 | 8 | Medical claim from a webcam; AF is rare in India; cheap devices already exist |

Ties are broken on "can the benefit be measured against a public benchmark in 3.5 days".

---

## 1. PULSE — camera-only vitals (PS01)

**User and moment.** The doc names three (ASHA worker, telemedicine patient, elderly at home) and that is the problem: three users means none. The only one that survives scrutiny is a telemedicine patient at home with no device, on a video call, where the doctor wants a pulse rate. An ASHA worker is the weakest of the three: a fingertip pulse oximeter gives a better heart rate than any webcam and costs a few hundred rupees [I].

**Problem size.**
- About 30% of Indian adults have hypertension [V] (LASI/NFHS-5 as cited in https://sage.cnpereading.com/doi/10.1177/26324636251411695). NFHS-5 analysis: of those with hypertension only about 1 in 3 are diagnosed, fewer than 1 in 5 treated, 1 in 11 controlled [V] (https://medrxiv.org/content/medrxiv/early/2023/06/05/2023.06.02.23290909.full.pdf).
- AF prevalence in Indian community studies is low: roughly 0.1%–1.6% of adults, about 5% in older rural adults [V] (same Sage review; rural Gujarat screening 5.1%, https://pubmed.ncbi.nlm.nih.gov/27737818/; Nagpur 0.19%, https://www.umassmed.edu/rahi-sathi/rahi/smart-india/).
- Global: WHO's 2023 hypertension report says close to half of hypertensive adults are unaware [I — search did not return the WHO document].

**Unsupported or exaggerated claims in the doc.** "Screening where there are no devices" is the inflated claim. The large undiagnosed burden is hypertension, and rPPG does not measure blood pressure credibly. The condition PULSE can plausibly flag (irregular rhythm) is uncommon in the target population, so positive predictive value at 0.2%–1.6% prevalence will be dismal even with a good classifier. A rhythm classifier "trained on public PPG arrhythmia data" is trained on contact PPG, not facial video; transfer is asserted, not shown. I found no facial-video AF study in search.

**PS fit.** "Early disease detection and accessible healthcare" — on-topic, but heart rate is a vital sign, not a disease detection. The AF flag is what makes it literal fit, and that is the least defensible part. 8.

**Credibility trap and defusal.** Medical claim from a consumer webcam, plus known skin-tone and lighting sensitivity of rPPG [V] (https://pmc.ncbi.nlm.nih.gov/articles/PMC9039683). Defuse by: stating "not a medical device, wellness-grade pulse estimate"; reporting MAE on UBFC-rPPG against the published classical baselines (POS/CHROM MAE reported between about 2 and 8 bpm depending on protocol; a constant-75-bpm predictor scores 13.7 [V], https://arxiv.org/pdf/2012.15846 and https://arxiv.org/pdf/2206.12558); showing a signal-quality gate that refuses to output a number in bad light; dropping or heavily caveating the AF flag.

**Honest quantified statement.** "Heart rate within X bpm MAE of a fingertip oximeter on the 42 UBFC-rPPG subjects, running entirely in the browser; refuses to report when signal quality is below threshold." Experiment: run the in-browser pipeline on UBFC-rPPG videos offline, report MAE, RMSE and the percentage of windows rejected.

**Scores.** Impact 4, PS fit 8.

---

## 2. FUNDUS — diabetic retinopathy on a 3D eye (PS01)

**User and moment.** An optometrist or technician at a vision centre or diabetes clinic who has just captured a fundus photo and must decide refer or not. That user is real. The user is not the judge, not the patient, and not anyone without a fundus camera.

**Problem size.**
- 101.3 million people with diabetes in India, 11.4% prevalence, plus 136 million prediabetic (ICMR-INDIAB, Lancet Diabetes & Endocrinology 2023) [V] (https://www.downtoearth.org.in/news/health/india-s-diabetes-epidemic-just-got-more-grim-lancet-report-reveals-why-89946). Caveat found in coverage: figures are extrapolations to 2021 from survey rounds.
- National DR survey 2015–19 (63,000 people aged 50+, 21 districts): DR in 16.9% of people with diabetes, sight-threatening DR in 3.6% [V] (https://dspace.uohyd.ac.in/items/012943c0-022e-438b-890a-33c0314e81a0/full).
- Ophthalmologist density: commonly quoted as roughly 1 per 100,000 or worse in rural areas [I — search returned no figure; do not cite without a source].

**Unsupported or exaggerated claims.** "~100M diabetics" is supported. "Few ophthalmologists" is true in spirit but unsourced in the doc. The implied claim that this entry would change screening is the exaggeration: autonomous DR grading is one of the most commercially mature medical AI categories, with regulator-cleared products and Indian deployments [I]. A Kaggle-data classifier adds no impact over what exists. The 3D eye adds nothing a clinician needs; a 2D heatmap on the fundus image is what they read.

**PS fit.** Textbook. 10.

**Credibility trap and defusal.** Regulatory (this is a diagnostic claim), dataset shift (APTOS is one hospital network's cameras), and "who needs another one". Defuse by: positioning as a referral triage aid, not diagnosis; reporting referable-DR sensitivity/specificity on a held-out external set (train on APTOS, test on IDRiD or Messidor-2) rather than in-distribution accuracy; including an image-quality reject option.

**Honest quantified statement.** "Referable-DR sensitivity X% at specificity Y% on an external dataset the model never saw, with Z% of images rejected as ungradable." Experiment: cross-dataset evaluation, quadratic weighted kappa plus sensitivity at a fixed 90% specificity operating point.

**Scores.** Impact 6 (large real problem, low marginal contribution), PS fit 10.

---

## 3. TERRA — 3D farm digital twin (PS02)

**User and moment.** Not the smallholder: a farmer with about a hectare [I — 1.08 ha average holding from Agriculture Census 2015-16 not returned by search] does not draw polygons on a web map. The real user is an FPO agronomist, agri-input field officer or extension worker checking 50–200 member plots weekly to decide which to visit and what irrigation advice to push. Say that explicitly.

**Problem size.**
- India has the world's highest agricultural water withdrawal, 688 billion cubic metres [V] (https://www.downtoearth.org.in/water/688-billion-cubic-metres-india-s-water-withdrawals-for-agriculture-is-the-highest-in-the-world-60967). Agriculture's share of withdrawals is variously 78% (NCAER 2025) to 90% (World Bank/AQUASTAT series) [V] (https://ncaer.org/wp-content/uploads/2025/06/NCAER-WP-182-June-2025.pdf). Groundwater supplies about 63% of irrigation [V] (same search set, idronline/IndiaWaterPortal).
- Global: FAO estimates up to 40% of crop production lost to pests and diseases each year, plant diseases costing over USD 220 billion [V] (https://www.weforum.org/stories/2021/06/climate-change-insects-pests-crops-agriculture/). Note the "up to".
- Irrigation scheduling in north-west India wheat could cut water use by about 40% — this is only a headline/URL slug from IndiaWaterPortal, I did not read the study [V headline only] (https://www.indiawaterportal.org/amp/story/agriculture/saving-water-without-sacrificing-wheat-how-better-irrigation-scheduling-could-cut-water-use-by-40-in-north-west-india).

**Unsupported or exaggerated claims.** "Water savings are quantifiable" — they are computable from a model, which is not the same as measured. No field, no flow meter, no claim. "Covers all three sub-problems" is a fit argument, not an impact argument; three shallow modules impress nobody who knows the domain. A PlantVillage-trained leaf classifier is known to collapse on real field photos [I]; pinning it on a twin does not fix that.

**PS fit.** Names crop monitoring, disease detection and smart irrigation verbatim. 10.

**Credibility trap and defusal.** Modelled savings presented as real; Sentinel-2 at 10 m gives roughly 100 pixels per hectare, marginal for per-zone advice on small plots; flood-irrigated smallholders cannot act on "per-zone" schedules. Defuse by: using FAO-56 crop-water balance by name; stating savings as "modelled against a stated baseline practice"; backtesting the stress detector on a real documented event; cutting the leaf classifier or testing it on a field dataset (PlantDoc) and reporting the honest number.

**Honest quantified statement.** "On N real fields over the 2025 season, the stress detector flagged the documented dry spell/pest event M days before peak NDVI loss; the FAO-56 schedule applies X% less water than a fixed-interval calendar under the same observed weather (modelled)." Experiment: pick fields in a district with a publicly reported drought or pest outbreak, run the detector retrospectively on Sentinel-2 time series, and compare modelled irrigation depth against a fixed-calendar baseline.

**Scores.** Impact 6, PS fit 10.

---

## 4. KINETIC — AI tutor that builds 3D simulations (PS03)

**User and moment.** A Class 9–12 science student doing homework on a phone or school lab PC, stuck on a concept, in a school with no lab. Possibly a teacher projecting a sim in class. Plausible but the phone/bandwidth/English/LLM-cost assumptions all cut against the "lab-less school" user specifically.

**Problem size.**
- UDISE+ 2025-26: 57.6% of schools with secondary sections have an integrated science lab, so about 42% (roughly 125,000 schools) do not [V] (https://educationforallinindia.com/integrated-science-laboratories-in-secondary-schools-in-india-udise-2025-26/).
- ASER 2024: only 45.8% of rural Class 8 students can do a division problem [V] (https://www.millenniumpost.in/big-stories/aser-2024-reading-arithmetic-skills-improve-among-class-3-and-5-students-led-by-govt-schools-596643).
- Global figure: none searched. World Bank "learning poverty" (about 70% in low- and middle-income countries) is from memory [I].

**Unsupported or exaggerated claims.** "Lab-less schools" is supported as a gap, but the ASER number undercuts the pitch: the binding constraint for those students is foundational numeracy, not orbital mechanics visualisation. "Learning by doing rather than reading" implies a learning gain that the project cannot demonstrate. Free curated simulations already exist (PhET and similar) [I]; the claimed increment is generation on demand, whose value is unproven.

**PS fit.** "Personalized learning and intelligent tutoring systems" — on-topic if the tutor and knowledge tracing are real. If the demo is mostly "type prompt, get sim", a strict judge calls it content generation, not tutoring. 9.

**Credibility trap and defusal.** No learning-outcome evidence; generated sims that are physically wrong teach misconceptions; public demo depends on a paid LLM. Defuse by: claiming only what is measured (sim correctness, misconception detection accuracy); verifying each generated sim against analytic solutions and showing the pass rate; fixing the scope to one curriculum unit (say NCERT Class 9 motion and gravitation) and saying so.

**Honest quantified statement.** "Of 100 held-out curriculum questions, X% produce a simulation that passes automated physics checks (energy conservation, analytic trajectory within 1%); the misconception detector identifies the scripted misconception in Y% of synthetic interaction traces." Experiment: fixed question set, automated verifier, scripted "wrong student" traces. A 10-person pre/post quiz is anecdote, label it as such.

**Scores.** Impact 4, PS fit 9.

---

## 5. GREENWAVE — RL traffic signals (PS04)

**User and moment.** A traffic engineer at a city traffic management centre (Bengaluru Traffic Police, a Smart City SPV) evaluating a signal-timing plan for a corridor before deploying it. Secondary: the ambulance dispatcher. This user exists and already buys adaptive signal systems, which is both validation and competition.

**Problem size.**
- TomTom 2024: Bengaluru averages 34 min 10 s per 10 km, 117 hours lost per year in rush hour; Kolkata 34 min 33 s [V] (https://www.deccanherald.com/amp/story/india%2Fno-city-of-joyride-kolkata-pips-bengaluru-as-indias-most-congested-city-in-2024-3351811).
- Real deployment precedent: Bengaluru's adaptive signal system (BATCS, 169 junctions in phase 1) is reported by the Traffic Commissioner to cut travel time 15–20%; the vendor says up to 25%; a headline says 33% [V] (https://www.deccanherald.com/amp/story/opinion/how-bengaluru-rewired-its-traffic-signals-to-beat-gridlock-3832080, https://indianinfrastructure.com/2026/04/06/smart-mobility-a-case-study-of-the-bengaluru-adaptive-traffic-control-system/). The spread of 15% to 33% for the same system is itself a lesson about inflated claims.
- Congestion cost in rupees or a global figure: not searched; the often-quoted "USD 22 billion a year for four Indian metros" is from memory [I].

**Unsupported or exaggerated claims.** "Congestion cost, emissions, ambulance response time; side-by-side numbers" — every one of these numbers will come from the team's own simulator with the team's own demand, so they are illustrative, not evidence. CO2 counters derived from a toy emission factor are decoration. "Watch queues dissolve" against a fixed timer is a strawman: the city already runs adaptive control at these junctions.

**PS fit.** "Traffic optimization" is in the PS text verbatim. 10.

**Credibility trap and defusal.** Sim-to-real, and Indian traffic specifically: lane-less, two-wheeler dominated, which a car-following micro-sim does not capture. Defuse by: comparing against a strong non-learning baseline (actuated or max-pressure control), not just fixed time; validating on a public benchmark network (RESCO/SUMO scenarios or CityFlow datasets) in addition to the home-grown sim; calibrating demand to published junction counts; reporting results over many random seeds and demand levels including the cases where RL loses; stating plainly "simulation result; real BATCS deployment reports 15–20%".

**Honest quantified statement.** "On the [benchmark] network, our controller reduces mean delay by X% versus fixed-time and Y% versus max-pressure, averaged over 20 seeds and three demand levels; emergency-vehicle traversal time falls by Z% with pre-emption." Experiment: the seeded benchmark sweep, with the table in the README and the same policy running live in the browser.

**Scores.** Impact 6, PS fit 10.

---

## 6. DELUGE — AI flood twin (PS04)

**User and moment.** A stormwater or urban planning engineer at a municipal corporation (or a consultant to one) comparing drainage interventions for a ward before a budget cycle. Real user, real moment, but one who will not trust a 30 m DEM and no drain network.

**Problem size.**
- World Bank (July 2025, "Towards Resilient and Prosperous Cities in India"): pluvial urban flood losses about USD 4 billion a year now, about USD 5 billion by 2030, USD 14–30 billion by 2070 without adaptation [V] (https://www.worldbank.org/en/news/press-release/2025/07/22/india-has-a-critical-opportunity-to-drive-resilient-urban-development-says-new-world-bank-report, https://scroll.in/latest/1084795/indian-cities-may-create-70-of-new-jobs-by-2030-likely-to-lose-5-billion-to-floods-yearly-study).
- Chennai 2015: economic loss USD 2.2 billion (Swiss Re) to USD 3–3.5 billion (Aon, Munich Re) [V] (https://www.business-standard.com/article/news-ians/chennai-floods-caused-economic-loss-of-2-2-bn-study-116033000930_1.html).
- Bengaluru 2022 loss figure: search returned nothing; do not cite one [not verified].

**Unsupported or exaggerated claims.** "Annual disaster" is supported. "Planners lack fast what-if tools" is unsourced; commercial and open hydrodynamic tools exist, the gap is data and capacity, not solver speed [I]. "Shows people and roads spared" is a headline number generated from an unvalidated model on coarse terrain and will read as invented. Urban flooding in Indian cities is driven by blocked and undersized drains and encroached lakes, none of which a DEM-plus-buildings model sees.

**PS fit.** This is the stretch of the set. The PS lists waste management, traffic optimization, environmental conservation. A literal reader finds none of them here. "Smart Cities & Sustainability" in the title gives cover, and nature-based interventions (trees, ponds, permeable paving) can be argued as conservation, but you are spending your opening sentences arguing eligibility while competitors spend theirs on impact. 5.

**Credibility trap and defusal.** Hydrology validity. Defuse by: validating the solver on a standard analytic/benchmark case; hindcasting one real event and comparing predicted extent against a published inundation map (satellite-derived extent for Chennai 2015 or Bengaluru 2022); reporting surrogate-versus-solver error; calling the output "screening-level" and listing what is not modelled (subsurface drains).

**Honest quantified statement.** "The surrogate reproduces the full solver's flood depth with X cm RMSE at 1000x speed; on the [event] hindcast, predicted flooded area overlaps the observed extent with IoU Y." Experiment: one hindcast against a public flood-extent product plus a held-out surrogate test set.

**Scores.** Impact 7, PS fit 5.

---

## 7. MULEHUNT — fraud rings via temporal GNN (PS05)

**User and moment.** A fraud-operations or AML analyst at a bank or payment aggregator, working an alert queue, who needs to decide which accounts to freeze before the money hops again. Institutional buyer with budget and a regulator pushing them.

**Problem size.**
- Indians lost Rs 22,845 crore to cyber fraud in 2024, up 206% on 2023; 36.4 lakh financial fraud complaints [V] (government reply in Parliament, https://scroll.in/latest/1084796/indians-lost-rs-22845-crore-to-cyber-fraud-in-2024-a-206-rise-from-previous-year-centre).
- Mule accounts: about 4.5 lakh frozen in the year to Nov 2024; over 19 lakh flagged by Feb 2025; 24.67 lakh shared by banks per May 2026 coverage [V, secondary sources, different measures] (https://www.business-standard.com/india-news/centre-freezes-450-000-mule-bank-accounts-used-in-cyber-fraud-schemes-124111200320_1.html).
- RBI Annual Report 2024-25: bank frauds Rs 36,014 crore, but the tripling is largely a reclassification of 122 old cases, and RBI says amount involved is not loss [V] (https://www.business-standard.com/finance/news/bank-fraud-amount-triples-in-fy25-despite-drop-in-number-of-cases-rbi-125052900696_1.html). Do not use this number as "fraud tripled".
- Global figure: not searched. UNODC's "2–5% of global GDP laundered" is from memory [I].

**Unsupported or exaggerated claims.** "Banks miss rings because they score transactions individually" is overstated and a knowledgeable judge will know it: the RBI Innovation Hub built MuleHunter.AI for exactly this and 23–26 banks had adopted it by early 2026 [V] (https://business-standard.com/finance/news/rbi-asks-banks-to-collaborate-with-mulehunter-ai-to-find-mule-accounts-124120600623_1.html and LoansJagat/AMLegals coverage). That validates the problem but kills "nobody does this". Also the name: MULEHUNT is one suffix away from RBI's MuleHunter.AI. Rename, or it looks like a clone or, worse, like passing off. "Caught mid-flight" and "freeze the funds" imply real-time interdiction that a replayed dataset cannot show.

**PS fit.** "Fraud detection" is the first item in the PS text. 10.

**Credibility trap and defusal.** Synthetic data (PaySim, IBM AML) and no path to real bank data. Defuse by: leading with Elliptic, which is real labelled Bitcoin transaction data, and using IBM AML for ring-pattern recall because it has labelled laundering typologies; comparing against a strong per-transaction tabular baseline (gradient boosting) on a temporal split; reporting at an analyst-realistic operating point (precision in the top-k alerts), not accuracy or AUC on a 99.9% negative class; saying outright that no Indian UPI data was used.

**Honest quantified statement.** "On a temporal hold-out of [dataset], the graph model recovers X% of laundering-ring accounts within the top 1% of alerts versus Y% for a per-transaction gradient-boosting baseline, and flags a ring a median of N hops before its last transaction." Experiment: temporal train/test split, same features to both models, precision/recall at fixed alert budget, ring-level (not transaction-level) recall.

**Scores.** Impact 7, PS fit 10.

---

## 8. ECHOGUARD — scam-call and voice-clone shield (PS05)

**User and moment.** The clearest of the eight: an older adult, or the adult child of one, 90 seconds into a call from "the CBI" or "the bank", wondering whether it is real. Secondary: someone who received a voice note from a "relative" asking for money and uploads it afterwards.

**Problem size.**
- Digital arrest scams: about 1.2 lakh complaints and Rs 1,935 crore lost in 2024 [V] (government data, https://inc42.com/buzz/indians-lost-inr-1935-cr-to-digital-arrest-scams-in-2024-govt, https://thewire.in/tech/indians-lost-nearly-rs-2000-crore-to-digital-arrest-scams-in-2024-report).
- Total cyber fraud losses Rs 22,845 crore in 2024 [V] (Scroll link above).
- McAfee 2023 survey (7,054 people in 7 countries, 1,010 in India): 47% of Indian respondents had experienced or knew someone who experienced an AI voice scam; 83% of victims lost money [V] (https://www.businesstoday.in/technology/news/story/phone-call-scam-in-india-over-45-victims-of-ai-fraud-calls-lost-over-rs-50000-379697-2023-05-02). This is a vendor online survey with "or know someone" wording; a later McAfee survey reportedly gives 1 in 5. Cite with the caveat or it reads as hype.

**Unsupported or exaggerated claims.** The doc bundles two different threats. Digital arrest, the one with the big verified rupee figure, is run by live human callers, usually over WhatsApp video; voice cloning is not the mechanism [I]. So the anti-spoofing model does not address the headline statistic; the scam-script classifier does. Leading with "voice-clone shield" and then citing digital-arrest losses is a mismatch a sharp judge will catch. "Across Indian languages" is an unbacked breadth claim; pick Hindi and English and prove those.

**PS fit.** "Fraud detection, phishing prevention" — voice phishing is squarely in. 10.

**Credibility trap and defusal.** (a) Adoption: a web page cannot hear a phone call; the product in the wild needs speakerphone-to-second-device, an Android dialer integration, or a telco. Say which, and show the speakerphone path working. (b) Anti-spoofing models trained on ASVspoof degrade badly on unseen generators and phone codecs [I]. (c) Privacy: recording the other party. Defuse by: on-device inference with no audio upload, stated and demonstrable in the network tab; reporting equal error rate on ASVspoof and separately on a small out-of-distribution set made with current cloning tools through a phone-codec simulation, publishing the worse number too; evaluating the script classifier on real transcripts of publicly reported scam calls versus ordinary bank/delivery calls; framing output as a risk warning, not a verdict.

**Honest quantified statement.** "On N transcribed real scam calls and M benign service calls in Hindi and English, the tactic classifier raises a high-risk alert within a median of T seconds at X% recall and Y% false-alarm rate; spoof detection EER is A% in-distribution and B% on unseen cloning tools." Experiment: assemble a small labelled set from public recordings (police awareness releases, news clips), run streaming, measure time-to-alert. Time-to-alert is the number that matters, because the victim is on the call.

**Scores.** Impact 7, PS fit 10.

---

## Ranking

1. **MULEHUNT** (7 / 10) — verified, fast-growing rupee losses; named institutional user; regulator has publicly said graph-style mule detection is needed; benefit is measurable against a baseline on public data in the time available. Must rename and must not claim nobody does this.
2. **ECHOGUARD** (7 / 10) — best-defined human user and moment of the set, and a judge can try it with their own voice. Ranked second only because the deployment path is weaker and the out-of-distribution number may be ugly.
3. **GREENWAVE** (6 / 10) — PS text match is verbatim, and there is a real Indian deployment with reported 15–20% to anchor the claim. Loses a point for sim-only evidence.
4. **TERRA** (6 / 10) — perfect fit, large verified water problem, but impact evidence is modelled and breadth dilutes it.
5. **FUNDUS** (6 / 10) — perfect fit, huge verified burden, near-zero marginal contribution over deployed products.
6. **DELUGE** (7 / 5) — arguably the largest unmet planning need here, verified at USD 4 billion a year, but it is the only idea where a literal judge can mark it off-topic.
7. **KINETIC** (4 / 9) — cannot evidence its central benefit (learning) in the time.
8. **PULSE** (4 / 8) — no user who is better served than by a cheap oximeter; the one disease claim is the least defensible.

## Pitches I would want to read (top 3)

**MULEHUNT (renamed).** "Indians reported Rs 22,845 crore lost to cyber fraud in 2024 and authorities have flagged lakhs of mule accounts, because stolen money moves through chains of accounts that look innocent one transaction at a time. Our temporal graph model, tested on public labelled datasets with a time-based hold-out, finds X% of ring accounts in the top 1% of alerts where a per-transaction baseline finds Y% — no Indian bank data was used, and we say so."

**ECHOGUARD.** "Digital-arrest callers took Rs 1,935 crore from about 1.2 lakh Indian complainants in 2024 by keeping victims on the line; the only useful warning is one that arrives during the call. Running entirely on the listener's device, our model flags scam scripts in Hindi and English a median of T seconds in at X% recall and Y% false alarms on real recorded scam calls, and separately reports its cloned-voice detection error on generators it has never seen."

**GREENWAVE.** "Bengaluru drivers lose 117 hours a year in rush-hour traffic, and the city's own adaptive-signal rollout reports 15–20% travel-time savings, so signal control is a proven lever. Our learned controller, running live in your browser, cuts simulated delay by X% against fixed timers and Y% against a max-pressure baseline on a public benchmark network across 20 seeds — a simulation result, stated as one."

## Cross-cutting advice

- Every idea's doc entry gives an impact sentence with no number and no source. Whichever is chosen, the README needs one sourced problem statistic and one self-measured result, with the method one click away.
- Publish the unflattering number next to the flattering one (out-of-distribution, strong baseline, rejected-sample rate). In a field of unqualified "98% accuracy" claims this is the cheapest credibility available.
- Name one user. "ASHA workers, telemedicine, elderly at home" and "banks" are categories, not users.

## Verification summary

Verified by search this session: ICMR-INDIAB 101.3M; national DR survey 16.9%/3.6%; India AF prevalence range; NFHS-5 hypertension cascade; UBFC-rPPG baseline MAE range; India agricultural withdrawal 688 BCM and 78–90% share; FAO 40%/USD 220B; UDISE+ 57.6% labs; ASER 45.8%; TomTom Bengaluru/Kolkata 2024; BATCS 15–20%; World Bank USD 4B/5B urban flood; Chennai 2015 USD 2.2–3.5B; Rs 22,845 crore cyber fraud; RBI Rs 36,014 crore (with reclassification caveat); mule-account counts and MuleHunter.AI adoption; digital arrest Rs 1,935 crore; McAfee 47%/83%.

Not verified (my inference or memory): ophthalmologist density; average landholding 1.08 ha; WHO global hypertension-unaware share; Bengaluru 2022 flood loss; any global congestion or money-laundering total; world "learning poverty"; existence and status of commercial DR-AI products; PlantVillage field-generalisation failure; digital-arrest scams being human-run rather than cloned-voice; ASVspoof generalisation weakness; oximeter price. All scores and rankings are my judgment.
