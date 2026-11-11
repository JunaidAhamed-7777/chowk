import dimensions from "./vehicle-dimensions.json";

export const DT = 0.25;
export const DEFAULT_VEHICLE_CAPACITY = 4_096;
export const LOOKAHEAD = 100;
export const EMERGENCY_CLASS = 5;

interface VehicleDynamics {
  speedKph: number;
  maxAccel: number;
  comfortDecel: number;
  headway: number;
  standstillGap: number;
  occupancy: number;
  fuel: "petrol" | "diesel" | "cng";
  shiftEvery: number;
  shiftThreshold: number;
}

// Assumed dynamics and occupancy from plan/02. Emergency trips have a separate travel-time metric.
const dynamics: readonly VehicleDynamics[] = [
  {
    speedKph: 50,
    maxAccel: 2.5,
    comfortDecel: 3.0,
    headway: 0.8,
    standstillGap: 0.5,
    occupancy: 1.3,
    fuel: "petrol",
    shiftEvery: 2,
    shiftThreshold: 0.1,
  },
  {
    speedKph: 40,
    maxAccel: 1.2,
    comfortDecel: 2.5,
    headway: 1.2,
    standstillGap: 1.0,
    occupancy: 2.2,
    fuel: "cng",
    shiftEvery: 3,
    shiftThreshold: 0.2,
  },
  {
    speedKph: 50,
    maxAccel: 1.8,
    comfortDecel: 3.0,
    headway: 1.2,
    standstillGap: 1.5,
    occupancy: 1.6,
    fuel: "petrol",
    shiftEvery: 4,
    shiftThreshold: 0.3,
  },
  {
    speedKph: 45,
    maxAccel: 1.2,
    comfortDecel: 2.5,
    headway: 1.4,
    standstillGap: 1.5,
    occupancy: 1.5,
    fuel: "diesel",
    shiftEvery: 4,
    shiftThreshold: 0.4,
  },
  {
    speedKph: 40,
    maxAccel: 0.9,
    comfortDecel: 2.0,
    headway: 1.6,
    standstillGap: 2.0,
    occupancy: 40,
    fuel: "diesel",
    shiftEvery: 8,
    shiftThreshold: 0.6,
  },
  {
    speedKph: 60,
    maxAccel: 1.8,
    comfortDecel: 3.0,
    headway: 1.0,
    standstillGap: 1.5,
    occupancy: 0,
    fuel: "diesel",
    shiftEvery: 4,
    shiftThreshold: 0.3,
  },
];

export const VEHICLE_CLASSES = dimensions.map((geometry, cls) => ({
  ...geometry,
  ...dynamics[cls],
  desiredSpeed: dynamics[cls].speedKph / 3.6,
}));

// Class order follows VEHICLE_CLASSES, with ambulances introduced by an event.
export const DEFAULT_MIX = [0.5, 0.12, 0.28, 0.05, 0.05, 0] as const;
