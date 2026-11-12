import { type createSim, DT, type JunctionSense, type Network, type Scenario } from "@chowk/sim";
import type { Controller, Explanation, NeighbourApproach, NeighbourSense } from "./types";

export const DECISION_TICKS = 20;
const STARVATION_SECONDS = 150;

interface Feeder {
  junction: number;
  phases: Uint8Array;
}

export class ControllerDriver {
  private nextDecision: number;
  private eventIndex = 0;
  private readonly feeders: (Feeder | undefined)[][];
  private readonly senses: JunctionSense[];
  private readonly neighbours: { time: number; approaches: NeighbourApproach[] }[];
  private readonly guards: (string | undefined)[];
  private current: Controller;
  tick: number;

  constructor(
    readonly sim: ReturnType<typeof createSim>,
    private readonly network: Network,
    private readonly scenario: Scenario,
    controller: Controller,
  ) {
    this.tick = Math.round(sim.time / DT);
    this.nextDecision = Math.ceil(this.tick / DECISION_TICKS) * DECISION_TICKS;
    const events = scenario.events ?? [];
    for (let index = 0; index < events.length; index++) {
      const { tick } = events[index];
      if (!Number.isSafeInteger(tick) || tick < 1 || (index > 0 && tick < events[index - 1].tick)) {
        throw new RangeError("Scenario events must be in ascending tick order");
      }
      if (tick <= this.tick) this.eventIndex++;
    }
    this.current = controller;
    controller.init(network, scenario);
    const upstream = new Map(network.junctions.map((junction) => [junction.node, junction]));
    this.feeders = network.junctions.map((junction) =>
      junction.approaches.map((link) => {
        const source = upstream.get(network.links[link].from);
        if (!source) return undefined;
        const releasing = network.connectors
          .filter(({ toLink }) => toLink === link)
          .map(({ fromLink }) => fromLink);
        return {
          junction: source.id,
          phases: Uint8Array.from(source.phases, ({ approaches }) =>
            approaches.some((id) => releasing.includes(id)) ? 1 : 0,
          ),
        };
      }),
    );
    this.neighbours = network.junctions.map(({ approaches }) => ({
      time: 0,
      approaches: approaches.map(() => ({ releasing: false, elapsed: 0 })),
    }));
    this.senses = new Array(network.junctions.length);
    this.guards = new Array(network.junctions.length);
  }

  get controller(): Controller {
    return this.current;
  }

  get maxWait(): number {
    return this.sim.metrics().maxWait;
  }

  get waitPenalty(): number {
    return this.sim.metrics().starvationSeconds;
  }

  setController(controller: Controller): void {
    controller.init(this.network, this.scenario);
    this.current = controller;
    this.guards.fill(undefined);
  }

  advanceTo(targetTick: number): void {
    if (!Number.isSafeInteger(targetTick) || targetTick < this.tick)
      throw new RangeError("Driver target must be an integer tick at or after its current tick");
    const events = this.scenario.events;
    while (this.tick < targetTick) {
      if (this.tick === this.nextDecision) {
        this.decide();
        this.nextDecision += DECISION_TICKS;
      }
      while (
        events &&
        this.eventIndex < events.length &&
        events[this.eventIndex].tick <= this.tick + 1
      ) {
        this.sim.inject(events[this.eventIndex].event);
        this.eventIndex++;
      }
      const nextEvent = events?.[this.eventIndex];
      const next = Math.min(
        this.nextDecision,
        targetTick,
        nextEvent ? nextEvent.tick - 1 : Infinity,
      );
      this.sim.step(next - this.tick);
      this.tick = next;
    }
  }

  explain(junctionId: number): Explanation | undefined {
    const explanation = this.current.explain?.(junctionId);
    const reason = this.guards[junctionId];
    return reason ? { ...explanation, scores: explanation?.scores ?? [], reason } : explanation;
  }

  private decide(): void {
    for (const { id } of this.network.junctions) this.senses[id] = this.sim.sense(id);
    const controller = this.current;
    const fixed = controller.id === "webster" || controller.id === "webster+preempt";
    for (const junction of this.network.junctions) {
      const { id } = junction;
      const sense = this.senses[id];
      const neighbours = this.neighbours[id];
      neighbours.time = this.tick * DT;
      let waited = STARVATION_SECONDS;
      let starved = -1;
      for (let approach = 0; approach < junction.approaches.length; approach++) {
        const wait = sense.approaches[approach].waitMax;
        if (wait > waited) {
          waited = wait;
          starved = junction.phases.findIndex(({ approaches }) =>
            approaches.includes(junction.approaches[approach]),
          );
        }
        const upstream = this.feeders[id][approach];
        const input = neighbours.approaches[approach];
        if (!upstream) continue;
        const release = this.senses[upstream.junction];
        input.releasing = release.state === "green" && upstream.phases[release.phase] === 1;
        input.elapsed = input.releasing ? release.elapsed : 0;
      }
      const choice = controller.act(id, sense, neighbours satisfies NeighbourSense);
      let phase = Number.isInteger(choice) && junction.phases[choice] ? choice : sense.phase;
      this.guards[id] =
        phase !== choice
          ? "Holding the current green because the requested phase is unavailable"
          : undefined;
      if (!fixed && starved >= 0) {
        phase = starved;
        this.guards[id] = "Serving the approach with the longest wait";
      }
      this.sim.requestPhase(id, phase);
    }
  }
}
