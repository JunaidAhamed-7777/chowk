import type { JunctionSense, Network } from "@chowk/sim";
import type { NeighbourSense } from "../types";

export const FEATURE_WIDTH = 10;
export const NEIGHBOUR_OFFSET = 40;
export const DIRECTION_NAMES = ["North", "East", "South", "West"] as const;

export interface ObservationLayout {
  approaches: Int8Array;
  directionOfPhase: Int8Array;
  phaseAtDirection: Int8Array;
}

export function layoutFor(network: Network, junctionId: number): ObservationLayout {
  const junction = network.junctions[junctionId];
  const approaches = new Int8Array(4).fill(-1);
  const directionOfPhase = new Int8Array(junction.phases.length);
  const phaseAtDirection = new Int8Array(4).fill(-1);
  for (let index = 0; index < junction.approaches.length; index++) {
    const link = junction.approaches[index];
    const [dx, dz] = network.links[link].dir;
    const preferred = Math.abs(dz) > Math.abs(dx) ? (dz > 0 ? 0 : 2) : dx < 0 ? 1 : 3;
    // For nonorthogonal junctions preserve clockwise order when two legs share a quadrant.
    let direction = preferred;
    while (approaches[direction] !== -1) direction = (direction + 1) % 4;
    approaches[direction] = index;
    const phase = junction.phases.findIndex(({ approaches }) => approaches.includes(link));
    phaseAtDirection[direction] = phase;
    directionOfPhase[phase] = direction;
  }
  return { approaches, directionOfPhase, phaseAtDirection };
}

export function buildObservation(
  layout: ObservationLayout,
  sense: JunctionSense,
  neighbours: NeighbourSense,
  out: Float64Array,
  counts: boolean,
  solo: boolean,
): void {
  const direction = layout.directionOfPhase[sense.phase];
  out.fill(0);
  for (let rotation = 0; rotation < 4; rotation++) {
    const approachIndex = layout.approaches[(direction + rotation) % 4];
    if (approachIndex < 0) continue;
    const approach = sense.approaches[approachIndex];
    const offset = rotation * FEATURE_WIDTH;
    out[offset] = counts
      ? Math.min((approach.countNear ?? approach.count) / 16, 1)
      : approach.areaNear;
    out[offset + 1] = counts ? Math.min((approach.countMid ?? 0) / 24, 1) : approach.areaMid;
    out[offset + 2] = counts ? Math.min((approach.countFar ?? 0) / 40, 1) : approach.areaFar;
    out[offset + 3] = counts
      ? Math.min((approach.stoppedCount ?? approach.count) / 40, 1)
      : approach.stoppedArea;
    out[offset + 4] = Math.min(approach.people / 100, 3);
    out[offset + 5] = Math.min(approach.waitMax / 120, 2);
    out[offset + 6] = approach.emergency;
    out[offset + 7] =
      counts && approach.exits.length
        ? Math.min(
            approach.exits.reduce((sum, exit) => sum + exit.count, 0) /
              (16 * approach.exits.length),
            1,
          )
        : approach.outArea;
    out[offset + 8] = rotation === 0 && sense.state === "green" ? 1 : 0;
    out[offset + 9] = 1;
    const neighbour = neighbours.approaches[approachIndex];
    if (solo || !neighbour?.releasing) continue;
    out[NEIGHBOUR_OFFSET + 2 * rotation] = 1;
    out[NEIGHBOUR_OFFSET + 2 * rotation + 1] = Math.min(neighbour.elapsed / 60, 1);
  }
  out[48] = sense.state === "green" ? Math.min(sense.elapsed / 60, 1) : 0;
  out[49] = sense.state === "green" ? 0 : 1;
}
