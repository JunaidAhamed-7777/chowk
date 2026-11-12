import { makeScenario, type ScenarioId, trafficMixes } from "@chowk/scenarios";
import { DT, type ScheduledEvent } from "@chowk/sim";

export const liveSeed = 1042;
// A first trip needs time to cross the outer junctions before it reaches the
// central arterial. Warm up past that travel time so the opening shows both.
export const warmupSeconds = 240;
export const liveDuration = 3600;
export type PresetId = "stadium-exit" | "procession" | "school-closing" | "waterlogging";
export type LiveScenarioId = ScenarioId | PresetId | "custom";

const at = (seconds: number) => Math.round((warmupSeconds + seconds) / DT);

/**
 * Live-only stories built from the simulator's own events on calibrated scenarios. They are
 * not part of the benchmark. Links and sources refer to packages/sim/networks/corridor.json.
 */
export const presets: Record<
  PresetId,
  {
    label: string;
    base: ScenarioId;
    load?: number;
    mix?: readonly number[];
    events: ScheduledEvent[];
  }
> = {
  "stadium-exit": {
    label: "Stadium exit",
    base: "off-peak",
    load: 0.7,
    events: [
      { tick: at(60), event: { type: "surge", source: 6, multiplier: 4, duration: 480 } },
      { tick: at(90), event: { type: "surge", source: 7, multiplier: 2.5, duration: 420 } },
    ],
  },
  procession: {
    label: "Festival procession",
    base: "festival",
    events: [
      {
        tick: at(45),
        event: {
          type: "block",
          link: 8,
          start: 140,
          end: 200,
          strip: 0,
          strips: 10,
          duration: 600,
        },
      },
    ],
  },
  "school-closing": {
    label: "School closing",
    base: "off-peak",
    load: 0.8,
    mix: [0.62, 0.2, 0.12, 0.02, 0.04, 0],
    events: [
      { tick: at(30), event: { type: "surge", source: 4, multiplier: 3, duration: 360 } },
      { tick: at(30), event: { type: "surge", source: 8, multiplier: 3, duration: 360 } },
    ],
  },
  waterlogging: {
    label: "Waterlogging",
    base: "monsoon",
    events: [
      {
        tick: at(20),
        event: {
          type: "block",
          link: 6,
          start: 150,
          end: 240,
          strip: 0,
          strips: 9,
          duration: 3_000,
        },
      },
    ],
  },
};
export const presetCatalog = (Object.keys(presets) as PresetId[]).map((id) => ({
  id,
  label: presets[id].label,
}));
export function isPreset(id: string): id is PresetId {
  return Object.hasOwn(presets, id);
}

export interface CustomDemandValues {
  load: number;
  weights: readonly number[];
}

export const initialCustomDemand: CustomDemandValues = {
  load: 0.95,
  weights: trafficMixes.mixed.slice(0, 5).map((share) => Math.round(share * 100)),
};

export function parseCustomDemand(load: string | null, weights: string | null) {
  if (load === null || weights === null) return undefined;
  const level = Number(load);
  const mix = weights.split(",").map(Number);
  return Number.isFinite(level) &&
    level >= 0.4 &&
    level <= 1.4 &&
    mix.length === initialCustomDemand.weights.length &&
    mix.every((weight) => Number.isSafeInteger(weight) && weight >= 0 && weight <= 100) &&
    mix.some((weight) => weight > 0)
    ? { load: level, weights: mix }
    : undefined;
}

export function makeLiveScenario(
  id: LiveScenarioId = "morning-peak",
  demandScale = 1,
  custom: CustomDemandValues = initialCustomDemand,
) {
  const preset = isPreset(id) ? presets[id] : undefined;
  const scenario = preset
    ? (() => {
        const base = makeScenario(preset.base, {
          duration: liveDuration,
          load: preset.load,
          mix: preset.mix,
        });
        return {
          ...base,
          events: [...base.events, ...preset.events].sort((a, b) => a.tick - b.tick),
        };
      })()
    : id === "custom"
      ? makeScenario("morning-peak", {
          duration: liveDuration,
          load: custom.load,
          mix: [...custom.weights, 0],
        })
      : makeScenario(id as ScenarioId, { duration: liveDuration });
  if (demandScale === 1) return scenario;
  return {
    ...scenario,
    load: scenario.load * demandScale,
    sources: scenario.sources.map((source) => ({
      ...source,
      rates: source.rates.map(({ t, rate }) => ({ t, rate: rate * demandScale })),
    })),
  };
}
