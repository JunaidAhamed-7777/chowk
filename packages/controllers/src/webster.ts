import type { Junction, JunctionSense, Network, Scenario } from "@chowk/sim";
import { expectedDemand } from "./demand";
import type { Controller, Explanation, NeighbourSense } from "./types";

const MIN_CYCLE = 40;
const MAX_CYCLE = 150;
const PERIOD = 900;
// Practical degree of saturation for a fixed-time phase (assumed). When minimum greens squeeze
// a busy phase past it, the cycle is lengthened until no phase exceeds it, up to MAX_CYCLE.
const TARGET_SATURATION = 0.9;

export interface WebsterPlan {
  cycle: number;
  greens: number[];
  starts: number[];
}

function greensFor(junction: Junction, ratios: readonly number[], cycle: number, lost: number) {
  const budget = Math.min(
    junction.phases.length * junction.maxGreen,
    Math.max(junction.phases.length * junction.minGreen, cycle - lost),
  );
  return splitGreens(ratios, budget, junction.minGreen, junction.maxGreen);
}

function peakSaturation(ratios: readonly number[], greens: readonly number[], lost: number) {
  const cycle = greens.reduce((sum, green) => sum + green, lost);
  let peak = 0;
  for (let phase = 0; phase < ratios.length; phase++) {
    peak = Math.max(peak, (ratios[phase] * cycle) / greens[phase]);
  }
  return peak;
}

export function websterPlan(junction: Junction, ratios: readonly number[]): WebsterPlan {
  const count = junction.phases.length;
  const clearance = junction.yellow + junction.allRed;
  const lost = count * clearance;
  const total = ratios.reduce((sum, ratio) => sum + ratio, 0);
  const raw = total >= 1 ? MAX_CYCLE : (1.5 * lost + 5) / (1 - total);
  const webster = Math.min(MAX_CYCLE, Math.max(MIN_CYCLE, raw));
  let greens = greensFor(junction, ratios, webster, lost);
  let peak = peakSaturation(ratios, greens, lost);
  for (let cycle = Math.ceil(webster); peak > TARGET_SATURATION && cycle <= MAX_CYCLE; cycle++) {
    const candidate = greensFor(junction, ratios, cycle, lost);
    const candidatePeak = peakSaturation(ratios, candidate, lost);
    if (candidatePeak < peak) {
      greens = candidate;
      peak = candidatePeak;
    }
  }
  const starts = new Array<number>(count);
  let cycle = 0;
  for (let phase = 0; phase < count; phase++) {
    starts[phase] = cycle;
    cycle += greens[phase] + clearance;
  }
  return { cycle, greens, starts };
}

function splitGreens(
  ratios: readonly number[],
  budget: number,
  minimum: number,
  maximum: number,
): number[] {
  const positive = ratios.filter((ratio) => ratio > 0);
  const empty = ratios.length - positive.length;
  const usable = positive.length * maximum + empty * minimum;
  if (budget >= usable) {
    return ratios.map((ratio) =>
      ratio > 0 ? maximum : (budget - positive.length * maximum) / empty,
    );
  }
  // Clipping the proportional split is monotone in its scale. Solve against
  // the whole budget so minimum and maximum bounds cannot strand green time.
  let lo = 0;
  let hi = maximum / Math.min(...positive);
  const clamp = (value: number) => Math.max(minimum, Math.min(maximum, value));
  for (let pass = 0; pass < 50; pass++) {
    const middle = (lo + hi) / 2;
    const sum = ratios.reduce((total, ratio) => total + clamp(ratio * middle), 0);
    if (sum < budget) lo = middle;
    else hi = middle;
  }
  return ratios.map((ratio) => clamp((ratio * (lo + hi)) / 2));
}

function arterialProgress(network: Network, flow: Float64Array) {
  const arterial = network.links.filter(
    ({ from, to, dir }) =>
      network.nodes[from].kind === "junction" &&
      network.nodes[to].kind === "junction" &&
      Math.abs(dir[0]) > Math.abs(dir[1]),
  );
  let east = 0;
  let west = 0;
  for (const link of arterial) {
    if (link.dir[0] > 0) east += flow[link.id];
    else west += flow[link.id];
  }
  const direction = east >= west ? 1 : -1;
  const offsets = new Float64Array(network.nodes.length);
  const forward = arterial
    .filter(({ dir }) => dir[0] * direction > 0)
    .sort((a, b) => direction * (network.nodes[a.from].x - network.nodes[b.from].x) || a.id - b.id);
  for (const link of forward) {
    offsets[link.to] = Math.max(
      offsets[link.to],
      offsets[link.from] + link.length / link.speedLimit,
    );
  }
  return { direction, offsets };
}

export class Webster implements Controller {
  readonly id = "webster";
  private plans: { plan: WebsterPlan; offset: number; throughPhase: number }[][] = [];

  constructor(private readonly saturation: (linkId: number) => number) {}

  init(network: Network, scenario: Scenario): void {
    this.plans = [];
    for (let start = 0; start < scenario.duration; start += PERIOD) {
      const demand = expectedDemand(
        network,
        scenario,
        start,
        Math.min(start + PERIOD, scenario.duration),
      );
      const progression = arterialProgress(network, demand.approach);
      this.plans.push(
        network.junctions.map((junction) => ({
          plan: websterPlan(
            junction,
            junction.phases.map((phase) =>
              phase.approaches.reduce((sum, link) => {
                const saturation = this.saturation(link);
                if (!(saturation > 0) || !Number.isFinite(saturation))
                  throw new RangeError(`Missing measured saturation at link ${link}`);
                return sum + demand.approach[link] / saturation;
              }, 0),
            ),
          ),
          offset: progression.offsets[junction.node],
          throughPhase: Math.max(
            0,
            junction.phases.findIndex(({ approaches }) =>
              approaches.some((id) => {
                const [x, z] = network.links[id].dir;
                return x * progression.direction > Math.abs(z);
              }),
            ),
          ),
        })),
      );
    }
  }

  act(junctionId: number, _sense: JunctionSense, { time }: NeighbourSense): number {
    const { plan, offset, throughPhase } =
      this.plans[Math.min(this.plans.length - 1, Math.floor(time / PERIOD))][junctionId];
    const clock =
      (((time - offset + plan.starts[throughPhase]) % plan.cycle) + plan.cycle) % plan.cycle;
    for (let phase = plan.greens.length - 1; phase >= 0; phase--) {
      if (clock < plan.starts[phase]) continue;
      return clock < plan.starts[phase] + plan.greens[phase]
        ? phase
        : (phase + 1) % plan.greens.length;
    }
    return 0;
  }

  explain(): Explanation {
    return { scores: [], reason: "Webster plan from the scenario’s mean demand" };
  }
}
