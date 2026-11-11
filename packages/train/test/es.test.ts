import { Random } from "@chowk/sim";
import { describe, expect, test } from "vitest";
import { adamState, noiseVector, perturb, rankUtilities, updateCenter } from "../src/es";
import { sampledEpisodes } from "../src/domain";
import { requireTrainingSeed } from "../src/seed";

describe("evolution strategies", () => {
  test("ranks tied candidates symmetrically", () => {
    expect([...rankUtilities([1, 0, 1, 2])]).toEqual([0, 0.5, 0, -0.5]);
    expect([...rankUtilities([2, 2])]).toEqual([0, 0]);
  });

  test("antithetic samples and Adam reduce a toy objective", () => {
    const random = new Random(121);
    const center = new Float32Array([3, -2, 1]);
    const state = adamState(center.length);
    const objective = (point: Float32Array) => point.reduce((sum, value) => sum + value * value, 0);
    const initial = objective(center);
    for (let generation = 0; generation < 50; generation++) {
      const sigma = 0.08;
      const noise = Array.from({ length: 10 }, () => noiseVector(center.length, random));
      const results = noise.flatMap((direction) =>
        [sigma, -sigma].map((amount) => objective(perturb(center, direction, amount))),
      );
      updateCenter(center, noise, results, sigma, 0.075, 0, state);
    }
    expect(objective(center)).toBeLessThan(initial / 20);
  });
});

describe("training seeds and domain", () => {
  test("rejects seeds outside their permitted split", () => {
    expect(() => requireTrainingSeed(0, "training")).not.toThrow();
    expect(() => requireTrainingSeed(500_019, "validation")).not.toThrow();
    expect(() => requireTrainingSeed(500_000, "training")).toThrow(/training split/);
    expect(() => requireTrainingSeed(100_000, "training")).toThrow(/training split/);
    expect(() => requireTrainingSeed(1_000_000, "training")).toThrow(/training split/);
    expect(() => requireTrainingSeed(1_000_000, "validation")).toThrow(/validation split/);
  });

  test("reproduces domain samples and schedules real events in tick order", () => {
    const horizon = { warmup: 30, measured: 90 };
    const episodes = sampledEpisodes(new Random(221), 50, horizon);
    expect(episodes).toEqual(sampledEpisodes(new Random(221), 50, horizon));
    expect(episodes.some(({ scenario }) => scenario.monsoon)).toBe(true);
    expect(episodes.some(({ scenario }) => scenario.laneDisciplined)).toBe(true);
    expect(
      new Set(
        episodes.flatMap(({ scenario }) => scenario.events?.map(({ event }) => event.type) ?? []),
      ),
    ).toEqual(new Set(["surge", "ambulance", "block"]));
    for (const episode of episodes) {
      requireTrainingSeed(episode.seed, episode.split);
      const ticks = episode.scenario.events?.map(({ tick }) => tick) ?? [];
      expect(ticks).toEqual([...ticks].sort((a, b) => a - b));
    }
  });
});
