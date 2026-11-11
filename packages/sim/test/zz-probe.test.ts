import { makeScenario } from "@chowk/scenarios";
import { it } from "vitest";
import { DT } from "../src/constants";
import { corridor } from "../src/corridor";
import { createSim } from "../src/sim";

it("probe green discharge", () => {
  const scenario = makeScenario("morning-peak");
  const sim = createSim({ network: corridor, scenario, seed: 500001 });
  // biome-ignore lint/suspicious/noExplicitAny: temporary probe
  const raw = sim as any;
  const junction = corridor.junctions[2];
  const connectorsAt = corridor.connectors.filter((c) => c.junction === junction.id);
  let greenQueued = 0;
  let turnInBox = 0;
  let nothingEntering = 0;
  let crossed = 0;
  const seen = new Set<number>();
  for (let tick = 0; tick < 2400 / DT; tick++) {
    if (tick % 140 === 0) {
      for (const j of corridor.junctions)
        sim.requestPhase(j.id, (sim.signalBank.phase[j.id] + 1) % j.phases.length);
    }
    sim.step();
    if (tick < 300 / DT) continue;
    if (sim.signalBank.state[junction.id] !== 0) continue;
    const road = corridor.links[junction.phases[sim.signalBank.phase[junction.id]].approaches[0]];
    const v = sim.vehicles;
    let queued = false;
    for (let i = 0; i < v.counts[road.id]; i++) {
      const slot = v.byLink[road.id][i];
      if (road.length - v.s[slot] > 25) break;
      if (v.v[slot] < 1) queued = true;
    }
    if (!queued) continue;
    greenQueued++;
    let anyMoving = false;
    for (const c of connectorsAt) {
      if (c.fromLink !== road.id) continue;
      for (let i = 0; i < v.counts[c.id]; i++) {
        const slot = v.byLink[c.id][i];
        const id = v.id[slot];
        if (!seen.has(id)) {
          seen.add(id);
          crossed++;
        }
        anyMoving = true;
        if (c.movement !== "through") turnInBox++;
      }
    }
    if (!anyMoving) nothingEntering++;
  }
  const seconds = greenQueued * DT;
  console.log(
    JSON.stringify({
      greenQueuedSeconds: seconds,
      vehiclesPerGreenSecond: crossed / seconds,
      turnInBoxShare: (turnInBox * DT) / seconds,
      boxEmptyWhileQueuedShare: (nothingEntering * DT) / seconds,
      status: raw.signalBank ? "ok" : "?",
    }),
  );
});
