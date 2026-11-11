import {
  ControllerDriver,
  createController,
  decodePolicy,
  POLICY_DIMENSIONS,
  type PolicyWeights,
} from "@chowk/controllers";
import { makeScenario } from "@chowk/scenarios";
import { corridor, createSim, DT } from "@chowk/sim";
import { Inference } from "../../controllers/src/policy/inference";
import { buildObservation, layoutFor } from "../../controllers/src/policy/observation";

const recordAfterSeconds = 300;
const batchSize = 20_000;
const repetitions = 9;

export function measurePolicy(policy: PolicyWeights): {
  policyMicroseconds: number;
  generation: number;
  observations: number;
  decisions: number;
  samplesMicroseconds: number[];
} {
  const model = new Inference(decodePolicy(policy));
  const scenario = makeScenario("morning-peak", { duration: recordAfterSeconds + 160 });
  const sim = createSim({ network: corridor, scenario, seed: 500_004 });
  const control = createController("chowk", { policy });
  const layouts = corridor.junctions.map(({ id }) => layoutFor(corridor, id));
  const observations: Float64Array[] = [];
  const driver = new ControllerDriver(sim, corridor, scenario, {
    id: "chowk",
    init: (network, demand) => control.init(network, demand),
    act(junction, sense, neighbours) {
      if (sim.time >= recordAfterSeconds && observations.length < 128) {
        const observation = new Float64Array(POLICY_DIMENSIONS[0]);
        buildObservation(layouts[junction], sense, neighbours, observation, false, false);
        observations.push(observation);
      }
      return control.act(junction, sense, neighbours);
    },
  });
  driver.advanceTo(scenario.duration / DT);
  if (observations.length < 2)
    throw new Error("The validation episode produced too few policy observations");

  const output = new Float64Array(POLICY_DIMENSIONS[3]);
  let checksum = 0;
  function batch(): number {
    const start = process.hrtime.bigint();
    for (let index = 0; index < batchSize; index++) {
      model.evaluate(observations[index % observations.length], output);
      checksum += output[index & 3];
    }
    return Number(process.hrtime.bigint() - start) / (batchSize * 1_000);
  }
  batch();
  const samplesMicroseconds = Array.from({ length: repetitions }, batch);
  if (!Number.isFinite(checksum)) throw new Error("Policy inference produced a non-finite result");
  const sorted = [...samplesMicroseconds].sort((a, b) => a - b);
  return {
    policyMicroseconds: sorted[Math.floor(sorted.length / 2)],
    generation: policy.meta.generation,
    observations: observations.length,
    decisions: repetitions * batchSize,
    samplesMicroseconds,
  };
}
