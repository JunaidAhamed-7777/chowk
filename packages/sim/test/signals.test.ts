import { describe, expect, it, vi } from "vitest";
import { corridor } from "../src/corridor";
import { canStopForYellow, SignalBank } from "../src/signals";

const junctions = corridor.junctions;

function advance(signals: SignalBank, ticks: number): void {
  for (let tick = 0; tick < ticks; tick++) signals.step();
}

describe("SignalBank", () => {
  it("ignores early requests and serves a valid request after exact clearance intervals", () => {
    const signals = new SignalBank(junctions);
    advance(signals, 39);
    signals.requestPhase(0, 1);
    signals.step();
    expect(signals.stateAt(0)).toEqual({ phase: 0, state: "green", elapsed: 10 });

    signals.requestPhase(0, 0);
    expect(signals.stateAt(0).state).toBe("green");
    signals.requestPhase(0, 2);
    expect(signals.stateAt(0)).toEqual({ phase: 0, state: "yellow", elapsed: 0 });
    signals.requestPhase(0, 3);
    advance(signals, 11);
    expect(signals.stateAt(0)).toEqual({ phase: 0, state: "yellow", elapsed: 2.75 });
    signals.step();
    expect(signals.stateAt(0)).toEqual({ phase: 0, state: "allRed", elapsed: 0 });

    signals.requestPhase(0, 1);
    advance(signals, 7);
    expect(signals.stateAt(0)).toEqual({ phase: 0, state: "allRed", elapsed: 1.75 });
    signals.step();
    expect(signals.stateAt(0)).toEqual({ phase: 2, state: "green", elapsed: 0 });
    expect(signals.stateAt(1)).toEqual({ phase: 0, state: "green", elapsed: 15 });
  });

  it("forces a switch at maximum green and wraps after the last phase", () => {
    const signals = new SignalBank(junctions);
    const last = junctions[0].phases.length - 1;
    advance(signals, 239);
    expect(signals.stateAt(0)).toEqual({ phase: 0, state: "green", elapsed: 59.75 });
    signals.step();
    expect(signals.stateAt(0)).toEqual({ phase: 0, state: "yellow", elapsed: 0 });
    advance(signals, 20);
    expect(signals.stateAt(0)).toEqual({ phase: 1, state: "green", elapsed: 0 });

    advance(signals, 40);
    signals.requestPhase(0, last);
    advance(signals, 20 + 240);
    expect(signals.stateAt(0)).toEqual({ phase: last, state: "yellow", elapsed: 0 });
    advance(signals, 20);
    expect(signals.stateAt(0)).toEqual({ phase: 0, state: "green", elapsed: 0 });
  });

  it("waits at all-red while an earlier phase still has vehicles in the box", () => {
    const signals = new SignalBank(junctions);
    advance(signals, 40);
    signals.requestPhase(0, 2);
    advance(signals, 19);
    const canOpen = vi.fn(() => false);
    signals.step(canOpen);
    signals.step(canOpen);
    expect(canOpen.mock.calls).toEqual([
      [0, 2],
      [0, 2],
    ]);
    expect(signals.stateAt(0)).toEqual({ phase: 0, state: "allRed", elapsed: 2.25 });
    signals.step(() => true);
    expect(signals.stateAt(0)).toEqual({ phase: 2, state: "green", elapsed: 0 });
  });

  it("blocks all opposing approaches and lets a vehicle proceed on yellow if it cannot stop comfortably", () => {
    const signals = new SignalBank(junctions);
    const current = junctions[0].phases[0].approaches[0];
    const next = junctions[0].phases[1].approaches[0];
    expect(signals.permitsEntry(0, current, 20, 10, 2.5)).toBe(true);
    expect(signals.permitsEntry(0, next, 20, 10, 2.5)).toBe(false);

    advance(signals, 40);
    signals.requestPhase(0, 1);
    expect(canStopForYellow(20, 10, 2.5)).toBe(true);
    expect(signals.permitsEntry(0, current, 20, 10, 2.5)).toBe(false);
    expect(signals.permitsEntry(0, current, 19.9, 10, 2.5)).toBe(true);
    expect(signals.permitsEntry(0, next, 19.9, 10, 2.5)).toBe(false);

    advance(signals, 12);
    expect(signals.permitsEntry(0, current, 19.9, 10, 2.5)).toBe(false);
    expect(signals.permitsEntry(0, next, 19.9, 10, 2.5)).toBe(false);
    advance(signals, 8);
    expect(signals.permitsEntry(0, next, 19.9, 10, 2.5)).toBe(true);
  });

  it("copies the pending phase and timer without sharing mutable state", () => {
    const signals = new SignalBank(junctions);
    advance(signals, 40);
    signals.requestPhase(0, 2);
    advance(signals, 17);
    const copy = signals.copy();
    expect(copy.stateAt(0)).toEqual(signals.stateAt(0));
    advance(copy, 3);
    expect(copy.stateAt(0)).toEqual({ phase: 2, state: "green", elapsed: 0 });
    expect(signals.stateAt(0)).toEqual({ phase: 0, state: "allRed", elapsed: 1.25 });
    advance(signals, 3);
    expect(signals.stateAt(0)).toEqual(copy.stateAt(0));
  });
});
