import dimensions from "./vehicle-dimensions.json";

export const DT = 0.25;
export const DEFAULT_VEHICLE_CAPACITY = 4_096;
export const LOOKAHEAD = 100;
export const EMERGENCY_CLASS = 5;
// Assumed turn speed cap for the compact authored junction paths.
export const TURN_SPEED = 8;

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
export const MAX_VEHICLE_LENGTH = Math.max(...VEHICLE_CLASSES.map(({ length }) => length));

// Class order follows VEHICLE_CLASSES, with ambulances introduced by an event.
export const DEFAULT_MIX = [0.5, 0.12, 0.28, 0.05, 0.05, 0] as const;
export const CARS_ONLY_MIX = [0, 0, 1, 0, 0, 0] as const;
export const LANE_STRIPS = 7;

export const QUEUE_ZONE_METRES = 150;
export const NEAR_ZONE_METRES = 60;
export const FAR_ZONE_METRES = 300;
export const QUEUE_SPEED_THRESHOLD = 1;
export const STOP_SPEED_THRESHOLD = 0.5;
export const MOVING_SPEED_THRESHOLD = 2;

// Assumed fuel-energy coefficients for an illustrative estimate, in W, J/m and kg.
export const FUEL_MODEL = [
  { idle: 2_400, cruise: 760, acceleration: 640 },
  { idle: 4_200, cruise: 1_600, acceleration: 1_400 },
  { idle: 7_000, cruise: 2_100, acceleration: 2_600 },
  { idle: 10_500, cruise: 3_600, acceleration: 3_900 },
  { idle: 23_000, cruise: 8_500, acceleration: 13_000 },
  { idle: 11_000, cruise: 3_900, acceleration: 4_500 },
] as const;

// EIA energy-based combustion factors, with natural gas as the CNG proxy.
// https://www.eia.gov/environment/emissions/co2_vol_mass.php
// The International Table Btu conversion follows NIST SP 811, Appendix B, footnote 9.
const JOULES_PER_MILLION_BTU = 1_055_055_852.62;
export const CO2_KG_PER_JOULE = {
  petrol: 76.11 / JOULES_PER_MILLION_BTU,
  diesel: 74.14 / JOULES_PER_MILLION_BTU,
  cng: 52.91 / JOULES_PER_MILLION_BTU,
};
