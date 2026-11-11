import { DT } from "./constants";
import type { Junction } from "./network";

export const GREEN = 0;
export const YELLOW = 1;
export const ALL_RED = 2;

const stateNames = ["green", "yellow", "allRed"] as const;
export type SignalState = (typeof stateNames)[number];

interface SignalReading {
  phase: number;
  state: SignalState;
  elapsed: number;
}

function ticksFor(seconds: number): number {
  // A phase must last at least its configured duration on the discrete clock.
  return -Math.floor(-seconds / DT);
}

export function canStopForYellow(distance: number, speed: number, comfortDecel: number): boolean {
  return speed * speed <= 2 * comfortDecel * distance;
}

export class SignalBank {
  readonly phase: Uint32Array;
  readonly state: Uint8Array;
  readonly elapsedTicks: Float64Array;
  readonly targetPhase: Uint32Array;
  private readonly minGreen: Float64Array;
  private readonly maxGreen: Float64Array;
  private readonly yellow: Float64Array;
  private readonly allRed: Float64Array;

  constructor(private readonly junctions: readonly Junction[]) {
    const count = junctions.length;
    this.phase = new Uint32Array(count);
    this.state = new Uint8Array(count);
    this.elapsedTicks = new Float64Array(count);
    this.targetPhase = new Uint32Array(count);
    this.minGreen = Float64Array.from(junctions, (junction) => ticksFor(junction.minGreen));
    this.maxGreen = Float64Array.from(junctions, (junction) => ticksFor(junction.maxGreen));
    this.yellow = Float64Array.from(junctions, (junction) => ticksFor(junction.yellow));
    this.allRed = Float64Array.from(junctions, (junction) => ticksFor(junction.allRed));
  }

  requestPhase(junctionId: number, phase: number): void {
    if (!this.junctions[junctionId]?.phases[phase]) {
      throw new RangeError(`Unknown phase ${phase} at junction ${junctionId}`);
    }
    if (
      this.state[junctionId] === GREEN &&
      phase !== this.phase[junctionId] &&
      this.elapsedTicks[junctionId] >= this.minGreen[junctionId]
    ) {
      this.beginYellow(junctionId, phase);
    }
  }

  step(canOpen?: (junctionId: number, targetPhase: number) => boolean): void {
    for (let id = 0; id < this.junctions.length; id++) {
      const elapsed = ++this.elapsedTicks[id];
      const state = this.state[id];
      if (state === GREEN) {
        if (elapsed >= this.maxGreen[id]) {
          const next = this.phase[id] + 1;
          this.beginYellow(id, next === this.junctions[id].phases.length ? 0 : next);
        }
      } else if (state === YELLOW) {
        if (elapsed >= this.yellow[id]) {
          this.state[id] = ALL_RED;
          this.elapsedTicks[id] = 0;
        }
      } else if (elapsed >= this.allRed[id] && canOpen?.(id, this.targetPhase[id]) !== false) {
        // The next approach stays red if a previous movement still occupies the junction.
        this.phase[id] = this.targetPhase[id];
        this.state[id] = GREEN;
        this.elapsedTicks[id] = 0;
      }
    }
  }

  permitsEntry(
    junctionId: number,
    approachLink: number,
    distance: number,
    speed: number,
    comfortDecel: number,
  ): boolean {
    const state = this.state[junctionId];
    const phase = this.junctions[junctionId].phases[this.phase[junctionId]];
    if (state === ALL_RED || phase.approaches[0] !== approachLink) return false;
    return state === GREEN || !canStopForYellow(distance, speed, comfortDecel);
  }

  stateAt(junctionId: number): SignalReading {
    return {
      phase: this.phase[junctionId],
      state: stateNames[this.state[junctionId]],
      elapsed: this.elapsedTicks[junctionId] * DT,
    };
  }

  copy(): SignalBank {
    const copy = new SignalBank(this.junctions);
    copy.phase.set(this.phase);
    copy.state.set(this.state);
    copy.elapsedTicks.set(this.elapsedTicks);
    copy.targetPhase.set(this.targetPhase);
    return copy;
  }

  private beginYellow(junctionId: number, phase: number): void {
    this.targetPhase[junctionId] = phase;
    this.state[junctionId] = YELLOW;
    this.elapsedTicks[junctionId] = 0;
  }
}
