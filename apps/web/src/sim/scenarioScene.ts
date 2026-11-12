import type { LiveScenarioId } from "./liveScenario";

export type Mood = "day" | "evening" | "night";

export interface ScenarioScene {
  title: string;
  description: string;
  mood: Mood;
  rain: boolean;
  /** Clock time, in seconds after midnight, at which the scenario's hour begins. */
  start: number;
}

const hours = (value: number) => value * 3600;

// Descriptions restate the demand settings in packages/scenarios; the times of day are a setting
// for the scene only, since demand does not depend on the clock.
export const scenarioScenes: Record<LiveScenarioId, ScenarioScene> = {
  "morning-peak": {
    title: "Morning peak",
    description:
      "Weekday rush hour. Traffic runs at 95% of what the junctions can handle, and 65% of it heads east.",
    mood: "day",
    rain: false,
    start: hours(8.5),
  },
  "evening-peak": {
    title: "Evening peak",
    description:
      "The ride home. The same heavy traffic as the morning, but now 65% of it heads west.",
    mood: "evening",
    rain: false,
    start: hours(18),
  },
  "off-peak": {
    title: "Off-peak",
    description: "A quiet night. Traffic runs at 55% of capacity, split evenly between directions.",
    mood: "night",
    rain: false,
    start: hours(22),
  },
  festival: {
    title: "Festival traffic",
    description:
      "A festival night. More two-wheelers and buses, more traffic from side streets, and 85% of capacity overall.",
    mood: "night",
    rain: false,
    start: hours(20),
  },
  monsoon: {
    title: "Monsoon",
    description:
      "Heavy rain. Drivers go 20% slower and leave 20% bigger gaps, so the same rush-hour traffic clears more slowly.",
    mood: "night",
    rain: true,
    start: hours(21),
  },
  oversaturated: {
    title: "Oversaturated",
    description:
      "More traffic than the junctions can clear: 115% of capacity. Queues grow whatever the signals do.",
    mood: "night",
    rain: false,
    start: hours(21),
  },
  "cars-only": {
    title: "Cars only, in lanes",
    description:
      "A comparison case: only cars, keeping to lanes, instead of the mixed, lane-free traffic in the other scenarios.",
    mood: "night",
    rain: false,
    start: hours(23),
  },
  custom: {
    title: "Custom demand",
    description: "Your own traffic level and vehicle mix, set in the Custom demand panel.",
    mood: "night",
    rain: false,
    start: hours(21),
  },
};

export function clockTime(scene: ScenarioScene, elapsed: number) {
  const total = Math.floor(scene.start + Math.max(0, elapsed)) % 86_400;
  const hour = Math.floor(total / 3600);
  const minute = Math.floor((total % 3600) / 60);
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}
