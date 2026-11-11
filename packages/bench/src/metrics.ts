import type { Metrics } from "@chowk/sim";

export const metricLabels: Record<
  string,
  { label: string; unit: string; digits: number; scale?: number }
> = {
  delayPerPerson: { label: "Delay per person", unit: "s", digits: 1 },
  stopsPerVehicle: { label: "Stops per vehicle", unit: "", digits: 2 },
  throughputPeoplePerHour: { label: "Throughput", unit: "people/h", digits: 0 },
  co2Kg: { label: "Estimated CO₂", unit: "kg", digits: 1 },
  ambulanceTravelTime: { label: "Ambulance travel time", unit: "s", digits: 1 },
  ambulanceCompleted: { label: "Ambulances completed", unit: "", digits: 1 },
  meanTravelTime: { label: "Mean completed travel time", unit: "s", digits: 1 },
  completionRate: { label: "Eligible trips completed", unit: "%", digits: 1, scale: 100 },
  meanQueueArea: { label: "Stopped area across approaches", unit: "", digits: 2 },
  meanBacklog: { label: "Mean entry backlog", unit: "vehicles", digits: 1 },
  maxBacklog: { label: "Peak entry backlog", unit: "vehicles", digits: 1 },
  maximumApproachWait: { label: "Maximum approach wait", unit: "s", digits: 1 },
  p95ApproachWait: { label: "95th-percentile approach wait", unit: "s", digits: 1 },
  starvationShare: { label: "Time with an approach over 120 s", unit: "%", digits: 1, scale: 100 },
  busPassengerDelay: { label: "Bus-passenger delay", unit: "person·s", digits: 0 },
  carPassengerDelay: { label: "Car-passenger delay", unit: "person·s", digits: 0 },
};

export const mainMetricKeys = [
  "delayPerPerson",
  "stopsPerVehicle",
  "throughputPeoplePerHour",
  "co2Kg",
] as const;

export function formatMetric(metric: string, value: number): string {
  const definition = metricLabels[metric];
  return (value * (definition?.scale ?? 1)).toFixed(definition?.digits ?? 2);
}

export function controllerLabel(id: string): string {
  switch (id) {
    case "webster":
      return "Fixed-time (Webster)";
    case "actuated":
      return "Actuated";
    case "mp-count":
      return "Count max-pressure";
    case "mp-area":
      return "Area max-pressure";
    case "mp-area+preempt":
      return "Area max-pressure with pre-emption";
    case "chowk":
      return "CHOWK";
    case "chowk-vehicle":
      return "CHOWK · vehicle objective";
    case "chowk-count":
      return "CHOWK · count observation";
    case "chowk-pure":
      return "CHOWK · pure policy";
    case "chowk-solo":
      return "CHOWK · isolated junction";
    default:
      return id;
  }
}

type WindowTotals = Metrics &
  Partial<{ busPassengerDelay: number; carPassengerDelay: number; ambulanceDelay: number }>;

export function windowMetrics(before: WindowTotals, after: WindowTotals): Record<string, number> {
  const seconds = after.elapsed - before.elapsed;
  if (!(seconds > 0)) throw new RangeError("A benchmark measurement window must advance time");
  const generated = after.generated - before.generated;
  const generatedPeople = after.generatedPeople - before.generatedPeople;
  const completed = after.completed - before.completed;
  const completedPeople = after.completedPeople - before.completedPeople;
  const eligible = before.inNetwork + before.backlog + generated;
  const personDelay = after.personDelay - before.personDelay;
  const vehicleDelay = after.vehicleDelay - before.vehicleDelay;
  const ambulanceCompleted = after.ambulanceCompleted - before.ambulanceCompleted;
  const metrics: Record<string, number> = {
    generated,
    generatedPeople,
    completed,
    personDelay,
    vehicleDelay,
    throughputPeoplePerHour: (completedPeople * 3_600) / seconds,
    co2Kg: after.co2Kg - before.co2Kg,
    meanQueueArea: (after.queueAreaSeconds - before.queueAreaSeconds) / seconds,
    meanBacklog: (after.backlogVehicleSeconds - before.backlogVehicleSeconds) / seconds,
    ambulanceCompleted,
  };
  if (generatedPeople > 0) metrics.delayPerPerson = personDelay / generatedPeople;
  if (generated > 0) metrics.stopsPerVehicle = (after.stops - before.stops) / generated;
  if (eligible > 0) metrics.completionRate = completed / eligible;
  if (completed > 0) metrics.meanTravelTime = (after.travelTime - before.travelTime) / completed;
  if (ambulanceCompleted > 0) {
    metrics.ambulanceTravelTime =
      (after.ambulanceTravelTime - before.ambulanceTravelTime) / ambulanceCompleted;
  }
  if (typeof after.busPassengerDelay === "number")
    metrics.busPassengerDelay = after.busPassengerDelay - (before.busPassengerDelay ?? 0);
  if (typeof after.carPassengerDelay === "number")
    metrics.carPassengerDelay = after.carPassengerDelay - (before.carPassengerDelay ?? 0);
  return metrics;
}
