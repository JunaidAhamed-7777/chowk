// Shares follow the simulator class order: two-wheeler, auto, car, LCV, bus, ambulance.
export const trafficMixes = {
  mixed: [0.5, 0.12, 0.28, 0.05, 0.05, 0],
  festival: [0.6, 0.12, 0.16, 0.04, 0.08, 0],
  cars: [0, 0, 1, 0, 0, 0],
  "two-wheeler-heavy": [0.7, 0.1, 0.12, 0.04, 0.04, 0],
  "bus-heavy": [0.43, 0.12, 0.25, 0.05, 0.15, 0],
} as const;

export type MixId = keyof typeof trafficMixes;
