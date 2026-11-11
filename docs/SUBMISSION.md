# INNOVEX 2026 submission

## Title

CHOWK — Traffic signals that learned lane-free Indian traffic

## Description

Open the live demo at https://chowk-seven.vercel.app/.

On an Indian arterial, two-wheelers filter through queues, auto-rickshaws share road width with buses, and a vehicle count misses both road occupancy and the number of people waiting. CHOWK is a learned traffic-signal controller and a live simulation built around those differences.

Drag the divider to compare two controllers over the same demand. Block a lane, trigger a surge, or send an ambulance through both sides. The pressure overlay shows what the controller sees. CHOWK learns an adjustment to area-based max-pressure control using occupancy-weighted delay.

On 20 held-out seeds in simulated Indian mixed traffic, CHOWK showed no clear difference in delay per person versus area max-pressure (+0.1%, 95% CI −0.4% to +0.5%), with 2.8% lower delay versus Webster fixed-time (95% CI −3.2% to −2.3%). Simulation result.

The Results view reruns a published subset in browser workers and compares every metric and final state hash. All results are simulation results. The Method page documents the assumptions and validation. CHOWK builds on prior work on lane-free signal control. [Nandakumar, Banerjee and Vanajakshi](https://arxiv.org/abs/2509.21745) · [C-DAC CoSiCoSt-EnV](https://cdac.in/index.aspx?id=product_details&productId=CoSiCoStEnV%28CompositeSignalControlStrategyEnhancedVersion%29)

## Technologies

TypeScript, React, three.js, React Three Fiber, WebGL 2, Web Workers, Node.js, evolution strategies, Blender, Vite, Vitest, Playwright, GitHub Actions

## Links

- [Source repository](https://github.com/JunaidAhamed-7777/chowk)
- [Live demo](https://chowk-seven.vercel.app/)
- [Captioned demo video](https://github.com/JunaidAhamed-7777/chowk/raw/refs/heads/main/assets/demo/chowk-demo.mp4)
