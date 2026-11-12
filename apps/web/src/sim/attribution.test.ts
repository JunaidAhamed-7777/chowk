import { createController, POLICY_VECTOR_LENGTH } from "@chowk/controllers";
import { buildObservation, layoutFor } from "@chowk/controllers/observation";
import { corridor, createSim } from "@chowk/sim";
import { expect, test } from "vitest";
import { attribute } from "./attribution";
import { makeLiveScenario } from "./liveScenario";

function randomVector(seed: number) {
  const vector = new Float32Array(POLICY_VECTOR_LENGTH);
  let state = seed;
  for (let index = 0; index < vector.length; index++) {
    state = (Math.imul(state, 1_103_515_245) + 12_345) >>> 0;
    vector[index] = (state / 0x1_0000_0000 - 0.5) * 0.4;
  }
  vector[POLICY_VECTOR_LENGTH - 1] = 1;
  return vector;
}

test("browser attribution reproduces CHOWK's learned outputs and sums to each", () => {
  const scenario = makeLiveScenario("morning-peak");
  const sim = createSim({ network: corridor, scenario, seed: 500_004 });
  sim.step(1_600);
  const parameters = randomVector(7);
  const controller = createController("chowk", { parameters });
  controller.init(corridor, scenario);
  let checked = 0;
  for (const { id, phases } of corridor.junctions) {
    const sense = sim.sense(id);
    const neighbours = {
      time: sim.time,
      approaches: sense.approaches.map(() => ({ releasing: false, elapsed: 0 })),
    };
    controller.act(id, sense, neighbours);
    const learned = controller.explain?.(id)?.learned;
    expect(learned).toBeDefined();
    const layout = layoutFor(corridor, id);
    const observation = new Float64Array(50);
    buildObservation(layout, sense, neighbours, observation, false, false);
    const current = layout.directionOfPhase[sense.phase];
    for (let phase = 0; phase < phases.length; phase++) {
      const relative = (layout.directionOfPhase[phase] + 4 - current) % 4;
      const result = attribute(parameters, observation, relative);
      expect(result.outputs[relative]).toBe(learned?.[phase]);
      const sum = result.contributions.reduce((total, value) => total + value, result.biasPath);
      expect(sum).toBeCloseTo(result.outputs[relative], 10);
      checked++;
    }
  }
  expect(checked).toBe(19);
});
