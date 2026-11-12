import { readFileSync } from "node:fs";
import { ControllerDriver, createController, type PolicyWeights } from "@chowk/controllers";
import { saturationFor } from "@chowk/scenarios";
import { corridor, createSim } from "@chowk/sim";
import { expect, test } from "vitest";
import { makeLiveScenario } from "./liveScenario";

const policy = JSON.parse(
  readFileSync(new URL("../../public/policies/chowk.json", import.meta.url), "utf8"),
) as PolicyWeights;
const scenario = makeLiveScenario("morning-peak");
const controller = (id: "chowk" | "webster" | "actuated" | "mp-area") =>
  createController(id, {
    policy: id === "chowk" ? policy : undefined,
    saturation: (link) => saturationFor(corridor, scenario, link),
  });

test.each(["chowk", "webster", "actuated", "mp-area"] as const)(
  "a restored clone continues bit for bit under %s",
  (id) => {
    const original = new ControllerDriver(
      createSim({ network: corridor, scenario, seed: 500_006 }),
      corridor,
      scenario,
      controller(id),
    );
    original.advanceTo(1_210);
    const restored = new ControllerDriver(original.sim.clone(), corridor, scenario, controller(id));
    expect(restored.tick).toBe(original.tick);
    original.advanceTo(2_800);
    restored.advanceTo(2_800);
    expect(restored.sim.hash()).toBe(original.sim.hash());
  },
);
