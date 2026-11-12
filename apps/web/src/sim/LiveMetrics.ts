import type { Metrics } from "@chowk/sim";
import type { MetricsPair } from "./SimHost";

const metricWindow = 300;
const headlineWindow = 3600;
const chartInterval = 12;

export const metricDefinitions = [
  {
    key: "delay",
    label: "Delay per person",
    unit: "s",
    precision: 1,
    benefit: -1,
    description: "Extra travel time weighted by occupancy. Includes people waiting to enter.",
  },
  {
    key: "stops",
    label: "Stops per vehicle",
    unit: "",
    precision: 1,
    benefit: -1,
    description: "Full stops divided by vehicles generated during the window.",
  },
  {
    key: "throughput",
    label: "Throughput",
    unit: "people/h",
    precision: 0,
    benefit: 1,
    description: "People who reached their destination, expressed per simulated hour.",
  },
  {
    key: "emissions",
    label: "CO₂ estimate",
    unit: "kg/h",
    precision: 0,
    benefit: -1,
    description: "Estimated carbon dioxide from the simulator’s fuel model.",
  },
  {
    key: "ambulance",
    label: "Ambulance time",
    unit: "s",
    precision: 0,
    benefit: -1,
    description: "Travel time of the latest ambulance to reach its destination.",
  },
] as const;

type MetricKey = (typeof metricDefinitions)[number]["key"];
type MetricReadings = Record<MetricKey, number | null>;
type ReadingsPair = readonly [MetricReadings, MetricReadings];
type Totals = Pick<
  Metrics,
  | "personDelay"
  | "generatedPeople"
  | "stops"
  | "generated"
  | "completedPeople"
  | "co2Kg"
  | "lastAmbulanceTravelTime"
>;
type TotalsPair = readonly [Totals, Totals];

interface Sample {
  time: number;
  totals: TotalsPair;
}

export interface HistoryPoint {
  time: number;
  values: ReadingsPair;
}

export interface EventMark {
  id: number;
  time: number;
  label: string;
}

/** The window totals each reading divides, so the interface can show the arithmetic. */
export interface MetricParts {
  personDelay: number;
  people: number;
  stops: number;
  vehicles: number;
  completedPeople: number;
  co2Kg: number;
  hours: number;
  ambulance: number | null;
}

export interface LiveReadout {
  values: ReadingsPair;
  parts: readonly [MetricParts, MetricParts];
  window: { from: number; to: number };
  hour: { from: number; to: number; left: number; right: number };
  history: readonly HistoryPoint[];
  marks: readonly EventMark[];
  peopleHours: number;
  elapsed: number;
}

function totals({
  personDelay,
  generatedPeople,
  stops,
  generated,
  completedPeople,
  co2Kg,
  lastAmbulanceTravelTime,
}: Metrics): Totals {
  return {
    personDelay,
    generatedPeople,
    stops,
    generated,
    completedPeople,
    co2Kg,
    lastAmbulanceTravelTime,
  };
}

function parts(current: Totals, base: Totals | undefined, hours: number): MetricParts {
  return {
    personDelay: current.personDelay - (base?.personDelay ?? 0),
    people: current.generatedPeople - (base?.generatedPeople ?? 0),
    stops: current.stops - (base?.stops ?? 0),
    vehicles: current.generated - (base?.generated ?? 0),
    completedPeople: current.completedPeople - (base?.completedPeople ?? 0),
    co2Kg: current.co2Kg - (base?.co2Kg ?? 0),
    hours,
    ambulance: current.lastAmbulanceTravelTime,
  };
}

function read(current: Totals, base: Totals | undefined, hours: number): MetricReadings {
  const people = current.generatedPeople - (base?.generatedPeople ?? 0);
  const vehicles = current.generated - (base?.generated ?? 0);
  return {
    delay: people > 0 ? (current.personDelay - (base?.personDelay ?? 0)) / people : null,
    stops: vehicles > 0 ? (current.stops - (base?.stops ?? 0)) / vehicles : null,
    throughput: hours > 0 ? (current.completedPeople - (base?.completedPeople ?? 0)) / hours : null,
    emissions: hours > 0 ? (current.co2Kg - (base?.co2Kg ?? 0)) / hours : null,
    ambulance: current.lastAmbulanceTravelTime,
  };
}

export class LiveMetrics {
  private samples: Sample[] = [];
  private history: HistoryPoint[] = [];
  private marks: EventMark[] = [];

  reset() {
    this.samples = [];
    this.history = [];
    this.marks = [];
  }

  mark(id: number, time: number, label: string) {
    this.marks.push({ id, time, label });
  }

  private record(metrics: MetricsPair) {
    const time = metrics[0].elapsed;
    if (time <= (this.samples.at(-1)?.time ?? -1)) return;
    this.samples.push({ time, totals: [totals(metrics[0]), totals(metrics[1])] });
    // Keep one sample before the longest rolling window so its boundary can be resolved.
    const cutoff = time - headlineWindow - chartInterval;
    if ((this.samples[120]?.time ?? Infinity) < cutoff) this.samples.splice(0, 120);
  }

  seed(frames: readonly MetricsPair[]) {
    for (const frame of frames) this.push(frame);
  }

  private boundary(time: number) {
    let low = 0;
    let high = this.samples.length;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (this.samples[mid].time <= time) low = mid + 1;
      else high = mid;
    }
    return low === 0 ? undefined : this.samples[low - 1];
  }

  push(metrics: MetricsPair): LiveReadout {
    this.record(metrics);
    const current = this.samples[this.samples.length - 1];
    const boundary = this.boundary(current.time - metricWindow);
    const hours = (current.time - (boundary?.time ?? 0)) / 3600;
    const values: ReadingsPair = [
      read(current.totals[0], boundary?.totals[0], hours),
      read(current.totals[1], boundary?.totals[1], hours),
    ];
    const point = { time: current.time, values };
    if (current.time - (this.history.at(-1)?.time ?? -chartInterval) >= chartInterval)
      this.history.push(point);
    const lastHour = this.boundary(current.time - headlineWindow);
    const a = current.totals[0].personDelay - (lastHour?.totals[0].personDelay ?? 0);
    const b = current.totals[1].personDelay - (lastHour?.totals[1].personDelay ?? 0);
    return {
      values,
      parts: [
        parts(current.totals[0], boundary?.totals[0], hours),
        parts(current.totals[1], boundary?.totals[1], hours),
      ],
      window: { from: boundary?.time ?? 0, to: current.time },
      hour: { from: lastHour?.time ?? 0, to: current.time, left: a, right: b },
      history: this.history.at(-1)?.time === point.time ? this.history : [...this.history, point],
      marks: this.marks,
      peopleHours: (a - b) / 3600,
      elapsed: current.time,
    };
  }
}
