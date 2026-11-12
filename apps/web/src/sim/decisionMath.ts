import {
  AREA_HYSTERESIS,
  COUNT_HYSTERESIS,
  type ControllerId,
  decodePolicy,
  type Explanation,
  POLICY_PARAMETER_COUNT,
  type PolicyWeights,
} from "@chowk/controllers";
import { expectedDemand, type TurnShare } from "@chowk/controllers/demand";
import { DIRECTION_NAMES, layoutFor } from "@chowk/controllers/observation";
import type { JunctionSense, Network, Scenario } from "@chowk/sim";

/**
 * A term-by-term restatement of `scorePressure` in @chowk/controllers, written out so the
 * interface can show each number. The live panel checks its total against the controller's own
 * output on every decision, and a unit test checks it against `scorePressure` directly.
 */
export type PressureBasis = "area" | "count";

export interface ExitTerm {
  link: number;
  share: number;
  load: number;
  value: number;
}

export interface ApproachTerm {
  approach: number;
  direction: string;
  areaNear: number;
  areaMid: number;
  nearLength: number;
  midLength: number;
  count: number;
  queue: number;
  exits: ExitTerm[];
  exitTotal: number;
}

export interface PhaseBreakdown {
  phase: number;
  label: string;
  approaches: ApproachTerm[];
  hold: number;
  pressure: number;
}

export type ControllerKind = "fixed" | "actuated" | "pressure" | "learned";

export interface ControllerModel {
  kind: ControllerKind;
  basis?: PressureBasis;
  hysteresis: number;
  /** Multiplier applied to the pressure before it becomes CHOWK's prior. */
  scale: number;
}

export function approachDirections(network: Network, junctionId: number): string[] {
  const layout = layoutFor(network, junctionId);
  const names = network.junctions[junctionId].approaches.map(() => "");
  for (let direction = 0; direction < 4; direction++) {
    const approach = layout.approaches[direction];
    if (approach >= 0) names[approach] = DIRECTION_NAMES[direction];
  }
  return names;
}

export function phaseLabels(network: Network, junctionId: number): string[] {
  const junction = network.junctions[junctionId];
  const names = approachDirections(network, junctionId);
  return junction.phases.map(({ approaches }) =>
    approaches.map((link) => names[junction.approaches.indexOf(link)]).join(" + "),
  );
}

const sharesCache = new WeakMap<Scenario, TurnShare[][]>();

export function turnShares(network: Network, scenario: Scenario): TurnShare[][] {
  let shares = sharesCache.get(scenario);
  if (!shares) {
    shares = expectedDemand(network, scenario).shares;
    sharesCache.set(scenario, shares);
  }
  return shares;
}

export function pressureBreakdown(
  network: Network,
  junctionId: number,
  sense: JunctionSense,
  shares: readonly (readonly TurnShare[])[],
  basis: PressureBasis,
  hysteresis: number,
): PhaseBreakdown[] {
  const junction = network.junctions[junctionId];
  const names = approachDirections(network, junctionId);
  const labels = phaseLabels(network, junctionId);
  return junction.phases.map(({ approaches }, phase) => {
    const hold = phase === sense.phase ? hysteresis : 0;
    let pressure = hold;
    const terms = approaches.map((link): ApproachTerm => {
      const approach = junction.approaches.indexOf(link);
      const observation = sense.approaches[approach];
      const nearLength = Math.min(network.links[link].length, 60);
      const midLength = Math.min(network.links[link].length, 150) - nearLength;
      const queue =
        basis === "count"
          ? observation.count
          : (observation.areaNear * nearLength + observation.areaMid * midLength) /
            (nearLength + midLength);
      pressure += queue;
      let exitTotal = 0;
      const exits = observation.exits.map((exit): ExitTerm => {
        const share = shares[link].find(({ link: id }) => id === exit.link)?.share ?? 0;
        const load = basis === "count" ? exit.count : exit.area;
        pressure -= share * load;
        exitTotal += share * load;
        return { link: exit.link, share, load, value: share * load };
      });
      return {
        approach,
        direction: names[approach],
        areaNear: observation.areaNear,
        areaMid: observation.areaMid,
        nearLength,
        midLength,
        count: observation.count,
        queue,
        exits,
        exitTotal,
      };
    });
    return { phase, label: labels[phase], approaches: terms, hold, pressure };
  });
}

const betas = new WeakMap<PolicyWeights, number>();

function policyBeta(policy: PolicyWeights): number {
  let beta = betas.get(policy);
  if (beta === undefined) {
    beta = decodePolicy(policy)[POLICY_PARAMETER_COUNT];
    betas.set(policy, beta);
  }
  return beta;
}

export function controllerModel(id: ControllerId, policy?: PolicyWeights): ControllerModel {
  const base = id.replace("+preempt", "");
  if (base === "webster") return { kind: "fixed", hysteresis: 0, scale: 0 };
  if (base === "actuated") return { kind: "actuated", hysteresis: 0, scale: 0 };
  if (base === "mp-area")
    return { kind: "pressure", basis: "area", hysteresis: AREA_HYSTERESIS, scale: 1 };
  if (base === "mp-count")
    return { kind: "pressure", basis: "count", hysteresis: COUNT_HYSTERESIS, scale: 1 };
  const counts = base === "chowk-count";
  const beta = base === "chowk-pure" || !policy ? 0 : policyBeta(policy);
  return {
    kind: "learned",
    basis: counts ? "count" : "area",
    hysteresis: counts ? COUNT_HYSTERESIS : AREA_HYSTERESIS,
    scale: counts ? beta / 40 : beta,
  };
}

/** The pressure scores the controller itself reported for this decision, if any. */
export function reportedPressure(model: ControllerModel, explanation: Explanation | undefined) {
  if (model.kind === "pressure") return explanation?.scores;
  if (model.kind === "learned") return explanation?.prior;
  return undefined;
}

/** True when the browser's restated arithmetic reproduces the controller's numbers. */
export function matchesController(
  breakdown: readonly PhaseBreakdown[],
  model: ControllerModel,
  explanation: Explanation | undefined,
): boolean | undefined {
  const reported = reportedPressure(model, explanation);
  if (!reported || reported.length !== breakdown.length) return undefined;
  const scale = model.kind === "learned" ? model.scale : 1;
  return breakdown.every(({ pressure }, phase) => {
    const expected = pressure * scale;
    return Math.abs(expected - reported[phase]) <= 1e-9 * Math.max(1, Math.abs(expected));
  });
}

/**
 * The actuated controller's extension threshold. It is private to
 * packages/controllers/src/actuated.ts, which is part of the benchmark's version hash, so it is
 * mirrored here; a unit test checks the controller still switches at this value.
 */
export const ACTUATED_EXTEND_THRESHOLD = 0.025;
