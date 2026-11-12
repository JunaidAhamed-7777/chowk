import { Random } from "@chowk/sim";
import type { BenchmarkRun, PairedComparison, SummaryCell } from "./types";

const BOOTSTRAP_REPLICATES = 10_000;
const BOOTSTRAP_SEED = 0x43484f57;
const drawsBySampleSize = new Map<number, Uint32Array>();
const higherIsBetter = new Set(["throughputPeoplePerHour", "completionRate", "ambulanceCompleted"]);

export function mean(values: ArrayLike<number>): number {
  let sum = 0;
  for (let index = 0; index < values.length; index++) sum += values[index];
  return sum / values.length;
}

export function percentile(sorted: ArrayLike<number>, probability: number): number {
  if (sorted.length === 0) throw new RangeError("A percentile needs at least one observation");
  const index = (sorted.length - 1) * probability;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function interval(samples: Float64Array): [number, number] {
  samples.sort();
  return [percentile(samples, 0.025), percentile(samples, 0.975)];
}

function bootstrapDraws(size: number): Uint32Array {
  const cached = drawsBySampleSize.get(size);
  if (cached) return cached;
  const random = new Random(BOOTSTRAP_SEED);
  const draws = Uint32Array.from({ length: BOOTSTRAP_REPLICATES * size }, () =>
    Math.floor(random.next() * size),
  );
  drawsBySampleSize.set(size, draws);
  return draws;
}

export function bootstrapMean(
  values: readonly number[],
): Pick<SummaryCell, "mean" | "ciLow" | "ciHigh" | "median"> {
  const average = mean(values);
  const median = percentile(Float64Array.from(values).sort(), 0.5);
  if (values.every((value) => value === values[0])) {
    return { mean: average, median, ciLow: average, ciHigh: average };
  }
  const draws = bootstrapDraws(values.length);
  const replicates = new Float64Array(BOOTSTRAP_REPLICATES);
  for (let sample = 0; sample < replicates.length; sample++) {
    let sum = 0;
    for (let draw = 0; draw < values.length; draw++) {
      sum += values[draws[sample * values.length + draw]];
    }
    replicates[sample] = sum / values.length;
  }
  const [ciLow, ciHigh] = interval(replicates);
  return { mean: average, median, ciLow, ciHigh };
}

export function pairedRelativeDifference(
  pairs: readonly (readonly [a: number, b: number])[],
  largerWins = false,
): Pick<PairedComparison, "relDiff" | "ciLow" | "ciHigh" | "winRate" | "clear"> | undefined {
  if (pairs.length === 0) return undefined;
  let sumA = 0;
  let sumB = 0;
  let wins = 0;
  for (const [a, b] of pairs) {
    sumA += a;
    sumB += b;
    if (largerWins ? a > b : a < b) wins++;
  }
  if (sumB === 0) return undefined;
  const relDiff = (sumA - sumB) / sumB;
  const draws = bootstrapDraws(pairs.length);
  const replicates = new Float64Array(BOOTSTRAP_REPLICATES);
  let count = 0;
  for (let sample = 0; sample < replicates.length; sample++) {
    let a = 0;
    let b = 0;
    for (let draw = 0; draw < pairs.length; draw++) {
      const pair = pairs[draws[sample * pairs.length + draw]];
      a += pair[0];
      b += pair[1];
    }
    if (b !== 0) replicates[count++] = (a - b) / b;
  }
  if (count === 0) return undefined;
  const [ciLow, ciHigh] = interval(replicates.subarray(0, count));
  return { relDiff, ciLow, ciHigh, winRate: wins / pairs.length, clear: ciLow > 0 || ciHigh < 0 };
}

const controllerOrder = [
  "chowk",
  "mp-area",
  "mp-count",
  "actuated",
  "webster",
  "mp-area+preempt",
  "chowk+preempt",
  "chowk-vehicle",
  "chowk-count",
  "chowk-pure",
  "chowk-solo",
];

export function compareControllers(a: string, b: string): number {
  const aOrder = controllerOrder.indexOf(a);
  const bOrder = controllerOrder.indexOf(b);
  return (
    (aOrder < 0 ? controllerOrder.length : aOrder) -
      (bOrder < 0 ? controllerOrder.length : bOrder) || (a < b ? -1 : a > b ? 1 : 0)
  );
}

export function summariseRuns(runs: readonly BenchmarkRun[]): {
  summary: SummaryCell[];
  comparisons: PairedComparison[];
} {
  const groups = new Map<
    string,
    {
      base: Pick<BenchmarkRun, "suite" | "scenario" | "network" | "variant">;
      byController: Map<string, Map<number, BenchmarkRun>>;
    }
  >();
  for (const run of runs) {
    const { suite, scenario, network, variant } = run;
    const key = JSON.stringify([suite, scenario, network, variant ?? ""]);
    let group = groups.get(key);
    if (!group) {
      group = { base: { suite, scenario, network, variant }, byController: new Map() };
      groups.set(key, group);
    }
    let series = group.byController.get(run.controller);
    if (!series) {
      series = new Map();
      group.byController.set(run.controller, series);
    }
    if (series.has(run.seed))
      throw new Error(`Duplicate benchmark run for ${key}, ${run.controller}, seed ${run.seed}`);
    series.set(run.seed, run);
  }

  const summary: SummaryCell[] = [];
  const comparisons: PairedComparison[] = [];
  for (const key of [...groups.keys()].sort()) {
    const group = groups.get(key);
    if (!group) continue;
    const { base, byController } = group;
    const controllers = [...byController.keys()].sort(compareControllers);
    const clean =
      base.suite === "B5" && base.variant !== "clean"
        ? groups.get(JSON.stringify([base.suite, base.scenario, base.network, "clean"]))
            ?.byController
        : undefined;
    for (let index = 0; index < controllers.length; index++) {
      const controller = controllers[index];
      const first = byController.get(controller);
      if (!first) continue;
      const seeds = [...first.keys()].sort((a, b) => a - b);
      const opponents = controllers
        .slice(index + 1)
        .map((id) => ({ id, series: byController.get(id) }));
      if (clean) opponents.push({ id: "clean", series: clean.get(controller) });
      const metrics = [
        ...new Set([...first.values()].flatMap((run) => Object.keys(run.metrics))),
      ].sort();
      for (const metric of metrics) {
        const values = seeds.flatMap((seed) => {
          const value = first.get(seed)?.metrics[metric];
          return typeof value === "number" && Number.isFinite(value) ? [value] : [];
        });
        if (values.length === 0) continue;
        summary.push({
          ...base,
          controller,
          metric,
          seedCount: values.length,
          ...bootstrapMean(values),
        });
        for (const { id: b, series: second } of opponents) {
          const pairs: [number, number][] = [];
          for (const seed of seeds) {
            const aValue = first.get(seed)?.metrics[metric];
            const bValue = second?.get(seed)?.metrics[metric];
            if (
              typeof aValue === "number" &&
              typeof bValue === "number" &&
              Number.isFinite(aValue) &&
              Number.isFinite(bValue)
            ) {
              pairs.push([aValue, bValue]);
            }
          }
          const result = pairedRelativeDifference(pairs, higherIsBetter.has(metric));
          if (result)
            comparisons.push({
              ...base,
              a: controller,
              b,
              metric,
              seedCount: pairs.length,
              ...result,
            });
        }
      }
    }
  }
  return { summary, comparisons };
}
