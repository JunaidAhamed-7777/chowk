import { describe, expect, it } from "vitest";
import { StateHash } from "../src/hash";
import { createRandomStreams, Random } from "../src/random";

describe("determinism primitives", () => {
  it("matches the stored Mulberry32 sequence", () => {
    const rng = new Random(0x12345678);
    expect(Array.from({ length: 5 }, () => rng.nextUint32())).toEqual([
      455919406, 4042750857, 4036713555, 1004527575, 3885174651,
    ]);
  });

  it("uses independent streams and clones a stream at its current position", () => {
    const { demand, behaviour, events } = createRandomStreams(17);
    expect(demand.nextUint32()).toBe(2208756701);
    demand.next();
    expect(behaviour.nextUint32()).toBe(3332258334);
    expect(events.nextUint32()).toBe(144751674);
    const clone = demand.clone();
    expect(clone.getState()).toBe(demand.getState());
    expect(clone.next()).toBe(demand.next());
  });

  it("rejects seeds that cannot be represented by the generator", () => {
    for (const seed of [-1, 0.5, Number.NaN, 2 ** 32]) {
      expect(() => createRandomStreams(seed)).toThrow(RangeError);
    }
  });

  it("matches a stored FNV-1a hash with millimetre quantisation", () => {
    const hash = new StateHash();
    hash.addUint32(17).addMilli(12.34501).addMilli(-0.1252).addUint32(4);
    expect(hash.digest()).toBe(0x6e8dd509);
    const shifted = new StateHash();
    shifted.addUint32(17).addMilli(12.34601).addMilli(-0.1252).addUint32(4);
    expect(shifted.digest()).not.toBe(hash.digest());
  });
});
