import {
  DT,
  EMERGENCY_CLASS,
  LANE_STRIPS,
  LOOKAHEAD,
  MAX_VEHICLE_LENGTH,
  VEHICLE_CLASSES,
} from "./constants";
import type { JunctionTraffic } from "./junction-traffic";
import { idmAcceleration, type LongitudinalDynamics, shareStrip } from "./longitudinal";
import type { Link, Network } from "./network";
import type { VehicleStore } from "./vehicles";

// Assumed lateral-behaviour parameters from plan/02.
const TURN_BIAS_RANGE = 150;
const TURN_BIAS = 0.3;
const KEEP_LEFT_BIAS = 0.05;
const EMERGENCY_RANGE = 60;
const EMERGENCY_BIAS = 1;
const MAX_FOLLOWER_BRAKING = 2;
const EASING_SPEED = 1.5;

export class LateralDynamics {
  private readonly checkedStrips: Uint8Array;
  private readonly increment: number;

  constructor(
    private readonly network: Network,
    private readonly vehicles: VehicleStore,
    private readonly junctionTraffic: JunctionTraffic,
    private readonly longitudinal: LongitudinalDynamics,
    laneDisciplined: boolean,
    private readonly accelerationScale = 1,
    private readonly headwayScale = 1,
  ) {
    this.checkedStrips = new Uint8Array(Math.max(...network.links.map(({ strips }) => strips)));
    this.increment = laneDisciplined ? LANE_STRIPS : 1;
  }

  step(tick: number): void {
    const { network, vehicles } = this;
    for (const road of network.links) {
      const list = vehicles.byLink[road.id];
      for (let index = 0; index < vehicles.counts[road.id]; index++) {
        const slot = list[index];
        const geometry = VEHICLE_CLASSES[vehicles.cls[slot]];
        if ((tick + vehicles.id[slot]) % geometry.shiftEvery === 0 && this.canShift(road, slot)) {
          this.consider(road, index, slot, tick);
        }
        const target = vehicles.strip[slot] * network.stripWidth;
        const remaining = target - vehicles.lat[slot];
        vehicles.lat[slot] += Math.max(-EASING_SPEED * DT, Math.min(EASING_SPEED * DT, remaining));
      }
    }
  }

  private canShift(road: Link, slot: number): boolean {
    const { network, vehicles } = this;
    const front = vehicles.s[slot];
    // A bumper can still occupy the adjacent segment while its front crosses the boundary.
    return (
      (network.nodes[road.from].kind !== "junction" || front >= 2 * MAX_VEHICLE_LENGTH) &&
      (network.nodes[road.to].kind !== "junction" || road.length - front >= MAX_VEHICLE_LENGTH)
    );
  }

  private consider(road: Link, index: number, slot: number, tick: number): void {
    const { junctionTraffic, longitudinal, vehicles } = this;
    const cls = vehicles.cls[slot];
    const geometry = VEHICLE_CLASSES[cls];
    const oldStrip = vehicles.strip[slot];
    const oldAcceleration = longitudinal.acceleration(
      road.id,
      index,
      oldStrip,
      road.speedLimit,
      junctionTraffic.obstacle,
    );
    let preferred = 0;
    if (road.length - vehicles.s[slot] <= TURN_BIAS_RANGE) {
      const connector = junctionTraffic.nextConnector(slot);
      if (connector >= 0) {
        const movement = this.network.connectors[connector - this.network.links.length].movement;
        preferred = movement === "left" ? -1 : movement === "right" ? 1 : 0;
      }
    }
    const yieldDirection = this.yieldDirection(road.id, index, slot);
    let bestUtility = geometry.shiftThreshold;
    let bestStrip = oldStrip;
    let bestAcceleration = oldAcceleration;
    for (let direction = -1; direction <= 1; direction += 2) {
      const strip = oldStrip + this.increment * direction;
      if (
        strip < 0 ||
        strip + geometry.strips > road.strips ||
        !this.feasible(road, index, slot, strip)
      )
        continue;
      const acceleration = longitudinal.acceleration(
        road.id,
        index,
        strip,
        road.speedLimit,
        junctionTraffic.obstacle,
      );
      let utility = acceleration - oldAcceleration;
      if (direction === preferred) utility += TURN_BIAS;
      if (direction === -1 && (cls === 3 || cls === 4)) utility += KEEP_LEFT_BIAS;
      if (direction === yieldDirection) utility += EMERGENCY_BIAS;
      if (utility > bestUtility) {
        bestUtility = utility;
        bestStrip = strip;
        bestAcceleration = acceleration;
      }
    }
    if (bestStrip !== oldStrip) {
      vehicles.strip[slot] = bestStrip;
      vehicles.a[slot] = bestAcceleration;
      vehicles.lastShift[slot] = tick * DT;
    }
  }

  private feasible(road: Link, index: number, slot: number, strip: number): boolean {
    const { vehicles, checkedStrips } = this;
    const list = vehicles.byLink[road.id];
    const geometry = VEHICLE_CLASSES[vehicles.cls[slot]];
    const front = vehicles.s[slot];
    const rear = front - geometry.length;
    const frontBound = front + geometry.standstillGap;
    const stripEnd = strip + geometry.strips;
    for (let ahead = index - 1; ahead >= 0; ahead--) {
      const other = list[ahead];
      const otherFront = vehicles.s[other];
      if (otherFront - MAX_VEHICLE_LENGTH >= frontBound) break;
      const otherGeometry = VEHICLE_CLASSES[vehicles.cls[other]];
      if (
        otherFront - otherGeometry.length < frontBound &&
        shareStrip(strip, geometry.strips, vehicles.strip[other], otherGeometry.strips)
      )
        return false;
    }
    checkedStrips.fill(0, strip, stripEnd);
    for (let behind = index + 1; behind < vehicles.counts[road.id]; behind++) {
      const other = list[behind];
      const gap = rear - vehicles.s[other];
      if (gap > LOOKAHEAD) break;
      const otherStrip = vehicles.strip[other];
      const otherGeometry = VEHICLE_CLASSES[vehicles.cls[other]];
      if (!shareStrip(strip, geometry.strips, otherStrip, otherGeometry.strips)) continue;
      if (gap < 0) return false;
      let isFollower = false;
      const start = Math.max(strip, otherStrip);
      const end = Math.min(stripEnd, otherStrip + otherGeometry.strips);
      for (let lane = start; lane < end; lane++) {
        if (checkedStrips[lane] === 0) isFollower = true;
        checkedStrips[lane] = 1;
      }
      if (
        isFollower &&
        idmAcceleration(
          vehicles.cls[other],
          vehicles.v[other],
          Math.min(road.speedLimit, vehicles.v0[other]),
          gap,
          vehicles.v[slot],
          this.accelerationScale,
          this.headwayScale,
        ) < -MAX_FOLLOWER_BRAKING
      )
        return false;
    }
    return true;
  }

  private yieldDirection(link: number, index: number, slot: number): number {
    const { vehicles } = this;
    const width = VEHICLE_CLASSES[vehicles.cls[slot]].strips;
    const ambulanceWidth = VEHICLE_CLASSES[EMERGENCY_CLASS].strips;
    const strip = vehicles.strip[slot];
    const list = vehicles.byLink[link];
    if (vehicles.cls[slot] === EMERGENCY_CLASS) return 0;
    for (let behind = index + 1; behind < vehicles.counts[link]; behind++) {
      const other = list[behind];
      if (vehicles.s[slot] - vehicles.s[other] > EMERGENCY_RANGE) break;
      if (
        vehicles.cls[other] === EMERGENCY_CLASS &&
        shareStrip(strip, width, vehicles.strip[other], ambulanceWidth)
      ) {
        return strip + width / 2 <= vehicles.strip[other] + ambulanceWidth / 2 ? -1 : 1;
      }
    }
    return 0;
  }
}
