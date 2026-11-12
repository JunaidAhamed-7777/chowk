import { POLICY_DIMENSIONS } from "@chowk/controllers";

export interface Attribution {
  /** Network outputs from the mirrored forward pass, by relative direction. */
  outputs: Float64Array;
  /** Input × gradient for the requested output; with the bias path they sum to that output. */
  contributions: Float64Array;
  /** The part of the output carried by the biases along the active path. */
  biasPath: number;
}

/**
 * Restates CHOWK's network in the browser and splits one output into per-input parts.
 * The network is ReLU, so within the active region it is exactly linear in its inputs and
 * input × gradient plus the bias path reproduces the output. Uses the same weight layout
 * and summation order as the controller's own inference.
 */
export function attribute(vector: Float32Array, observation: ArrayLike<number>, output: number) {
  const [inputs, first, second, outputs] = POLICY_DIMENSIONS;
  const hidden1 = new Float64Array(first);
  const hidden2 = new Float64Array(second);
  const result = new Float64Array(outputs);
  const w1 = 0;
  const b1 = w1 + inputs * first;
  const w2 = b1 + first;
  const b2 = w2 + first * second;
  const w3 = b2 + second;
  const b3 = w3 + second * outputs;
  for (let row = 0; row < first; row++) {
    let value = vector[b1 + row];
    for (let col = 0; col < inputs; col++)
      value += vector[w1 + row * inputs + col] * observation[col];
    hidden1[row] = Math.max(0, value);
  }
  for (let row = 0; row < second; row++) {
    let value = vector[b2 + row];
    for (let col = 0; col < first; col++) value += vector[w2 + row * first + col] * hidden1[col];
    hidden2[row] = Math.max(0, value);
  }
  for (let row = 0; row < outputs; row++) {
    let value = vector[b3 + row];
    for (let col = 0; col < second; col++) value += vector[w3 + row * second + col] * hidden2[col];
    result[row] = value;
  }
  // Backpropagate one output through the active ReLUs.
  const grad2 = new Float64Array(second);
  for (let col = 0; col < second; col++)
    grad2[col] = hidden2[col] > 0 ? vector[w3 + output * second + col] : 0;
  const grad1 = new Float64Array(first);
  for (let row = 0; row < second; row++) {
    if (grad2[row] === 0) continue;
    for (let col = 0; col < first; col++)
      if (hidden1[col] > 0) grad1[col] += grad2[row] * vector[w2 + row * first + col];
  }
  const contributions = new Float64Array(inputs);
  for (let row = 0; row < first; row++) {
    if (grad1[row] === 0) continue;
    for (let col = 0; col < inputs; col++)
      contributions[col] += grad1[row] * vector[w1 + row * inputs + col];
  }
  let total = 0;
  for (let col = 0; col < inputs; col++) {
    contributions[col] *= observation[col];
    total += contributions[col];
  }
  return { outputs: result, contributions, biasPath: result[output] - total } satisfies Attribution;
}
