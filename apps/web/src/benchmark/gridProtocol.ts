import type { ControllerChoice } from "../sim/protocol";

export type GridToWorker =
  | { type: "init"; seed: number; controller: ControllerChoice }
  | { type: "advance"; tick: number }
  | { type: "recycle"; buffer: ArrayBuffer };

export interface GridFromWorker {
  tick: number;
  count: number;
  positions: ArrayBuffer;
  signals: Uint8Array;
  delayPerPerson: number;
}
