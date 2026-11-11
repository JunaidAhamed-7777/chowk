# CHOWK

**Traffic signals that learned lane-free Indian traffic, live in your browser.**

*Chowk* is Hindi for a junction. Most adaptive signal research assumes cars queue in lanes. Indian traffic does not: two-wheelers filter to the front, autos and buses share road width, and a queue is an area of road, not a count of cars.

CHOWK is a learned signal controller for that kind of traffic, a lane-free traffic simulator that runs in the browser, a 3D night city to watch and disrupt it in, and a benchmark any visitor can re-run.

An entry for INNOVEX 2026, problem statement PS04 (Smart Cities & Sustainability).

## Status

The local app opens a 3D night preview of the authored corridor. The preview uses scripted traffic. The simulator and benchmark are in development.

## Run locally

With Node.js 22.12 or later in the 22.x series:

```sh
npm ci
npm run dev
```

Run `npm run build` to type-check the workspaces and build the static app in `apps/web/dist`.

## Where to look

| | |
|---|---|
| [plan/00-vision.md](plan/00-vision.md) | What is being built and why |
| [ROADMAP.md](ROADMAP.md) | Ordered tasks |
| [AGENTS.md](AGENTS.md) | Rules for AI agents working here |
| [plan/](plan/) | Full specifications |
| [docs/](docs/) | How the idea was chosen |

## Prior work

CHOWK builds on existing research on signal control for lane-free traffic, including Nandakumar, Banerjee and Vanajakshi ([arXiv 2509.21745](https://arxiv.org/abs/2509.21745)) and C-DAC's CoSiCoSt. See [plan/08-submission.md](plan/08-submission.md).
