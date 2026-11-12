import { ControllerDriver, createController } from "@chowk/controllers";
import { corridor, createSim, DT } from "@chowk/sim";
import { expect, test } from "vitest";
import { makeLiveScenario, presetCatalog, warmupSeconds } from "./liveScenario";
import { scenarioScenes } from "./scenarioScene";

test.each(presetCatalog)("the $label story builds, runs and applies its events", ({ id }) => {
  const scenario = makeLiveScenario(id);
  expect(scenarioScenes[id].title).toBeTruthy();
  const events = scenario.events ?? [];
  expect(events.length).toBeGreaterThan(0);
  const last = Math.max(...events.map(({ tick }) => tick));
  const driver = new ControllerDriver(
    createSim({ network: corridor, scenario, seed: 500_013 }),
    corridor,
    scenario,
    createController("mp-area"),
  );
  driver.advanceTo(last + Math.round(30 / DT));
  expect(driver.sim.metrics().generated).toBeGreaterThan(0);
  expect(last * DT).toBeGreaterThan(warmupSeconds);
});
