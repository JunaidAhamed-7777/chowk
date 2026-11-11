import { ControllerDriver, createController } from "@chowk/controllers";
import { makeScenario } from "@chowk/scenarios";
import { corridor, createSim, DT } from "@chowk/sim";

export function determinismFixture() {
  const seed = 500_002;
  const totalTicks = 10_000;
  const scenario = makeScenario("off-peak", { duration: totalTicks * DT, sensorNoise: 0.05 });
  const sim = createSim({ network: corridor, scenario, seed });
  const driver = new ControllerDriver(sim, corridor, scenario, createController("mp-area"));
  const checkpoints: number[] = [];
  for (let tick = 1_000; tick <= totalTicks; tick += 1_000) {
    if (tick === 4_000) sim.inject({ type: "surge", source: 0, duration: 60, multiplier: 1.5 });
    driver.advanceTo(tick);
    checkpoints.push(sim.hash());
  }
  return { checkpoints, metrics: sim.metrics(), sense: sim.sense(2) };
}
