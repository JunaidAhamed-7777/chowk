# 08 — Submission Package

What the judge reads and watches. The product can be excellent and still lose if this is weak.

Deadline: **15 Nov 2026, 23:55 IST**. Submit by **20:00 IST** to leave room for failure. The user submits on Unstop; an agent prepares everything.

`{{...}}` marks a value that is filled from `results/benchmark.json` by script. Never type a result by hand, and never fill a placeholder with an expected or hoped-for value.

## Unstop fields

### Title

**CHOWK — traffic signals that learned lane-free Indian traffic, live in your browser**

"Chowk" is the Hindi word for a junction or crossroads. The project was called GREENWAVE during ideation; the documents under `docs/` other than `03-final-concept.md` still use that name.

### Description (draft)

> **Open the demo. No install, no login: {{demo URL}}**
>
> Most adaptive signal research assumes cars queue in lanes. Indian traffic does not. Two-wheelers filter to the front, autos and buses share road width, and a queue is an area of road, not a count of cars.
>
> CHOWK is a signal controller trained for that reality, and a way to see and test it yourself:
>
> - **A lane-free traffic simulator** written from scratch in TypeScript: five vehicle classes moving in continuous road width, deterministic to the bit, running in your browser.
> - **A learned controller** that perceives occupied road area and people rather than vehicle counts, and coordinates a five-junction corridor. It is built as a learned correction on top of max-pressure control, the strongest classical method.
> - **A live 3D city** where the same traffic runs side by side under two controllers. Drag the divider. Trigger a surge, block a lane, send an ambulance, and watch it adapt.
> - **A benchmark you can re-run.** {{headline sentence}} Press "Run it yourself" and your browser reproduces our published numbers exactly.
>
> All results are simulation results. We build on prior work on lane-free signal control (Nandakumar et al., 2025; C-DAC's CoSiCoSt) and say exactly what is new and what is not on the Method page.

Keep it under the field's limit; if it must be cut, cut from the bottom up but never cut the first line or the simulation-result statement.

### Technologies

TypeScript, React, three.js, react-three-fiber, WebGL, Web Workers, Node.js, evolution strategies (reinforcement learning), Blender, Vite, Vitest, Playwright, GitHub Actions.

### Links

- GitHub: the repository URL.
- Live demo: the deployed URL. Test it in a private window on a different network before submitting.
- Video, if the form allows: the 90-second demo.

## README structure

In this order. A judge may read only the first screen.

1. **Hero.** A looping GIF or short video (under 8 MB) of the split-screen wipe at night, full width. Captured from the real app.
2. **One line.** What it is.
3. **Big link.** "Open the live demo", plus badges: CI passing, tests, licence.
4. **The result.** `{{headline sentence}}` and a compact table for the primary scenario, generated between `<!-- results:start -->` and `<!-- results:end -->`.
5. **Why this matters.** Three sentences and two sourced statistics (see below).
6. **What you can do in the demo.** Five bullets with small GIFs: wipe, break it, ambulance, see it think, run the benchmark yourself.
7. **How it works.** One architecture diagram; four short paragraphs: simulator, controller, training, evaluation.
8. **What is new here and what is not.** Prior work with links; our contributions.
9. **Reproduce.** Three commands: install, test, run the benchmark. Expected time.
10. **Engineering numbers.** Simulator speed, determinism across browsers, frame rate, bundle size, test count. Generated.
11. **Limits.** The list from the Limits page.
12. **Repository map**, **credits and licences**, **team**.

## Statistics for the impact framing

From the impact judge's search (`docs/judging/judge-3-impact.md`), found mostly through news coverage of the primary source:

- TomTom Traffic Index 2024: Bengaluru drivers lose about 117 hours a year in rush hour.
- Bengaluru's adaptive signal rollout (BATCS) reports 15–20% travel-time savings.

**Before publishing either, open the primary source, confirm the figure and its year, and link it.** If a figure cannot be confirmed from a primary or reputable source, drop it. Do not add statistics from memory.

## Citations

Listed on the Method page and in the README:

- Nandakumar, Banerjee, Vanajakshi (2025), arXiv 2509.21745: reinforcement-learned signal control on a laneless heterogeneous intersection. https://arxiv.org/abs/2509.21745
- C-DAC CoSiCoSt and Bengaluru's adaptive traffic control system.
- Varaiya (2013), max-pressure control.
- Webster (1958), traffic signal settings.
- Treiber, Hennecke, Helbing (2000), the Intelligent Driver Model.
- Salimans et al. (2017), evolution strategies as an alternative to reinforcement learning.
- Indian Highway Capacity Manual (CSIR-CRRI, 2017), if used for vehicle parameters.

Verify each reference's title, authors and year from the source before publishing; the list above is from recollection and the judging search, not from opening every document.

### Wording for "what is new and what is not"

> **Not new:** the observation that lane-free, mixed traffic needs different signal control; reinforcement learning for signals; max-pressure control. We cite the work we build on.
>
> **What we add:** a deterministic lane-free simulator that runs in a browser; a corridor-scale learned controller built as a correction on max-pressure, perceiving road area and weighting people over vehicles; a live demo you can attack; and a benchmark any visitor can reproduce exactly on their own machine.

Do not write "first", "novel" or "state of the art" about anything we have not searched for and confirmed.

## Demo video (90 seconds)

Screen capture from the real app at High quality, 1080p or better, 60 fps, with captions burned in and optional voice-over. No stock footage. The visual judge's storyboard is in `docs/judging/judge-4-visual.md`; this is the adapted version.

| Seconds | Shot | Caption |
|---|---|---|
| 0–5 | Black, then the city fades in, aerial, traffic streaming | "Traffic signals assume lanes." |
| 5–12 | Street-level: two-wheelers filtering through a queue | "Indian traffic doesn't have them." |
| 12–25 | Aerial; wipe sweeps across; left jams, right flows; numbers diverge | "Same traffic. Left: fixed timers. Right: CHOWK." |
| 25–37 | Pressure and Decision overlays at a junction | "It sees road area and people, not car counts." |
| 37–50 | Ambulance cam, greens opening | "An ambulance gets a green corridor." |
| 50–60 | Surge and blocked lane fired; right side recovers | "Break it. It adapts, live, in your browser." |
| 60–75 | Results page; "Run it yourself" completes with a tick | "{{headline, shortened}}. Re-run the proof yourself." |
| 75–85 | "Watch it learn" slider from generation 0 to final | "Starts as the best classical method. Learns from there." |
| 85–90 | Title card: name, URL, "simulation results" | — |

## Images

All captured from the app through the scripted capture route, at fixed seeds.

| Image | Use |
|---|---|
| Hero GIF or video, wipe mid-sweep | README top, Unstop |
| Poster still, aerial | Loading poster, social preview |
| Street-level filtering | README |
| Overlays at a junction | README, Method page |
| Results page | README |
| Architecture diagram (SVG) | README, Method page |

## Repository presentation

- Description and topics set on GitHub; social preview image uploaded (the user does this, or approves it).
- `LICENSE` present. `assets/CREDITS.md` complete.
- CI green on the submitted commit.
- No secrets, no large untracked binaries, no dead code or placeholder text.
- Commit history readable: small commits with clear messages.
- Tag the submitted commit `v1.0-submission`.

## Submission-day checklist

1. `npm test`, `npm run test:browsers`, `npm run build` all pass.
2. Benchmark regenerated from the final policy; `results/` committed; build integrity check passes without the override.
3. README results block regenerated; no `{{` left anywhere in the repository (a test checks this).
4. Deployed; demo opened in a private window in Chrome, Firefox and Safari or WebKit, and on a phone.
5. Autoplay tour watched end to end with no interaction.
6. "Run it yourself" completes and matches.
7. Video recorded, uploaded, linked.
8. Every statistic and citation verified against its source.
9. Unstop form filled by the user; links clicked from the submitted page.
10. Commit tagged.
