import { describe, expect, it } from "vitest";
import { headlineFor } from "../src/headline";
import { bootstrapMean, pairedRelativeDifference, summariseRuns } from "../src/statistics";
import type { BenchmarkRun, PairedComparison } from "../src/types";

describe("deterministic benchmark statistics", () => {
  it("computes the bootstrap interval and median for a two-point empirical distribution", () => {
    expect(bootstrapMean([2, 6])).toEqual({ mean: 4, ciLow: 2, ciHigh: 6, median: 4 });
    expect(bootstrapMean([2, 2])).toEqual({ mean: 2, ciLow: 2, ciHigh: 2, median: 2 });
  });

  it("pairs resamples, uses the ratio of means and tracks paired wins", () => {
    expect(
      pairedRelativeDifference([
        [1, 2],
        [5, 4],
      ]),
    ).toEqual({
      relDiff: 0,
      ciLow: -0.5,
      ciHigh: 0.25,
      winRate: 0.5,
      clear: false,
    });
    expect(
      pairedRelativeDifference([
        [1, 2],
        [5, 10],
      ])?.ciHigh,
    ).toBe(-0.5);
    expect(pairedRelativeDifference([[1, 0]])).toBeUndefined();
  });

  it("aligns seeds and excludes unpaired or missing measurements", () => {
    const make = (controller: string, seed: number, value: number): BenchmarkRun => ({
      suite: "B1",
      scenario: "morning-peak",
      network: "corridor",
      controller,
      seed,
      metrics: { delayPerPerson: value },
      finalHash: 0,
    });
    const runs = [
      make("mp-area", 12, 2),
      make("chowk", 13, 90),
      make("chowk", 12, 1),
      make("mp-area", 14, 10),
    ];
    const { comparisons } = summariseRuns(runs);
    expect(comparisons).toMatchObject([{ a: "chowk", b: "mp-area", seedCount: 1, relDiff: -0.5 }]);
    expect(summariseRuns([...runs].reverse())).toEqual(summariseRuns(runs));
    expect(() => summariseRuns([...runs, runs[0]])).toThrow("Duplicate benchmark run");
  });
});

describe("primary headline", () => {
  const comparison: PairedComparison = {
    suite: "B1",
    scenario: "morning-peak",
    network: "corridor",
    metric: "delayPerPerson",
    a: "chowk",
    b: "mp-area",
    seedCount: 20,
    relDiff: -0.11,
    ciLow: -0.2,
    ciHigh: -0.02,
    winRate: 0.6,
    clear: true,
  };

  it("states improvement, uncertainty and worse results in plain language", () => {
    expect(headlineFor([comparison])).toContain("reduced delay per person by 11.0%");
    expect(headlineFor([{ ...comparison, ciHigh: 0.01, clear: false }])).toContain(
      "no clear difference",
    );
    expect(headlineFor([{ ...comparison, relDiff: 0.17, ciLow: 0.01, ciHigh: 0.33 }])).toContain(
      "increased delay per person by 17.0%",
    );
    expect(headlineFor([])).toContain("pending");
  });
});
