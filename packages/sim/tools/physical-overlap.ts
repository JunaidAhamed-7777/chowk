import type { Network } from "../src/network";
import { type createSim, VEHICLE_CLASSES } from "../src";
import { SnapshotWriter } from "../src/snapshots";

type Vehicle = (typeof VEHICLE_CLASSES)[number];
type Sim = ReturnType<typeof createSim>;
const CELL_METRES = 12;

function separated(
  x: number,
  z: number,
  dx: number,
  dz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  first: Vehicle,
  second: Vehicle,
): boolean {
  const firstRadius =
    (Math.abs(x * ax + z * az) * first.length + Math.abs(x * az - z * ax) * first.width) / 2;
  const secondRadius =
    (Math.abs(x * bx + z * bz) * second.length + Math.abs(x * bz - z * bx) * second.width) / 2;
  return Math.abs(x * dx + z * dz) >= firstRadius + secondRadius - 1e-7;
}

/** Check physical oriented rectangles against nearby cells using the uneased pose. */
export class PhysicalOverlapCheck {
  private readonly writer: SnapshotWriter;
  private readonly positions: Float64Array;
  private readonly heads: Int32Array;
  private readonly next: Int32Array;
  private readonly startX: number;
  private readonly startZ: number;
  private readonly columns: number;
  private readonly rows: number;

  constructor(
    network: Network,
    private readonly sim: Sim,
  ) {
    const { vehicles, junctionTraffic } = sim;
    this.writer = new SnapshotWriter(network, vehicles, junctionTraffic);
    this.positions = new Float64Array(vehicles.capacity * 4);
    this.next = new Int32Array(vehicles.capacity);
    const x = network.nodes.map((node) => node.x);
    const z = network.nodes.map((node) => node.z);
    this.startX = Math.min(...x) - CELL_METRES * 2;
    this.startZ = Math.min(...z) - CELL_METRES * 2;
    this.columns = Math.ceil((Math.max(...x) - this.startX) / CELL_METRES) + 2;
    this.rows = Math.ceil((Math.max(...z) - this.startZ) / CELL_METRES) + 2;
    this.heads = new Int32Array(this.columns * this.rows);
  }

  firstOverlap(): { first: number; second: number } | undefined {
    const { vehicles } = this.sim;
    const { positions, heads, next, rows, columns } = this;
    heads.fill(-1);
    for (let link = 0; link < vehicles.byLink.length; link++) {
      for (let index = 0; index < vehicles.counts[link]; index++) {
        const slot = vehicles.byLink[link][index];
        const start = 4 * slot;
        this.writer.position(slot, positions, start, false);
        const column = Math.min(
          columns - 1,
          Math.max(0, Math.floor((positions[start] - this.startX) / CELL_METRES)),
        );
        const row = Math.min(
          rows - 1,
          Math.max(0, Math.floor((positions[start + 1] - this.startZ) / CELL_METRES)),
        );
        for (
          let nearRow = Math.max(0, row - 1);
          nearRow <= Math.min(rows - 1, row + 1);
          nearRow++
        ) {
          for (
            let nearColumn = Math.max(0, column - 1);
            nearColumn <= Math.min(columns - 1, column + 1);
            nearColumn++
          ) {
            for (
              let other = heads[nearRow * columns + nearColumn];
              other >= 0;
              other = next[other]
            ) {
              if (this.overlaps(slot, other)) return { first: slot, second: other };
            }
          }
        }
        const cell = row * columns + column;
        next[slot] = heads[cell];
        heads[cell] = slot;
      }
    }
  }

  describe({ first, second }: { first: number; second: number }): string {
    const { vehicles } = this.sim;
    const descriptor = (slot: number) =>
      `${vehicles.id[slot]}/${vehicles.link[slot]}/${vehicles.cls[slot]} s=${vehicles.s[slot]} strip=${vehicles.strip[slot]}`;
    return `Overlap at ${this.sim.time}s: ${descriptor(first)}, ${descriptor(second)}`;
  }

  private overlaps(a: number, b: number): boolean {
    const {
      positions,
      sim: { vehicles },
    } = this;
    const dx = positions[4 * b] - positions[4 * a];
    const dz = positions[4 * b + 1] - positions[4 * a + 1];
    if (Math.abs(dx) >= CELL_METRES || Math.abs(dz) >= CELL_METRES) return false;
    const ax = positions[4 * a + 2];
    const az = positions[4 * a + 3];
    const bx = positions[4 * b + 2];
    const bz = positions[4 * b + 3];
    const first = VEHICLE_CLASSES[vehicles.cls[a]];
    const second = VEHICLE_CLASSES[vehicles.cls[b]];
    return (
      !separated(ax, az, dx, dz, ax, az, bx, bz, first, second) &&
      !separated(az, -ax, dx, dz, ax, az, bx, bz, first, second) &&
      !separated(bx, bz, dx, dz, ax, az, bx, bz, first, second) &&
      !separated(bz, -bx, dx, dz, ax, az, bx, bz, first, second)
    );
  }
}
