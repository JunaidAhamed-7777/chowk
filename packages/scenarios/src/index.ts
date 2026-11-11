import {
  corridor,
  DT,
  type Network,
  type Scenario,
  type ScheduledEvent,
  type SourceDemand,
} from "@chowk/sim";
import calibration from "../../../results/calibration.json";
import { type MixId, trafficMixes } from "./mixes";

const definitions = {
  "morning-peak": { label: "Morning peak", load: 0.95, east: 0.65, cross: 0.3, mix: "mixed" },
  "evening-peak": { label: "Evening peak", load: 0.95, east: 0.35, cross: 0.3, mix: "mixed" },
  "off-peak": { label: "Off-peak", load: 0.55, east: 0.5, cross: 0.35, mix: "mixed" },
  festival: { label: "Festival traffic", load: 0.85, east: 0.5, cross: 0.4, mix: "festival" },
  monsoon: { label: "Monsoon", load: 0.95, east: 0.65, cross: 0.3, mix: "mixed" },
  oversaturated: { label: "Oversaturated", load: 1.15, east: 0.6, cross: 0.3, mix: "mixed" },
  "cars-only": { label: "Cars only", load: 0.95, east: 0.65, cross: 0.3, mix: "cars" },
} as const;

export type ScenarioId = keyof typeof definitions;
export const scenarioCatalog = (Object.keys(definitions) as ScenarioId[]).map((id) => ({
  id,
  label: definitions[id].label,
}));
export { trafficMixes } from "./mixes";

export interface ScenarioOptions {
  network?: Network;
  duration?: number;
  load?: number;
  mix?: readonly number[];
  eastShare?: number;
  crossShare?: number;
  monsoon?: boolean;
  sensorNoise?: number;
  sensorDropout?: number;
}

export interface CalibratedScenario extends Scenario {
  readonly id: ScenarioId;
  readonly label: string;
  readonly load: number;
  readonly calibrationMix: MixId;
  readonly criticalJunction: number;
  readonly events: readonly ScheduledEvent[];
}

function normalizedMix(input: readonly number[]): readonly number[] {
  if (
    input.length !== trafficMixes.mixed.length ||
    input.some((weight) => !Number.isFinite(weight) || weight < 0)
  ) {
    throw new RangeError("A vehicle mix needs six non-negative class weights");
  }
  const total = input.reduce((sum, weight) => sum + weight, 0);
  if (!Number.isFinite(total) || total <= 0)
    throw new RangeError("A vehicle mix needs positive total weight");
  return input.map((weight) => weight / total);
}

function closestMix(input: readonly number[]): MixId {
  let best: MixId = "mixed";
  let least = Infinity;
  for (const id of Object.keys(trafficMixes) as MixId[]) {
    const distance = trafficMixes[id].reduce<number>(
      (sum, share, index) => sum + Math.abs(share - input[index]),
      0,
    );
    if (distance < least) {
      best = id;
      least = distance;
    }
  }
  return best;
}

function capacity(mix: MixId, strips: number): number {
  const row = calibration.rows.find((entry) => entry.mix === mix && entry.strips === strips);
  if (!row) throw new RangeError(`No measured saturation flow for ${mix}, ${strips} strips`);
  return row.vehiclesPerSecond;
}

export function saturationFor(network: Network, scenario: Scenario, linkId: number): number {
  const mix = scenario.laneDisciplined
    ? "cars"
    : closestMix(normalizedMix(scenario.mix ?? trafficMixes.mixed));
  const link = network.links[linkId];
  if (!link) throw new RangeError(`Unknown link ${linkId}`);
  return capacity(mix, link.strips);
}

function routeWeights(network: Network, source: number): SourceDemand["routes"] {
  const turning = (from: number, to: number) => {
    const connector = network.connectors.find(
      (entry) => entry.fromLink === from && entry.toLink === to,
    );
    if (!connector) throw new Error(`Route references a missing connector from ${from} to ${to}`);
    const arterial =
      network.links[from].strips === 21 && Math.abs(network.links[from].dir[0]) > 0.9;
    const weight =
      connector.movement === "through" ? (arterial ? 0.7 : 0.5) : arterial ? 0.15 : 0.25;
    return { movement: connector.movement, weight };
  };
  const grouped = { through: 0, left: 0, right: 0 };
  const candidates = network.routes
    .filter((route) => route.source === source)
    .map((route) => {
      const first = turning(route.links[0], route.links[1]);
      let downstream = 1;
      for (let index = 1; index + 1 < route.links.length; index++) {
        downstream *= turning(route.links[index], route.links[index + 1]).weight;
      }
      grouped[first.movement] += downstream;
      return { id: route.id, first, downstream };
    });
  return candidates.map(({ id, first, downstream }) => ({
    route: id,
    weight: (first.weight * downstream) / grouped[first.movement],
  }));
}

function sourceFractions(network: Network, east: number, cross: number): number[] {
  const directions = network.sources.map(({ link }) => {
    const { dir } = network.links[link];
    return dir[0] > 0.9 ? 0 : dir[0] < -0.9 ? 1 : 2;
  });
  const weights = [(1 - cross) * east, (1 - cross) * (1 - east), cross];
  const totalStrips = [0, 0, 0];
  for (const source of network.sources)
    totalStrips[directions[source.id]] += network.links[source.link].strips;
  const sum = weights.reduce(
    (total, weight, direction) => total + (totalStrips[direction] > 0 ? weight : 0),
    0,
  );
  if (sum <= 0) throw new RangeError("The chosen flow has no eligible entry in this network");
  return network.sources.map(({ id, link }) => {
    const direction = directions[id];
    return (weights[direction] * network.links[link].strips) / (sum * totalStrips[direction]);
  });
}

function festivalEvents(network: Network, duration: number): ScheduledEvent[] {
  const cross = network.sources.filter(({ link }) => Math.abs(network.links[link].dir[1]) > 0.9);
  if (cross.length === 0) return [];
  return [600, 1_200]
    .filter((second) => second < duration)
    .map((second, index) => ({
      tick: Math.round(second / DT),
      event: {
        type: "surge",
        source: cross[Math.min(index, cross.length - 1)].id,
        duration: 90,
        multiplier: 2.5,
      },
    }));
}

export function makeScenario(id: ScenarioId, options: ScenarioOptions = {}): CalibratedScenario {
  const definition = definitions[id];
  if (!definition) throw new RangeError(`Unknown scenario ${id}`);
  const { network = corridor, duration = 2_100 } = options;
  const load = options.load ?? definition.load;
  const east = options.eastShare ?? definition.east;
  const cross = options.crossShare ?? definition.cross;
  if (
    !Number.isFinite(duration) ||
    duration <= 0 ||
    !Number.isFinite(load) ||
    load < 0 ||
    !Number.isFinite(east) ||
    east < 0 ||
    east > 1 ||
    !Number.isFinite(cross) ||
    cross < 0 ||
    cross > 1
  ) {
    throw new RangeError("Invalid duration, load or direction shares");
  }
  const laneDisciplined = id === "cars-only";
  const mix = normalizedMix(
    laneDisciplined ? trafficMixes.cars : (options.mix ?? trafficMixes[definition.mix]),
  );
  const calibrationMix = closestMix(mix);
  const fractions = sourceFractions(network, east, cross);
  const routes = network.sources.map(({ id }) => routeWeights(network, id));
  const approaches = new Float64Array(network.links.length);
  for (const source of network.sources) {
    const shares = routes[source.id];
    const total = shares.reduce((sum, share) => sum + share.weight, 0);
    for (const { route, weight } of shares) {
      const fraction = (fractions[source.id] * weight) / total;
      for (const link of network.routes[route].links) approaches[link] += fraction;
    }
  }
  const normalizedLoads = network.junctions.map((junction) => {
    const lost = junction.phases.length * (junction.yellow + junction.allRed);
    return (
      junction.approaches.reduce(
        (sum, link) =>
          sum + approaches[link] / capacity(calibrationMix, network.links[link].strips),
        0,
      ) /
      (1 - lost / 150)
    );
  });
  const criticalJunction =
    network.id === corridor.id ? 2 : normalizedLoads.indexOf(Math.max(...normalizedLoads));
  const rate = load / normalizedLoads[criticalJunction];
  if (!Number.isFinite(rate)) throw new Error("The critical junction has no calibratable flow");
  const ramp = id === "morning-peak" || id === "evening-peak" || id === "monsoon";
  return {
    id,
    label: definition.label,
    duration,
    load,
    mix,
    laneDisciplined,
    criticalJunction,
    calibrationMix,
    monsoon: options.monsoon ?? id === "monsoon",
    sensorNoise: options.sensorNoise,
    sensorDropout: options.sensorDropout,
    events: id === "festival" ? festivalEvents(network, duration) : [],
    sources: network.sources.map(({ id }) => {
      const nominal = rate * fractions[id];
      const rates = ramp
        ? [
            { t: 0, rate: 0.75 * nominal },
            { t: Math.min(300, duration * 0.2), rate: 0.75 * nominal },
            { t: duration * 0.6, rate: nominal },
            { t: duration, rate: 0.85 * nominal },
          ]
        : [{ t: 0, rate: nominal }];
      return { source: id, rates, routes: routes[id] };
    }),
  };
}
