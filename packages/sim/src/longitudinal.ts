import { DT, LOOKAHEAD, MAX_VEHICLE_LENGTH, VEHICLE_CLASSES } from "./constants";
import type { VehicleStore } from "./vehicles";

const MIN_GAP = 0.001;
const EMERGENCY_DECEL = 9;

export interface Leader {
  rear: number;
  speed: number;
}

export type ObstacleLookup = (link: number, slot: number, strip: number, leader: Leader) => void;

export function constrain(leader: Leader, rear: number, speed: number): void {
  if (rear < leader.rear || (rear === leader.rear && speed < leader.speed)) {
    leader.rear = rear;
    leader.speed = speed;
  }
}

export function shareStrip(
  first: number,
  firstWidth: number,
  second: number,
  secondWidth: number,
): boolean {
  return first < second + secondWidth && second < first + firstWidth;
}

export function findRoadLeader(
  vehicles: VehicleStore,
  link: number,
  index: number,
  strip: number,
  out: Leader,
): void {
  const list = vehicles.byLink[link];
  const slot = list[index];
  const width = VEHICLE_CLASSES[vehicles.cls[slot]].strips;
  const maxRear = vehicles.s[slot] + LOOKAHEAD;
  out.rear = Infinity;
  out.speed = 0;
  for (let ahead = index - 1; ahead >= 0; ahead--) {
    const candidate = list[ahead];
    const front = vehicles.s[candidate];
    if (front - MAX_VEHICLE_LENGTH > Math.min(maxRear, out.rear)) break;
    const geometry = VEHICLE_CLASSES[vehicles.cls[candidate]];
    const rear = front - geometry.length;
    if (rear <= maxRear && shareStrip(strip, width, vehicles.strip[candidate], geometry.strips)) {
      constrain(out, rear, vehicles.v[candidate]);
    }
  }
}

export function idmAcceleration(
  cls: number,
  speed: number,
  desiredSpeed: number,
  gap: number,
  leaderSpeed: number,
  accelerationScale = 1,
  headwayScale = 1,
): number {
  const vehicle = VEHICLE_CLASSES[cls];
  const maxAccel = vehicle.maxAccel * accelerationScale;
  const headway = vehicle.headway * headwayScale;
  const speedRatio = speed / desiredSpeed;
  const speedSquared = speedRatio * speedRatio;
  const approaching =
    (speed * (speed - leaderSpeed)) / (2 * Math.sqrt(maxAccel * vehicle.comfortDecel));
  const desiredGap = vehicle.standstillGap + Math.max(0, speed * headway + approaching);
  const gapRatio = desiredGap / Math.max(MIN_GAP, gap);
  const acceleration = maxAccel * (1 - speedSquared * speedSquared - gapRatio * gapRatio);
  return Math.max(-EMERGENCY_DECEL, Math.min(maxAccel, acceleration));
}

export class LongitudinalDynamics {
  private readonly leader: Leader = { rear: Infinity, speed: 0 };
  private readonly rearByStrip: Float64Array;
  private readonly speedByStrip: Float64Array;
  backstops = 0;

  constructor(
    private readonly vehicles: VehicleStore,
    maxStrips: number,
    private readonly accelerationScale = 1,
    private readonly headwayScale = 1,
  ) {
    this.rearByStrip = new Float64Array(maxStrips);
    this.speedByStrip = new Float64Array(maxStrips);
  }

  acceleration(
    link: number,
    index: number,
    strip: number,
    speedLimit: number,
    obstacle?: ObstacleLookup,
  ): number {
    const { leader, vehicles } = this;
    const slot = vehicles.byLink[link][index];
    findRoadLeader(vehicles, link, index, strip, leader);
    obstacle?.(link, slot, strip, leader);
    return idmAcceleration(
      vehicles.cls[slot],
      vehicles.v[slot],
      Math.min(vehicles.v0[slot], speedLimit),
      leader.rear - vehicles.s[slot],
      leader.speed,
      this.accelerationScale,
      this.headwayScale,
    );
  }

  updateAccelerations(link: number, speedLimit: number, obstacle?: ObstacleLookup): void {
    const { vehicles } = this;
    const list = vehicles.byLink[link];
    for (let index = 0; index < vehicles.counts[link]; index++) {
      const slot = list[index];
      vehicles.a[slot] = this.acceleration(link, index, vehicles.strip[slot], speedLimit, obstacle);
    }
  }

  integrate(link: number, strips: number, obstacle?: ObstacleLookup): void {
    const { leader, rearByStrip, speedByStrip, vehicles } = this;
    const list = vehicles.byLink[link];
    rearByStrip.fill(Infinity, 0, strips);
    speedByStrip.fill(0, 0, strips);
    // Each strip tracks the nearest integrated rear in front of the current vehicle.
    for (let index = 0; index < vehicles.counts[link]; index++) {
      const slot = list[index];
      const strip = vehicles.strip[slot];
      const geometry = VEHICLE_CLASSES[vehicles.cls[slot]];
      const endStrip = strip + geometry.strips;
      leader.rear = Infinity;
      leader.speed = 0;
      for (let lane = strip; lane < endStrip; lane++) {
        constrain(leader, rearByStrip[lane], speedByStrip[lane]);
      }
      obstacle?.(link, slot, strip, leader);

      let speed = Math.max(0, vehicles.v[slot] + vehicles.a[slot] * DT);
      let front = vehicles.s[slot] + speed * DT;
      if (front > leader.rear) {
        front = leader.rear;
        speed = leader.speed;
        this.backstops++;
      }
      vehicles.v[slot] = speed;
      vehicles.s[slot] = front;
      for (let lane = strip; lane < endStrip; lane++) {
        rearByStrip[lane] = front - geometry.length;
        speedByStrip[lane] = speed;
      }
    }
    vehicles.sort(link);
  }
}
