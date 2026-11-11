import type { PairedComparison } from "./types";

export const primaryScenario = "morning-peak";
export const primaryMetric = "delayPerPerson";

function percent(value: number): string {
  return `${(Math.abs(value) * 100).toFixed(1)}%`;
}

export function signedPercent(value: number): string {
  return `${value < 0 ? "−" : value > 0 ? "+" : ""}${percent(value)}`;
}

function interval(result: PairedComparison): string {
  return `95% CI ${signedPercent(result.ciLow)} to ${signedPercent(result.ciHigh)}`;
}

export function headlineFor(comparisons: readonly PairedComparison[]): string {
  const primary = comparisons.filter(
    ({ suite, scenario, metric, a, variant }) =>
      suite === "B1" &&
      scenario === primaryScenario &&
      metric === primaryMetric &&
      a === "chowk" &&
      !variant,
  );
  const area = primary.find(({ b }) => b === "mp-area");
  const webster = primary.find(({ b }) => b === "webster");
  if (!area) return "The primary simulation result is pending.";

  const opening = `On ${area.seedCount} held-out seeds in simulated Indian mixed traffic, `;
  const areaClause = !area.clear
    ? `CHOWK showed no clear difference in delay per person versus area max-pressure (${signedPercent(area.relDiff)}, ${interval(area)})`
    : `CHOWK ${area.relDiff < 0 ? "reduced" : "increased"} delay per person by ${percent(area.relDiff)} versus area max-pressure (${interval(area)})`;
  const websterClause = !webster
    ? ""
    : !webster.clear
      ? `, with no clear difference versus Webster fixed-time (${signedPercent(webster.relDiff)}, ${interval(webster)})`
      : `, with ${percent(webster.relDiff)} ${webster.relDiff < 0 ? "lower" : "higher"} delay versus Webster fixed-time (${interval(webster)})`;
  return `${opening}${areaClause}${websterClause}. Simulation result.`;
}
