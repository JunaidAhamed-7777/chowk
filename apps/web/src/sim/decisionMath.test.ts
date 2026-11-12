import { readFileSync } from "node:fs";
import {
  AREA_HYSTERESIS,
  COUNT_HYSTERESIS,
  ControllerDriver,
  createController,
  type PolicyWeights,
} from "@chowk/controllers";
import { scorePressure } from "@chowk/controllers/pressure";
import { saturationFor } from "@chowk/scenarios";
import { corridor, createSim, type JunctionSense } from "@chowk/sim";
import { describe, expect, test } from "vitest";
import { InspectedController } from "../workers/inspectedController";
import {
  ACTUATED_EXTEND_THRESHOLD,
  controllerModel,
  matchesController,
  phaseLabels,
  pressureBreakdown,
  turnShares,
} from "./decisionMath";
import { makeLiveScenario } from "./liveScenario";

const policy = JSON.parse(
  readFileSync(new URL("../../public/policies/chowk.json", import.meta.url), "utf8"),
) as PolicyWeights;
const scenario = makeLiveScenario("morning-peak");

function run(id: "chowk" | "mp-area" | "mp-count", ticks = 1_200) {
  const inspected = new InspectedController(
    createController(id, {
      policy: id === "chowk" ? policy : undefined,
      saturation: (link) => saturationFor(corridor, scenario, link),
    }),
  );
  inspected.enabled = true;
  const sim = createSim({ network: corridor, scenario, seed: 500_003, maxVehicles: 2_000 });
  const driver = new ControllerDriver(sim, corridor, scenario, inspected);
  driver.advanceTo(ticks);
  return { inspected, driver };
}

describe("decision arithmetic shown in the browser", () => {
  test("restates scorePressure term by term for both bases", () => {
    const { inspected } = run("mp-area");
    const shares = turnShares(corridor, scenario);
    for (const { id } of corridor.junctions) {
      const record = inspected.decision(id);
      expect(record).toBeDefined();
      if (!record) continue;
      for (const [basis, hysteresis] of [
        ["area", AREA_HYSTERESIS],
        ["count", COUNT_HYSTERESIS],
      ] as const) {
        const expected = new Float64Array(corridor.junctions[id].phases.length);
        scorePressure(corridor, id, record.sense, shares, basis, hysteresis, expected);
        const breakdown = pressureBreakdown(corridor, id, record.sense, shares, basis, hysteresis);
        expect(breakdown.map(({ pressure }) => pressure)).toEqual(Array.from(expected));
      }
    }
  });

  test("reproduces the live CHOWK prior and max-pressure scores at every junction", () => {
    for (const id of ["chowk", "mp-area", "mp-count"] as const) {
      const { inspected, driver } = run(id);
      const model = controllerModel(id, id === "chowk" ? policy : undefined);
      for (const junction of corridor.junctions) {
        const record = inspected.decision(junction.id);
        if (!record || !model.basis) throw new Error("Missing decision record");
        const breakdown = pressureBreakdown(
          corridor,
          junction.id,
          record.sense,
          turnShares(corridor, scenario),
          model.basis,
          model.hysteresis,
        );
        expect(matchesController(breakdown, model, driver.explain(junction.id))).toBe(true);
      }
    }
  }, 30_000);

  test("names every phase by the approaches it serves", () => {
    for (const { id, phases } of corridor.junctions) {
      const labels = phaseLabels(corridor, id);
      expect(labels).toHaveLength(phases.length);
      for (const label of labels) expect(label).toMatch(/^(North|East|South|West)( \+ .+)?$/);
    }
  });

  test("mirrors the actuated controller's extension threshold", () => {
    const junction = corridor.junctions[2];
    const choose = (areaNear: number) => {
      const controller = createController("actuated");
      controller.init(corridor, scenario);
      const sense: JunctionSense = {
        phase: 0,
        state: "green",
        elapsed: junction.minGreen,
        approaches: junction.approaches.map(() => ({
          areaNear,
          areaMid: 0,
          areaFar: 0,
          stoppedArea: 0,
          count: 1,
          people: 1,
          waitMax: 0,
          emergency: 0,
          outArea: 0,
          exits: [],
        })),
      };
      return controller.act(junction.id, sense, { time: 0, approaches: [] });
    };
    expect(choose(ACTUATED_EXTEND_THRESHOLD)).toBe(0);
    expect(choose(ACTUATED_EXTEND_THRESHOLD * 0.99)).not.toBe(0);
  });
});
