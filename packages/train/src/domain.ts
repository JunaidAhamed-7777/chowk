import { makeScenario, type ScenarioId } from "@chowk/scenarios";
import { corridor, DT, type Random, type ScheduledEvent } from "@chowk/sim";
import type { Episode } from "./episode";
import { requireTrainingSeed, TRAINING_SEED_COUNT, VALIDATION_SEEDS } from "./seed";

const nominalMix = [0.5, 0.12, 0.28, 0.05, 0.05, 0];
const validationCases: readonly ScenarioId[] = [
  "morning-peak",
  "evening-peak",
  "off-peak",
  "morning-peak",
  "festival",
  "monsoon",
  "cars-only",
  "morning-peak",
];

export interface Horizon {
  warmup: number;
  measured: number;
}

export function sampledEpisodes(
  random: Random,
  count: number,
  { warmup, measured }: Horizon,
): Episode[] {
  const episodes: Episode[] = [];
  const arterial = corridor.links.filter(
    ({ from, to, dir }) =>
      corridor.nodes[from].kind === "junction" &&
      corridor.nodes[to].kind === "junction" &&
      Math.abs(dir[0]) > Math.abs(dir[1]),
  );
  const ambulance = corridor.routes.filter(({ links }) => links.length > 5);
  for (let i = 0; i < count; i++) {
    const seed = Math.floor(random.next() * TRAINING_SEED_COUNT);
    requireTrainingSeed(seed, "training");
    const carsOnly = random.next() < 0.1;
    const duration = warmup + measured;
    const base = makeScenario(carsOnly ? "cars-only" : "morning-peak", {
      network: corridor,
      duration,
      load: 0.6 + random.next() * 0.5,
      mix: carsOnly ? undefined : nominalMix.map((share) => share * (0.7 + random.next() * 0.6)),
      eastShare: 0.32 + random.next() * 0.36,
      crossShare: 0.2 + random.next() * 0.27,
      monsoon: random.next() < 0.15,
      sensorNoise: random.next() * 0.1,
    });
    const events: ScheduledEvent[] = [...(base.events ?? [])];
    const eventTick = () =>
      Math.max(1, Math.round((warmup + (0.05 + 0.3 * random.next()) * measured) / DT));
    if (random.next() < 0.3) {
      const source = base.sources[Math.floor(random.next() * base.sources.length)].source;
      events.push({
        tick: eventTick(),
        event: { type: "surge", source, multiplier: 1.8, duration: Math.min(90, measured * 0.4) },
      });
    }
    if (random.next() < 0.2 && arterial.length) {
      const link = arterial[Math.floor(random.next() * arterial.length)];
      const start = link.length * 0.5;
      events.push({
        tick: eventTick(),
        event: {
          type: "block",
          link: link.id,
          start,
          end: start + 12,
          strip: 0,
          strips: Math.min(7, link.strips),
          duration: Math.min(120, measured * 0.4),
        },
      });
    }
    if (random.next() < 0.5 && ambulance.length) {
      const route = ambulance[Math.floor(random.next() * ambulance.length)];
      events.push({
        tick: eventTick(),
        event: { type: "ambulance", source: route.source, route: route.id },
      });
    }
    events.sort((a, b) => a.tick - b.tick);
    episodes.push({ seed, split: "training", scenario: { ...base, events }, warmup, measured });
  }
  return episodes;
}

export function validationEpisodes(count: number, { warmup, measured }: Horizon): Episode[] {
  return VALIDATION_SEEDS.slice(0, count).map((seed, index) => {
    requireTrainingSeed(seed, "validation");
    return {
      seed,
      split: "validation",
      scenario: makeScenario(validationCases[index % validationCases.length], {
        network: corridor,
        duration: warmup + measured,
      }),
      warmup,
      measured,
    };
  });
}
