import { POLICY_DIMENSIONS, POLICY_VECTOR_LENGTH } from "./weights";

export class Inference {
  private readonly hidden = [
    new Float64Array(POLICY_DIMENSIONS[1]),
    new Float64Array(POLICY_DIMENSIONS[2]),
  ];

  constructor(private readonly vector: Float32Array) {
    if (vector.length !== POLICY_VECTOR_LENGTH)
      throw new RangeError("Invalid CHOWK parameter vector length");
  }

  evaluate(observation: Float64Array, output: Float64Array): void {
    let input = observation;
    let offset = 0;
    for (let layer = 0; layer < POLICY_DIMENSIONS.length - 1; layer++) {
      const inputs = POLICY_DIMENSIONS[layer];
      const outputs = POLICY_DIMENSIONS[layer + 1];
      const activation = this.hidden[layer] ?? output;
      const biases = offset + inputs * outputs;
      for (let row = 0; row < outputs; row++) {
        let value = this.vector[biases + row];
        const start = offset + row * inputs;
        for (let col = 0; col < inputs; col++) value += this.vector[start + col] * input[col];
        activation[row] = layer < this.hidden.length ? Math.max(0, value) : value;
      }
      input = activation;
      offset = biases + outputs;
    }
  }
}
