# Round 2 — Impact and Problem-Statement Fit: AQUIFER

Lens and scale are the same as [judge-3-impact.md](judge-3-impact.md): is the problem real and large, who exactly uses this, would they adopt it, is the claimed benefit credible and measurable. Visual wow is ignored. Concept judged: [../04-aquifer-concept.md](../04-aquifer-concept.md).

Evidence labels, as before:

- **[V]** = found in a web search on 12 Nov 2026, link given. Most links are secondary coverage; read the primary before quoting it in a submission.
- **[I]** = my inference or recollection, not verified this session. Do not cite without checking.

## Result

| Idea | PS | Impact | PS fit | Credibility trap |
|------|----|:-----:|:-----:|------------------|
| GREENWAVE (round 1) | PS04 | 6 | 10 | Sim-to-real; fixed-timer strawman |
| **AQUIFER as written** | PS02 | **6** | **7** | Software does not create collective action; the evidence that budgeting changes water levels is weak |
| AQUIFER reframed per section 3 | PS02 | 6 | 8 | Same |

**Verdict: GREENWAVE, by 3 points on fit and 0 on impact (16 vs 13 combined).** Reframing closes the gap to 2. On impact alone it is a tie, and I could not honestly separate them: both are simulation-only, both have a real institutional user, both have a real-world programme to anchor against. AQUIFER has the larger marginal contribution (no digital village-scale tool turned up in search; GREENWAVE's city already runs adaptive signals), but its anchor programme has weaker outcome evidence than Bengaluru's 15–20%.

---

## 1. The user and the moment of use

**User.** A trained facilitator working for an NGO or a state programme, not a farmer and not "the gram panchayat" in the abstract. Concretely: a WOTR Jal Sevak or an Atal Bhujal Yojana district implementation partner's field staff, supporting a Village Water Management Team / Village Water and Sanitation Committee.

**Moment.** The post-monsoon (October–November) gram sabha or water-budget meeting, where the village compares the water it has against the water its planned rabi and summer crops need and decides what to plant. The facilitator projects AQUIFER on a wall or passes round a tablet, loads the village's well inventory, and runs "what we plan to sow" against "what the aquifer can carry".

This is a real meeting that really happens. What search turned up:

| Programme | What it does | Evidence of effect | Label |
|---|---|---|---|
| **Atal Bhujal Yojana (Atal Jal)** | World Bank-supported, about Rs 6,000 crore, 7 states, 229 blocks, 8,203 gram panchayats, each with a community water budget and Water Security Plan updated annually | Reported groundwater-level improvement in 180 of 229 blocks over 2023–25 (QCI assessment) in one account, 83 of 229 as of 31 Mar 2025 in another. Commentators note one good year does not prove causation and community data is unverified. Scheme was extended to March 2026; I could not confirm its status after that, though an extension to five more states was reported as planned | [V] secondary: [IMPRI](https://www.impriindia.com/?p=75402), [Construction World](https://www.constructionworld.in/urban-infrastructure/wastewater-and-sewage-treatment/atal-bhujal-yojana-boosts-groundwater-conservation-across-seven-states/77456), [Vision IAS May 2026](https://visionias.in/current-affairs/news-today/2026-05-28/environment/indias-water-budgeting-initiative-enhances-groundwater-levels-making-11000-villages-drought-free), [ThePrint](https://theprint.in/india/centre-plans-to-extend-atal-jal-scheme-to-5-more-states-including-bihar-punjab/2487982) |
| **WOTR CoDriVE-Visual Integrator / Water Stewardship** | Hand-built scaled 3D physical model of a village's surface and subsurface (geology, wells, geophysics), used in water-budget and crop-planning workshops. Since 2017; documented in 20 villages of Jalna and Ahmednagar | Qualitative only: improved groundwater literacy, some villages starting governance rules. WOCAT lists "building models by hand takes time and coordination" as the limitation. No quantitative evaluation found | [V]: [WOTR](https://wotr.org/wotrs-codrive-visual-integrator-3d-model/), [WOCAT](https://qcat.wocat.net/es/wocat/approaches/view/permalink/7561), [Vikalp Sangam](https://vikalpsangam.org/article/3d-modelling-for-participatory-water-management/) |
| **FES / IFPRI groundwater games** | Crop-choice game (thirsty-profitable vs frugal crop, shared aquifer) plus community debrief. 17 treated and 9 control communities in Andhra Pradesh, 2013–14 | The best behavioural evidence in this field. About two-thirds of game villages adopted water registers versus just over one-third of controls; game villages more likely to adopt rules limiting dry-season irrigation. In-game communication raised sustainable extraction in year 2 only. Authors say games alone will not end depletion. Atal Jal has adopted the tools | [V]: [Meinzen-Dick et al. 2018, World Development](https://asu.elsevierpure.com/en/publications/playing-games-to-save-water-collective-action-games-for-groundwat), [IFPRI](https://www.ifpri.org/blog/changing-game-experiential-learning-triggering-large-scale-change-towards-sustainable-water/) |
| **APFAMGS** (Andhra Pradesh, FAO-funded) | Farmers measure rainfall and well levels, run crop-water budgets at hydrological-unit level | Mixed and the honest reading is discouraging. World Bank 2010 reported units aligning draft with availability. A 2020 World Bank note concludes limited effect on groundwater levels in hard-rock areas as abstraction kept rising, though awareness helped drought coping. An IWMI survey of an Andhra water-budgeting project (reported without naming it; very probably APFAMGS [I]) found only 32.7% of habitations still budgeting three years after funding ended | [V]: [World Bank 2020](https://openknowledge.worldbank.org/handle/10986/33243), [World Bank 2010](https://documents1.worldbank.org/curated/en/272661468267911138/pdf/516760ESW0P0951round0Water129101110.pdf), [FAO evaluation 2008](https://admin.indiawaterportal.org/sites/default/files/iwp2/FAO_Evaluation_Report_APFAMGS_Nov_2008.pdf), [Eco-Business on the IWMI figure](https://www.eco-business.com/news/water-budgeting-is-taking-indian-farmers-from-scarcity-to-plenty/) |
| **Hiware Bazar** (Maharashtra) | Gram sabha water budget; borewells for irrigation banned; sugarcane and other thirsty crops banned | Widely reported water-table recovery, but the depths are the sarpanch's own figures; no monitoring series or peer-reviewed evaluation found. The village's own budgets showed deficits in 2004–05 and 2007–08 | [V]: [Down To Earth](https://www.downtoearth.org.in/water/untouched-by-drought-57666), [India Environment Portal](https://indiaenvironmentportal.org.in/articles/water-audit), [Undark](https://undark.org/2019/09/18/droughts-force-water-budgeting-rural-india/) |
| **MARVI Bhujal Jankaars** (Rajasthan, Gujarat) | Farmers trained to monitor wells in two hard-rock watersheds, 11 villages, roughly 360 wells | Five village groundwater cooperatives formed; farmer data judged reliable. No outcome numbers on water levels found | [V]: [IWMI-GRIPP](https://gripp.iwmi.org/?p=996), [Jadeja et al. 2018](https://recharge.iah.org/files/2018/09/2018-p317-329-Jadeja-et-al-local-capacity-building.pdf), [Mongabay](https://india.mongabay.com/2020/06/bridging-the-gender-gap-through-groundwater-monitoring-in-a-rajasthan-village) |
| **ACWADAM** | Participatory groundwater management training, aquifer-based | Search returned nothing usable. Do not cite | not verified |

**What this means for the entry.**

- The user and the meeting are real, at a scale of thousands of gram panchayats. That is better than TERRA's "FPO agronomist" and on par with GREENWAVE's traffic engineer.
- The claimed mechanism (making the commons visible changes decisions) has one decent controlled study behind it (FES games) and one existing physical analogue (CoDriVE-VI) whose documented weakness is exactly what software removes. This is the strongest thing AQUIFER has. The drill-deeper interaction in the concept doc is, in effect, the FES game with a physics engine; say so and cite it.
- The evidence that participatory budgeting moves actual water levels is weak to negative once the project money leaves. Any sentence of the form "AQUIFER saves water" is unsupported. The defensible claim is "supports a meeting that programmes already run and that has been shown to change village rules".
- No digital village-scale groundwater twin turned up. The nearest tool found, GIZ's Varuni, is a block-level water-budget web app ([KP IAS summary](https://kpiasacademy.com/participatory-water-budgeting-rural-india/)) [V]. I did not search exhaustively; do not claim "first".

## 2. Sizing the problem: statistics that survive checking

Use these three or four:

1. **India is the world's largest groundwater user, about a quarter of global extraction, more than China and the US combined.** WaterAid, "Beneath the Surface: State of the World's Water 2019"; UN World Water Development Report 2022 puts India at about 251 km³ a year. [V] ([Business Standard/PTI](https://business-standard.com/amp/article/pti-stories/report-expresses-concern-over-rate-of-groundwater-depletion-in-119031900582_1.html), [Down To Earth on UN WWDR](https://www.downtoearth.org.in/news/unlocking-potential-of-groundwater-can-provide-water-security-boost-economy-un-82013))
2. **CGWB Dynamic Ground Water Resources 2025: 730 of 6,762 assessment units (10.8%) are over-exploited; national stage of extraction 60.63%; extraction 247.22 BCM against 407.75 BCM extractable. Punjab 156%, Rajasthan 147%, Haryana 137%; 214 of Rajasthan's 302 units over-exploited.** [V] secondary ([EA Water](https://www.eawater.com/?p=10539), [Vision IAS](https://visionias.in/current-affairs/news-today/2025-12-30/environment/ministry-of-jal-shakti-releases-dynamic-groundwater-resource-assessment-report-2025), [Tribune](https://www.tribuneindia.com/news/jalandhar/punjab-tops-list-of-indias-most-groundwater-stressed-states), [SANDRP](https://sandrp.in/2026/03/25/groundwater-2025-depletion-and-contamination-rising/))
3. **Groundwater irrigates about 64% of India's net irrigated area (2015–16), up from 30% in 1964–65, through 21.9 million groundwater schemes, 94.8% of all minor irrigation schemes (6th Minor Irrigation Census, reference year 2017–18).** [V] ([Srivastava, AgEcon Search](https://ageconsearch.umn.edu/record/320463/files/09-SK%20Srivastava.pdf), [Factly](https://factly.in/data-ground-water-schemes-make-up-nearly-95-of-the-minor-irrigation-schemes-in-india))
4. **Borewell failure and household harm: in a survey of 1,500 farmers in 100 Karnataka villages, over 60% had had a well dry up; after first-borewell failure, farm income fell sharply, the probability and amount of debt rose, and school enrolment of 12–18-year-olds fell. A failed borewell costs about Rs 50,000.** Blakeslee, Fishman and Srinivasan, "Way Down in the Hole", American Economic Review 110(1), 2020. [V] via summaries ([IDR](https://idronline.org/can-indian-farmers-adapt-to-water-loss/), [India Water Portal](https://www.indiawaterportal.org/agriculture/farm/karnataka-farmers-cope-wells-fail), [paper PDF](https://www.ram.sites.tau.ac.il/_files/ugd/dda1c1_b2cada28056a4730bd939514b03b3890.pdf)). This is the statistic that matches the demo, because the demo is about wells going dark.

Supporting, with caveats:

- Punjab water table falling about 50 cm a year on average (Centre's reply in Parliament: 51 cm, Nov 2023 vs 2013–22 mean); Haryana 5.41 m in 2014–24 by the state's own figure. [V] ([Tribune](https://www.tribuneindia.com/news/punjab/in-parliament-water-table-depleting-fast-in-punjab-65-wells-register-fall-642975/), [SANDRP](https://sandrp.in/2026/03/25/groundwater-2025-depletion-and-contamination-rising/))
- Peninsular hard rock: borewell failure rate reported at 23%, about double the national average; Telangana 34%, Andhra Pradesh 31%, from census data. [V] secondary, primary not seen ([India Water Portal](https://www.indiawaterportal.org/groundwater/how-groundwater-depletion-in-rural-bengaluru-affects-drinking-water-security))
- Free farm power: after Punjab made electricity free in 1997, groundwater depth deviation rose 16% more than in Haryana; moving to cost pricing is modelled to cut electric-pump extraction 59% at an 11% paddy-yield cost. [V] ([Gupta, AgEcon Search](https://ageconsearch.umn.edu/record/344328/))

**Commonly quoted, wrong or outdated. Do not use:**

- **"21 Indian cities will run out of groundwater by 2020" (NITI Aayog CWMI 2018).** A zombie statistic. Neither the World Bank nor WRI published it; the date has passed; a Lok Sabha reply noted it ignored deeper aquifers. [V] ([The Wire](https://thewire.in/environment/doubts-over-niti-aayog-claim-that-21-cities-face-groundwater-extinction-by-2020), [ThePrint](https://theprint.in/india/water-hiv-nasas-indian-scientists-how-zombie-statistics-mislead-media-govt-public/260045)). It is also about cities, not farms.
- **"India extracts 25% more than China and the US combined."** A garbling. The source says about 25% of the world total, and more than the two combined. No margin is given. [V]
- **"17% of blocks are over-exploited."** That is the 2017 assessment. CGWB 2025 says 10.8%, and safe units rose from 62.6% to 73.1%. A judge who knows this will read "the crisis is worsening everywhere" as hype. The honest line: nationally improving on official numbers, acutely concentrated in the north-west, west and parts of the south. [V] Whether part of the improvement is methodological is my suspicion, not a finding [I].
- **"Punjab's water table drops a metre a year."** That is a claim for Sangrur, Barnala and Patiala. The state average is about half that. [V]
- **Rodell et al. 2009 (Nature), "4 cm a year, 17.7 km³ a year".** Real, but it is water-equivalent depth averaged across three states for 2002–08, not a water-table fall, and a 2016 Scientific Reports paper questions the magnitude. Quote the volume with dates or leave it out. [V] ([Scientific American](https://www.scientificamerican.com/article/is-india-running-out-of-water/), [IIASA copy](https://pure.iiasa.ac.at/id/eprint/12959/1/srep24398.pdf))
- **"Borewell failure ruins farmers" stated flatly.** The same AER paper finds households largely offset lost farm income with off-farm work and did not sell land. Cite the debt and schooling effects; do not imply destitution, and do not link to farmer suicides without a source. [V] for the offset; the suicide link was not searched.
- **"Two-thirds of India is hard rock."** Probably right, but I could not source it this session. [I]
- **Atal Jal "180 of 229 blocks improved".** A second account says 83 of 229. Cite neither as proof that budgeting works. [V, conflicting]

## 3. Problem-statement fit

PS02 reads: "crop monitoring, disease detection, and smart irrigation."

A literal judge will not find "groundwater", "governance", "commons" or "digital twin" there, and will find no disease detection in the entry at all. They will accept it as agriculture, and most will accept that deciding how much to pump for which crop is irrigation. But "smart irrigation" in a hackathon rubric means, to most readers, a system that tells a field when and how much to water. As the concept doc is written (one line: "makes the ground transparent"; headline: tragedy of the commons), the first impression is a hydrology or water-policy project that touches farming. That costs marks against a field of entries that say "smart irrigation" in their titles.

It is not DELUGE (5): no eligibility argument is needed. It is not TERRA (10): it covers one of three named sub-topics squarely, one as an input, and one not at all. **7 as written.**

**Framing that gets it to 8, without dishonesty:**

- Title and first sentence use the PS words: "Smart irrigation for a whole village: a crop and pumping plan that keeps every borewell running."
- Describe the optimizer's output as an **irrigation schedule**: which crop on which plot, how many pumping hours per well per fortnight. That is literally smart irrigation; the commons is why the schedule has to be joint.
- Make crop monitoring real, not "optionally": satellite-derived crop map and crop water demand (FAO-56 by name) for the actual village as the model's input. One sentence in the README: "crop monitoring feeds the demand side; the aquifer model is the supply side."
- Do not bolt on a leaf-disease classifier for coverage. A judge who knows the domain reads that as padding. Say plainly "we address two of the three PS02 themes".
- Put "groundwater", "commons" and "digital twin" in the second paragraph, never the first.

It cannot reach 9–10: the absence of disease detection and the village-level (not field-level) unit will always leave a literal reader a notch short.

## 4. Credibility traps and how to defuse each honestly

**a. The farmer is not the user.**
The concept doc already admits it. Defuse by naming the facilitator and the meeting in the README's second sentence, building a "facilitator mode" (load village, set this year's rainfall, toggle proposed crop plan, print a one-page water budget in the format a Water Security Plan uses), and citing CoDriVE-VI as the practice being digitised. Do not show a farmer persona anywhere.

**b. Collective action is a social problem software does not solve.**
This is the main trap, because the "switch on the cooperative plan" toggle implies cooperation is a button. Defuse by:
- Claiming only decision support for a meeting, and citing FES/IFPRI for what such tools have been shown to do (more water registers and dry-season rules) and what they have not (lower water tables). Quote the authors' own caveat.
- Citing the unflattering evidence yourself: the World Bank 2020 APFAMGS finding and the 32.7% persistence figure. A team that cites the study that undercuts it is believed on everything else.
- Showing partial compliance: a slider for the share of farmers who follow the plan, and the result at 50% and 70%, not only 100%. If the plan collapses at 80% compliance, say so. If one defector can free-ride, show it.
- Pointing at Hiware Bazar's rules (borewell ban, crop ban) as an example of the enforcement that actually made budgeting stick, with the caveat that its numbers are self-reported.

**c. Simplified hydrogeology in hard rock.**
A single-layer smooth water table is roughly defensible in alluvium (Punjab, Haryana, UP) and wrong in detail for Deccan basalt and granite, where published work shows aquifers splitting into disconnected compartments as levels fall ([HAL/BRGM](https://hal-brgm.archives-ouvertes.fr/hal-00680838)) [V]. Two honest options:
- Choose an alluvial village, where the physics holds, and accept that the commons story is less dramatic there because wells deepen rather than fail outright [I].
- Choose a hard-rock village, where failure is real and the user programmes are, and label the model "screening-level, equivalent porous medium; well-to-well interference in fractured rock is less predictable than shown". Then verify the solver against the Theis analytic solution for a single well and report the error, and run every result across a stated range of transmissivity and specific yield.
Either is acceptable. Silence is not. I would pick hard rock with the label, since that is where Atal Jal, WOTR and MARVI work.

**d. Modelled, not measured, savings.**
Same trap as TERRA and GREENWAVE. Never write "saves X% water". Write "in simulation". The one piece of real-world validation available in 3.5 days is the forecast on held-out observation wells; make sure it is done against seasonal persistence (same season last year), not naive persistence, or the baseline is a strawman.

**e. Income, MSP and free electricity.**
A plan that says "grow millet instead of paddy" ignores why farmers grow paddy: assured procurement at MSP and a marginal pumping cost of zero. Defuse by:
- Making the optimizer's objective village income at actual MSP or mandi prices, with pumping priced at what the farmer pays (zero under free power), so the selfish baseline is realistic and the plan's income cost is visible.
- Reporting the distribution, not only the total: how many farmers earn less in year 1 under the plan, and by how much. If the plan needs side payments to leave nobody worse off, compute them.
- Stating that the gain is intertemporal: lower income now against wells that still work in year 10. Report the break-even year.
- Naming free power as the driver the tool cannot touch, with the Punjab evidence above.

## 5. The one honest quantified statement, and the experiment

**Statement (fill in the numbers; publish them whatever they are):**

> "For [village, district], using its mapped wells and crops and 20 years of observed rainfall, the cooperative crop-and-pumping plan keeps X% of borewells working at year 15 versus Y% under business as usual, for Z% lower village income in year 1 and a break-even in year N; with only 70% of farmers complying it keeps W%. This is a single-layer simulation, not a field result. Our water-level forecast has an error of A m on held-out CGWB wells versus B m for a same-season-last-year baseline."

**Experiment:**

1. One real village in an over-exploited block where a programme operates (an Atal Jal gram panchayat in Maharashtra, Karnataka or Rajasthan). Well locations from public data or stated as "synthetic layout matched to the Minor Irrigation Census well count".
2. Rainfall: resample actual district rainfall years to make at least 30 sequences. Aquifer parameters: sweep a published range. Report median and spread, not one run.
3. Three policies, not two: business as usual (each farmer maximises own income), the optimizer, and a dumb rule (no summer paddy or sugarcane, the Hiware Bazar rule). If the dumb rule gets 90% of the benefit, say so; that is a finding, and it protects against the strawman charge.
4. Compliance sweep at 100%, 70%, 50%.
5. Income at current MSP or mandi prices; pumping cost at zero and at cost price.
6. Forecast: train on some CGWB/India-WRIS wells, test on others, RMSE against seasonal persistence. The concept doc flags that this data has not been checked; if it is unusable, drop the forecast claim rather than fake it.
7. Solver check against the Theis solution, error stated.

All of this is compute on a small grid and fits in the time. The table goes in the README; the same model runs live in the demo.

## 6. Scores, verdict and pitch

**Impact: 6.** For: a very large, verified problem; a specific institutional user and a specific annual meeting across thousands of gram panchayats; a controlled study showing that this kind of tool changes village rules; an existing physical practice whose documented weakness is build effort; no digital equivalent found. Against: zero measured benefit; the best long-run evidence says water budgeting does not hold water levels once funding ends; the binding constraints (free power, MSP, enforcement) are outside the software; the physics is a simplification exactly where the users are; no facilitator will have touched it. That is the same shape as GREENWAVE and TERRA, so the same score. It would be a 7 only with a quote or a recorded session from a real facilitator, which is not achievable in 3.5 days without an existing contact.

**PS fit: 7** (8 if reframed as in section 3).

**Verdict.** On impact and fit alone: **GREENWAVE, by 3 points, all of it fit** (6+10 against 6+7). With the reframing, by 2. If the other lenses favour AQUIFER by more than that, impact is not a reason to hold it back; if they are level, GREENWAVE's verbatim PS match is the safer submission.

**Two-sentence impact pitch.**

> "India pumps about a quarter of the world's groundwater, and in a 1,500-farmer Karnataka study more than 60% had already seen a borewell run dry, because every pump in a village draws on the same water and nobody can see it. AQUIFER is smart irrigation at village scale: a tool for the water-budget meetings that 8,000 gram panchayats already hold, which shows the shared water table under their own fields and, in simulation, finds the crop and pumping schedule that keeps X% of wells running after 15 years against Y% without it."

## Verification summary

**Verified by search this session (mostly via secondary sources):** WaterAid/UN "about a quarter of global extraction, more than China and US combined"; CGWB 2025 figures (730 of 6,762 over-exploited, 10.8%, 60.63%, 247.22 BCM; Punjab 156%, Rajasthan 147%, Haryana 137%; 2017 comparison of 17.2%); groundwater 64% of net irrigated area and 21.9 million groundwater schemes; AER Karnataka borewell study (over 60% of sample, debt, schooling, off-farm offset, Rs 50,000); Punjab about 51 cm a year; hard-rock failure rates 23%/34%/31% (secondary only); Atal Jal scope (229 blocks, 8,203 gram panchayats) and the conflicting 180 vs 83 block results; WOTR CoDriVE-VI and its lack of quantitative evaluation; FES/IFPRI game results and adoption by Atal Jal; World Bank 2020 APFAMGS conclusion; IWMI 32.7% persistence figure; Hiware Bazar bans and self-reported levels; MARVI cooperatives; "21 cities" claim discredited; Rodell 2009 figures and the 2016 challenge; Punjab free-power studies; hard-rock compartmentalisation literature; Varuni as a block-level tool.

**Not verified (inference or memory):** that the IWMI 32.7% study is APFAMGS; "two-thirds of India is hard rock"; any role for methodology change in the CGWB improvement; ACWADAM's work; current post-March-2026 status of Atal Jal; that no village-scale digital groundwater twin exists (absence in a few searches only); that wells in alluvium deepen rather than fail; the month in which water-budget meetings are held; any link between borewell failure and farmer suicides (not searched). All scores, the verdict and the proposed experiment are my judgment.
