import { type CalibratedScenario, makeScenario, type ScenarioId } from "@chowk/scenarios";
import { corridor, DT, holdoutNetwork, type Network, type ScheduledEvent } from "@chowk/sim";
import type { RunIdentity, SuiteId } from "./types";

export const warmupSeconds = 300;
export const measurementSeconds = 1_800;
export const firstTestSeed = 1_000_000;
export const heldOutSeeds = Array.from({ length: 20 }, (_, index) => firstTestSeed + index);
export const comparisonControllers = [
  "webster",
  "actuated",
  "mp-count",
  "mp-area",
  "chowk",
] as const;
const reproductionControllers = ["webster", "mp-area", "chowk"] as const;
const suiteIds: readonly SuiteId[] = ["B1", "B2", "B3", "B4", "B5", "B6", "B7"];

export const scenarioLabels = {
  "morning-peak": "Morning peak",
  "evening-peak": "Evening peak",
  "off-peak": "Off-peak",
  festival: "Festival",
  monsoon: "Monsoon",
  oversaturated: "Oversaturated",
  "cars-only": "Lane-disciplined cars",
} satisfies Record<ScenarioId, string>;

export function scenarioLabel(id: string): string {
  return Object.hasOwn(scenarioLabels, id) ? scenarioLabels[id as ScenarioId] : id;
}

export function isSuiteId(value: string): value is SuiteId {
  return suiteIds.some((suite) => suite === value);
}

function identities(
  suite: SuiteId,
  scenarios: readonly ScenarioId[],
  controllers: readonly string[],
  seeds: readonly number[],
  variant?: string,
  network = corridor.id,
): RunIdentity[] {
  return scenarios.flatMap((scenario) =>
    controllers.flatMap((controller) =>
      seeds.map((seed) => ({
        suite,
        scenario,
        controller,
        network,
        seed,
        ...(variant ? { variant } : {}),
      })),
    ),
  );
}

export function suiteRuns(suite: SuiteId, seeds: readonly number[] = heldOutSeeds): RunIdentity[] {
  const all = Object.keys(scenarioLabels) as ScenarioId[];
  switch (suite) {
    case "B1":
    case "B7":
      return identities(suite, all, comparisonControllers, seeds);
    case "B2":
      return identities(suite, ["morning-peak", "cars-only"], comparisonControllers, seeds);
    case "B3":
      return identities(
        suite,
        ["morning-peak", "festival"],
        ["chowk", "chowk-vehicle", "chowk-count", "chowk-pure", "chowk-solo"],
        seeds,
      );
    case "B4":
      return [
        ...Array.from({ length: 8 }, (_, index) => `load-${(index + 5) / 10}`).flatMap((variant) =>
          identities(suite, ["morning-peak"], comparisonControllers, seeds, variant),
        ),
        ...identities(suite, ["morning-peak"], comparisonControllers, seeds, "two-wheelers-70"),
        ...identities(suite, ["morning-peak"], comparisonControllers, seeds, "buses-15"),
        ...identities(
          suite,
          ["morning-peak"],
          comparisonControllers,
          seeds,
          "held-out-grid",
          holdoutNetwork.id,
        ),
      ];
    case "B5":
      return [
        "clean",
        "noise-10",
        "noise-20",
        "noise-30",
        "sensor-freeze",
        "block",
        "surge",
      ].flatMap((variant) =>
        identities(suite, ["morning-peak"], comparisonControllers, seeds, variant),
      );
    case "B6":
      return identities(
        suite,
        ["morning-peak"],
        ["webster", "mp-area", "mp-area+preempt", "chowk", "chowk+preempt"],
        seeds,
      );
  }
}

export function reproductionRuns(): RunIdentity[] {
  return identities("B1", ["morning-peak"], reproductionControllers, heldOutSeeds.slice(0, 3));
}

export function policyFor(controller: string): string | undefined {
  if (controller === "chowk+preempt") return "chowk";
  return controller === "chowk" || /^chowk-(?:vehicle|count|pure|solo)$/.test(controller)
    ? controller
    : undefined;
}

export function equivalentIdentity(run: RunIdentity): RunIdentity {
  if (
    run.suite === "B2" ||
    run.suite === "B7" ||
    (run.suite === "B5" && run.variant === "clean") ||
    (run.suite === "B3" && run.controller === "chowk")
  ) {
    const { variant: _, ...base } = run;
    return { ...base, suite: "B1" };
  }
  return run;
}

function ambulanceEvents(network: Network, warmup: number, measure: number): ScheduledEvent[] {
  const route = network.routes.find(
    ({ links }) =>
      links.length === network.junctions.length + 1 &&
      links.every((link) => network.links[link].dir[0] === 1),
  );
  if (!route) throw new Error("Emergency benchmark requires an end-to-end arterial route");
  const events: ScheduledEvent[] = [];
  for (let seconds = 0; seconds < measure; seconds += 300) {
    events.push({
      tick: (warmup + seconds) / DT + 1,
      event: { type: "ambulance", source: route.source, route: route.id },
    });
  }
  return events;
}

function robustnessEvent(
  network: Network,
  variant: string,
  warmup: number,
): ScheduledEvent | undefined {
  const tick = (warmup + 300) / DT;
  const junction = network.junctions[Math.floor(network.junctions.length / 2)];
  if (variant === "sensor-freeze")
    return { tick, event: { type: "sensorFreeze", junction: junction.id, duration: 300 } };
  if (variant === "block") {
    const linkId = junction.approaches.find((approach) => network.links[approach].dir[0] === 1);
    if (linkId === undefined)
      throw new Error("Robustness benchmark requires an eastbound approach");
    const link = network.links[linkId];
    return {
      tick,
      event: {
        type: "block",
        link: linkId,
        start: link.length - 120,
        end: link.length - 100,
        strip: 0,
        strips: 7,
        duration: 600,
      },
    };
  }
  if (variant === "surge") {
    const source = network.sources.find(
      ({ link }) => network.links[link].dir[0] === 0 && network.links[link].strips === 11,
    );
    if (!source) throw new Error("Robustness benchmark requires a minor cross-street source");
    return { tick, event: { type: "surge", source: source.id, multiplier: 2, duration: 120 } };
  }
  return undefined;
}

export function episodeCase(
  identity: RunIdentity,
  warmup: number,
  measure: number,
): { network: Network; scenario: CalibratedScenario } {
  const { suite, scenario: scenarioId, variant } = identity;
  const network =
    identity.network === corridor.id
      ? corridor
      : identity.network === holdoutNetwork.id
        ? holdoutNetwork
        : undefined;
  if (!network) throw new Error(`Unknown benchmark network ${identity.network}`);
  if (!Object.hasOwn(scenarioLabels, scenarioId))
    throw new Error(`Unknown benchmark scenario ${scenarioId}`);
  const options: Parameters<typeof makeScenario>[1] = { network, duration: warmup + measure };
  if (suite === "B4") {
    if (variant?.startsWith("load-")) options.load = Number(variant.slice(5));
    if (variant === "two-wheelers-70") options.mix = [0.7, 0.072, 0.168, 0.03, 0.03, 0];
    if (variant === "buses-15") {
      const scale = 0.85 / 0.95;
      options.mix = [0.5 * scale, 0.12 * scale, 0.28 * scale, 0.05 * scale, 0.15, 0];
    }
  }
  if (suite === "B5" && variant?.startsWith("noise-"))
    options.sensorNoise = Number(variant.slice(6)) / 100;
  const scenario = makeScenario(scenarioId as ScenarioId, options);
  if (suite === "B6")
    return {
      network,
      scenario: { ...scenario, events: ambulanceEvents(network, warmup, measure) },
    };
  if (suite === "B5" && variant) {
    const event = robustnessEvent(network, variant, warmup);
    if (event) return { network, scenario: { ...scenario, events: [event] } };
  }
  return { network, scenario };
}
