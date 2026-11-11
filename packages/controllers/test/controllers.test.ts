import { corridor, createSim, type JunctionSense, Random, type Scenario } from "@chowk/sim";
import { describe, expect, test, vi } from "vitest";
import {
  ControllerDriver,
  createController,
  decodePolicy,
  encodePolicy,
  generationZero,
} from "../src";
import { expectedDemand, meanRate } from "../src/demand";
import { Inference } from "../src/policy/inference";
import { buildObservation, layoutFor } from "../src/policy/observation";
import { websterPlan } from "../src/webster";

const scenario: Scenario = { duration: 300, sources: [] };
const neighbours = { time: 0, approaches: [] };

function sense(junction: number, phase = 0): JunctionSense {
  return {
    phase,
    state: "green",
    elapsed: 20,
    approaches: corridor.junctions[junction].approaches.map(() => ({
      areaNear: 0,
      areaMid: 0,
      areaFar: 0,
      stoppedArea: 0,
      count: 0,
      people: 0,
      waitMax: 0,
      emergency: 0,
      outArea: 0,
      exits: [],
    })),
  };
}

describe("classical controllers", () => {
  test("integrates true source rates and assigns weighted routes", () => {
    const [routeA, routeB] = corridor.routes.filter(({ source }) => source === 0);
    const rates = [
      { t: 0, rate: 1 },
      { t: 100, rate: 3 },
    ];
    expect(meanRate(rates, 50, 150)).toBe(2.75);
    const expected = expectedDemand(corridor, {
      duration: 100,
      sources: [
        {
          source: 0,
          rates,
          routes: [
            { route: routeA.id, weight: 1 },
            { route: routeB.id, weight: 3 },
          ],
        },
      ],
    });
    expect(expected.approach[routeA.links[0]]).toBe(2);
    expect(expected.shares[routeA.links[0]].reduce((sum, entry) => sum + entry.share, 0)).toBe(1);
  });

  test("Webster matches the cycle equation and bounded proportional greens", () => {
    const junction = corridor.junctions[0];
    const ratios = [0.12, 0.18, 0.24, 0.16];
    const lost = junction.phases.length * (junction.yellow + junction.allRed);
    const cycle = (1.5 * lost + 5) / 0.3;
    const plan = websterPlan(junction, ratios);
    expect(plan.cycle).toBeCloseTo(cycle, 9);
    for (let phase = 0; phase < ratios.length; phase++) {
      expect(plan.greens[phase]).toBeCloseTo(((cycle - lost) * ratios[phase]) / 0.7, 9);
    }
    const split = websterPlan({ ...junction, maxGreen: 35 }, [0.9, 0.001, 0.001, 0]);
    expect(split.greens[0]).toBeCloseTo(35);
    expect(split.greens[3]).toBeGreaterThanOrEqual(junction.minGreen);
    expect(split.cycle).toBeLessThanOrEqual(150.000001);
  });

  test("actuated extends the green and skips empty phases", () => {
    const controller = createController("actuated");
    controller.init(corridor, scenario);
    const input = sense(0);
    input.approaches[0].areaNear = 0.4;
    input.approaches[2].count = 3;
    expect(controller.act(0, input, neighbours)).toBe(0);
    input.approaches[0].areaNear = 0;
    expect(controller.act(0, input, neighbours)).toBe(2);
  });

  test("max-pressure weights exits by route share and applies hysteresis", () => {
    const controller = createController("mp-count", { hysteresis: 2 });
    controller.init(corridor, scenario);
    const input = sense(0);
    input.approaches[0].count = 6;
    input.approaches[1].count = 9;
    input.approaches[1].exits = corridor.connectors
      .filter(({ fromLink }) => fromLink === corridor.junctions[0].approaches[1])
      .map(({ toLink }) => ({ link: toLink, area: 0.4, count: 2 }));
    expect(controller.act(0, input, neighbours)).toBe(0);
    input.approaches[1].count = 11;
    expect(controller.act(0, input, neighbours)).toBe(1);
  });

  test("ambulance preemption selects its approach regardless of pressure", () => {
    const controller = createController("mp-area+preempt");
    controller.init(corridor, scenario);
    const input = sense(0);
    input.approaches[0].areaNear = 1;
    input.approaches[2].emergency = 1;
    expect(controller.act(0, input, neighbours)).toBe(2);
    expect(controller.explain?.(0)?.reason).toContain("ambulance");
  });
});

describe("decision driver", () => {
  test("guards the longest wait and masks invalid phases on a T-junction", () => {
    const sim = createSim({ network: corridor, scenario, seed: 500_000 });
    const driver = new ControllerDriver(sim, corridor, scenario, {
      id: "actuated",
      init() {},
      act: () => 5,
    });
    vi.spyOn(sim, "sense").mockImplementation((junction) => {
      const input = sense(junction);
      if (junction === 0) input.approaches[2].waitMax = 151;
      return input;
    });
    const requests = vi.spyOn(sim, "requestPhase");
    driver.advanceTo(21);
    expect(requests).toHaveBeenCalledTimes(10);
    expect(requests).toHaveBeenCalledWith(0, 2);
    expect(requests).toHaveBeenCalledWith(4, 0);
    expect(driver.explain(0)?.reason).toContain("longest wait");
  });
});

describe("residual policy", () => {
  test("round-trips binary weights and matches a hand-computed ReLU output", () => {
    const vector = generationZero();
    vector[0] = 2;
    vector[3_200] = -1;
    vector[3_264] = 0.5;
    vector[7_360] = 0.5;
    vector[7_424] = 4;
    vector[7_680] = 0.25;
    const encoded = encodePolicy(vector, {
      generation: 0,
      validationFitness: 1,
      gitCommit: "fixture",
      configHash: "fixture",
    });
    expect(decodePolicy(encoded)).toEqual(vector);
    const observations = new Float64Array(50);
    observations[0] = 1.25;
    const output = new Float64Array(4);
    new Inference(decodePolicy(encoded)).evaluate(observations, output);
    expect([...output]).toEqual([5.25, 0, 0, 0]);
    expect(() => decodePolicy({ ...encoded, obsVersion: 2 })).toThrow(/format/);
  });

  test("rotates around the active approach and preserves the missing T leg", () => {
    const layout = layoutFor(corridor, 4);
    const input = sense(4, 1);
    const output = new Float64Array(50);
    buildObservation(
      layout,
      input,
      { time: 20, approaches: [{ releasing: true, elapsed: 30 }] },
      output,
      false,
      false,
    );
    expect(output[8]).toBe(1);
    expect(
      [output[9], output[19], output[29], output[39]].filter((item) => item === 0),
    ).toHaveLength(1);
    expect(output[48]).toBeCloseTo(1 / 3);
  });

  test("generation zero exactly matches area max-pressure across random observations", () => {
    const baseline = createController("mp-area");
    const policy = createController("chowk");
    baseline.init(corridor, scenario);
    policy.init(corridor, scenario);
    const random = new Random(97);
    for (let iteration = 0; iteration < 2_000; iteration++) {
      const junction = iteration % corridor.junctions.length;
      const site = corridor.junctions[junction];
      const input = sense(junction, Math.floor(random.next() * site.phases.length));
      for (let index = 0; index < input.approaches.length; index++) {
        const approach = input.approaches[index];
        approach.areaNear = random.next();
        approach.areaMid = random.next();
        approach.exits = corridor.connectors
          .filter(({ fromLink }) => fromLink === site.approaches[index])
          .map(({ toLink }) => ({ link: toLink, area: random.next(), count: 0 }));
      }
      expect(policy.act(junction, input, neighbours)).toBe(
        baseline.act(junction, input, neighbours),
      );
    }
    const explanation = policy.explain?.(0);
    expect(explanation?.scores).toEqual(explanation?.prior);
    expect(explanation?.learned).toEqual([0, 0, 0, 0]);
  });
});
