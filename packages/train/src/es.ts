import type { Random } from "@chowk/sim";

export interface AdamState {
  readonly first: Float64Array;
  readonly second: Float64Array;
  firstPower: number;
  secondPower: number;
}

export function adamState(size: number): AdamState {
  return {
    first: new Float64Array(size),
    second: new Float64Array(size),
    firstPower: 1,
    secondPower: 1,
  };
}

export function normal(random: Random): number {
  // Twelve independent uniforms give unit variance and a fixed reproducible draw count.
  let value = -6;
  for (let i = 0; i < 12; i++) value += random.next();
  return value;
}

export function noiseVector(size: number, random: Random): Float32Array {
  return Float32Array.from({ length: size }, () => normal(random));
}

export function perturb(center: Float32Array, noise: Float32Array, scale: number): Float32Array {
  return Float32Array.from(center, (weight, index) => weight + noise[index] * scale);
}

/** Lower episode fitness earns higher utility. Ties share the same average rank. */
export function rankUtilities(fitness: readonly number[]): Float64Array {
  if (fitness.length < 2 || fitness.some((value) => !Number.isFinite(value)))
    throw new RangeError("Fitness must be finite and have at least two candidates");
  const sorted = fitness.map((_, index) => index).sort((a, b) => fitness[a] - fitness[b] || a - b);
  const utilities = new Float64Array(fitness.length);
  for (let start = 0; start < sorted.length; ) {
    let end = start + 1;
    while (end < sorted.length && fitness[sorted[start]] === fitness[sorted[end]]) end++;
    const midpoint = (start + end - 1) / 2;
    const utility = 0.5 - midpoint / (sorted.length - 1);
    for (let rank = start; rank < end; rank++) utilities[sorted[rank]] = utility;
    start = end;
  }
  return utilities;
}

export function updateCenter(
  center: Float32Array,
  noise: readonly Float32Array[],
  fitness: readonly number[],
  sigma: number,
  learningRate: number,
  decay: number,
  state: AdamState,
  decayedCount = center.length,
): void {
  if (noise.length * 2 !== fitness.length || !(sigma > 0))
    throw new RangeError("Expected fitness for each antithetic pair");
  const utility = rankUtilities(fitness);
  const gradient = new Float64Array(center.length);
  for (let pair = 0; pair < noise.length; pair++) {
    const difference = (utility[pair * 2] - utility[pair * 2 + 1]) / (fitness.length * sigma);
    for (let index = 0; index < gradient.length; index++)
      gradient[index] += difference * noise[pair][index];
  }
  state.firstPower *= 0.9;
  state.secondPower *= 0.999;
  for (let index = 0; index < center.length; index++) {
    const value = gradient[index] - (index < decayedCount ? decay * center[index] : 0);
    state.first[index] = 0.9 * state.first[index] + 0.1 * value;
    state.second[index] = 0.999 * state.second[index] + 0.001 * value * value;
    const mean = state.first[index] / (1 - state.firstPower);
    const square = state.second[index] / (1 - state.secondPower);
    center[index] += (learningRate * mean) / (Math.sqrt(square) + 1e-8);
  }
}
