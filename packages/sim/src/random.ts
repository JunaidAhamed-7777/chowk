const UINT32_RANGE = 0x1_0000_0000;
const MULBERRY_INCREMENT = 0x6d2b79f5;

export class Random {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  nextUint32(): number {
    this.state = (this.state + MULBERRY_INCREMENT) >>> 0;
    let word = this.state;
    word = Math.imul(word ^ (word >>> 15), word | 1);
    word ^= word + Math.imul(word ^ (word >>> 7), word | 61);
    return (word ^ (word >>> 14)) >>> 0;
  }

  next(): number {
    return this.nextUint32() / UINT32_RANGE;
  }

  getState(): number {
    return this.state;
  }

  clone(): Random {
    return new Random(this.state);
  }
}

function deriveSeed(seed: number, stream: number): number {
  // Avalanche the stream tags so adjacent simulations do not share shifted sequences.
  let word = (seed + Math.imul(stream, 0x9e3779b9)) >>> 0;
  word = Math.imul(word ^ (word >>> 16), 0x21f0aaad);
  word = Math.imul(word ^ (word >>> 15), 0x735a2d97);
  return (word ^ (word >>> 15)) >>> 0;
}

export interface RandomStreams {
  readonly demand: Random;
  readonly behaviour: Random;
  readonly events: Random;
}

export function createRandomStreams(seed: number): RandomStreams {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed >= UINT32_RANGE) {
    throw new RangeError("Simulation seed must be an unsigned 32-bit integer");
  }
  return {
    demand: new Random(deriveSeed(seed, 1)),
    behaviour: new Random(deriveSeed(seed, 2)),
    events: new Random(deriveSeed(seed, 3)),
  };
}
