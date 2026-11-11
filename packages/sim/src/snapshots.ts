import { EMERGENCY_CLASS, STOP_SPEED_THRESHOLD, VEHICLE_CLASSES } from "./constants";
import type { JunctionTraffic } from "./junction-traffic";
import type { Connector, Link, Network } from "./network";
import type { VehicleStore } from "./vehicles";

export const SNAPSHOT_STRIDE = 8;
export const BRAKING_FLAG = 1;
export const STOPPED_FLAG = 2;
export const EMERGENCY_FLAG = 4;

interface PathGeometry {
  ends: Float64Array;
  dirX: Float64Array;
  dirZ: Float64Array;
  leadIn: number;
  leadOut: number;
}

function pathGeometry(
  { path, movement, fromLink, toLink }: Connector,
  network: Network,
): PathGeometry {
  const count = path.length - 1;
  const ends = new Float64Array(count);
  const dirX = new Float64Array(count);
  const dirZ = new Float64Array(count);
  let accumulated = 0;
  for (let index = 0; index < count; index++) {
    const dx = path[index + 1][0] - path[index][0];
    const dz = path[index + 1][1] - path[index][1];
    const length = Math.sqrt(dx * dx + dz * dz);
    accumulated += length;
    ends[index] = accumulated;
    dirX[index] = dx / length;
    dirZ[index] = dz / length;
  }
  const incoming = network.links[fromLink].dir;
  const outgoing = network.links[toLink].dir;
  const hasBendSegments = movement !== "through" && count > 2;
  const straightEntry = hasBendSegments && dirX[0] * incoming[0] + dirZ[0] * incoming[1] > 0.999999;
  const straightExit =
    hasBendSegments && dirX[count - 1] * outgoing[0] + dirZ[count - 1] * outgoing[1] > 0.999999;
  return {
    ends,
    dirX,
    dirZ,
    leadIn: straightEntry ? ends[0] : 0,
    leadOut: straightExit ? ends[count - 2] : accumulated,
  };
}

export class SnapshotWriter {
  private readonly paths: PathGeometry[];

  constructor(
    private readonly network: Network,
    private readonly vehicles: VehicleStore,
    private readonly traffic: JunctionTraffic,
  ) {
    this.paths = network.connectors.map((connector) => pathGeometry(connector, network));
  }

  position(slot: number, out: Float32Array | Float64Array, offset: number, eased: boolean): void {
    const { network, vehicles } = this;
    const segment = vehicles.link[slot];
    const geometry = VEHICLE_CLASSES[vehicles.cls[slot]];
    const center = vehicles.s[slot] - geometry.length / 2;
    const lateral = eased ? vehicles.lat[slot] : vehicles.strip[slot] * network.stripWidth;
    const fromKerb = lateral + (geometry.strips * network.stripWidth) / 2;

    if (segment < network.links.length) {
      const previousId = this.traffic.previousConnector[slot];
      const previous = network.connectors[previousId - network.links.length];
      if (center < 0 && previous?.toLink === segment) {
        this.connectorPosition(
          previous,
          previous.length + center,
          slot,
          vehicles.strip[slot],
          out,
          offset,
        );
      } else {
        this.roadPosition(network.links[segment], center, fromKerb, out, offset);
      }
      return;
    }

    const connectorIndex = segment - network.links.length;
    const connector = network.connectors[connectorIndex];
    if (center < 0) {
      const road = network.links[connector.fromLink];
      const entry =
        (this.traffic.connectorEntryStrip[slot] + geometry.strips / 2) * network.stripWidth;
      this.roadPosition(road, road.length + center, entry, out, offset);
      return;
    }
    this.connectorPosition(
      connector,
      center,
      slot,
      this.traffic.exitStrip(connector, slot),
      out,
      offset,
    );
  }

  private roadPosition(
    { origin, dir, left }: Link,
    center: number,
    fromKerb: number,
    out: Float32Array | Float64Array,
    offset: number,
  ): void {
    out[offset] = origin[0] + dir[0] * center - left[0] * fromKerb;
    out[offset + 1] = origin[1] + dir[1] * center - left[1] * fromKerb;
    out[offset + 2] = dir[0];
    out[offset + 3] = dir[1];
  }

  private connectorPosition(
    connector: Connector,
    center: number,
    slot: number,
    exitStrip: number,
    out: Float32Array | Float64Array,
    offset: number,
  ): void {
    const { network, vehicles, traffic } = this;
    const { path } = connector;
    const connectorIndex = connector.id - network.links.length;
    const { ends, dirX, dirZ, leadIn, leadOut } = this.paths[connectorIndex];
    const incoming = network.links[connector.fromLink];
    const outgoing = network.links[connector.toLink];
    const vehicleWidth = VEHICLE_CLASSES[vehicles.cls[slot]].strips;
    const entryOffset =
      (traffic.connectorEntryStrip[slot] + (vehicleWidth - incoming.strips) / 2) *
      network.stripWidth;
    const exitOffset = (exitStrip + (vehicleWidth - outgoing.strips) / 2) * network.stripWidth;
    const turnProgress = Math.max(0, Math.min(1, (center - leadIn) / (leadOut - leadIn)));
    const fromCenter = entryOffset + (exitOffset - entryOffset) * turnProgress;
    let index = 0;
    while (index + 1 < ends.length && center > ends[index]) index++;
    const start = index === 0 ? 0 : ends[index - 1];
    const along = center - start;
    const fraction = along / (ends[index] - start);
    const startX =
      index === 0 || start === leadIn ? incoming.dir[0] : (dirX[index - 1] + dirX[index]) / 2;
    const startZ =
      index === 0 || start === leadIn ? incoming.dir[1] : (dirZ[index - 1] + dirZ[index]) / 2;
    const endX =
      ends[index] === leadIn
        ? incoming.dir[0]
        : ends[index] >= leadOut
          ? outgoing.dir[0]
          : (dirX[index] + dirX[index + 1]) / 2;
    const endZ =
      ends[index] === leadIn
        ? incoming.dir[1]
        : ends[index] >= leadOut
          ? outgoing.dir[1]
          : (dirZ[index] + dirZ[index + 1]) / 2;
    if (start >= leadOut) {
      out[offset] = path[index][0] + along * dirX[index] - fromCenter * outgoing.dir[1];
      out[offset + 1] = path[index][1] + along * dirZ[index] + fromCenter * outgoing.dir[0];
      out[offset + 2] = outgoing.dir[0];
      out[offset + 3] = outgoing.dir[1];
      return;
    }
    const headingX = startX + (endX - startX) * fraction;
    const headingZ = startZ + (endZ - startZ) * fraction;
    const length = Math.sqrt(headingX * headingX + headingZ * headingZ);
    const dx = headingX / length;
    const dz = headingZ / length;
    out[offset] = path[index][0] + along * dirX[index] - fromCenter * dz;
    out[offset + 1] = path[index][1] + along * dirZ[index] + fromCenter * dx;
    out[offset + 2] = dx;
    out[offset + 3] = dz;
  }

  write(out: Float32Array): number {
    const { vehicles } = this;
    if (out.length < vehicles.count * SNAPSHOT_STRIDE) {
      throw new RangeError("Snapshot buffer is too small for the active vehicles");
    }
    let offset = 0;
    for (let segment = 0; segment < vehicles.byLink.length; segment++) {
      const list = vehicles.byLink[segment];
      for (let index = 0; index < vehicles.counts[segment]; index++) {
        const slot = list[index];
        this.position(slot, out, offset, true);
        out[offset + 4] = vehicles.v[slot];
        out[offset + 5] = vehicles.cls[slot];
        out[offset + 6] = vehicles.id[slot];
        out[offset + 7] =
          (vehicles.a[slot] < -0.5 ? BRAKING_FLAG : 0) |
          (vehicles.v[slot] < STOP_SPEED_THRESHOLD ? STOPPED_FLAG : 0) |
          (vehicles.cls[slot] === EMERGENCY_CLASS ? EMERGENCY_FLAG : 0);
        offset += SNAPSHOT_STRIDE;
      }
    }
    return offset / SNAPSHOT_STRIDE;
  }
}
