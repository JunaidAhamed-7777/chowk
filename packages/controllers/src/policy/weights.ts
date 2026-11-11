export const POLICY_FORMAT = "chowk-mlp-v1";
export const OBSERVATION_VERSION = 1;
export const POLICY_DIMENSIONS = [50, 64, 64, 4] as const;
export const POLICY_PARAMETER_COUNT = 7_684;
export const POLICY_VECTOR_LENGTH = POLICY_PARAMETER_COUNT + 1;

export interface PolicyMetadata {
  generation: number;
  validationFitness: number;
  gitCommit: string;
  configHash: string;
}

export interface PolicyWeights {
  format: typeof POLICY_FORMAT;
  layers: { in: number; out: number; w: string; b: string }[];
  beta: number;
  obsVersion: number;
  meta: PolicyMetadata;
}

const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function encodeFloats(values: Float32Array): string {
  const bytes = new DataView(new ArrayBuffer(values.length * 4));
  for (let i = 0; i < values.length; i++) bytes.setFloat32(i * 4, values[i], true);
  let output = "";
  for (let i = 0; i < bytes.byteLength; i += 3) {
    const a = bytes.getUint8(i);
    const b = i + 1 < bytes.byteLength ? bytes.getUint8(i + 1) : 0;
    const c = i + 2 < bytes.byteLength ? bytes.getUint8(i + 2) : 0;
    output += BASE64[a >> 2] + BASE64[((a & 3) << 4) | (b >> 4)];
    output += i + 1 < bytes.byteLength ? BASE64[((b & 15) << 2) | (c >> 6)] : "=";
    output += i + 2 < bytes.byteLength ? BASE64[c & 63] : "=";
  }
  return output;
}

function decodeFloats(encoded: string, target: Float32Array): void {
  const size = target.length * 4;
  if (typeof encoded !== "string" || encoded.length !== Math.ceil(size / 3) * 4) {
    throw new TypeError("Invalid policy parameter length");
  }
  const bytes = new DataView(new ArrayBuffer(size));
  for (let input = 0, output = 0; output < size; input += 4) {
    const values = [0, 1, 2, 3].map((offset) => BASE64.indexOf(encoded[input + offset]));
    const remaining = size - output;
    for (let offset = 0; offset < 4; offset++) {
      if (offset <= remaining ? values[offset] < 0 : encoded[input + offset] !== "=") {
        throw new TypeError("Invalid base64 policy parameters");
      }
    }
    bytes.setUint8(output++, (values[0] << 2) | (values[1] >> 4));
    if (remaining >= 2) bytes.setUint8(output++, (values[1] << 4) | (values[2] >> 2));
    if (remaining >= 3) bytes.setUint8(output++, (values[2] << 6) | values[3]);
  }
  for (let i = 0; i < target.length; i++) {
    const value = bytes.getFloat32(i * 4, true);
    if (!Number.isFinite(value)) throw new TypeError("Non-finite policy weight");
    target[i] = value;
  }
}

export function encodePolicy(vector: Float32Array, meta: PolicyMetadata): PolicyWeights {
  if (vector.length !== POLICY_VECTOR_LENGTH || vector.some((value) => !Number.isFinite(value))) {
    throw new TypeError("Invalid policy parameter vector");
  }
  const layers: PolicyWeights["layers"] = [];
  let offset = 0;
  for (let index = 0; index < POLICY_DIMENSIONS.length - 1; index++) {
    const inputs = POLICY_DIMENSIONS[index];
    const outputs = POLICY_DIMENSIONS[index + 1];
    const endWeights = offset + inputs * outputs;
    layers.push({
      in: inputs,
      out: outputs,
      w: encodeFloats(vector.subarray(offset, endWeights)),
      b: encodeFloats(vector.subarray(endWeights, endWeights + outputs)),
    });
    offset = endWeights + outputs;
  }
  return {
    format: POLICY_FORMAT,
    layers,
    beta: vector[POLICY_PARAMETER_COUNT],
    obsVersion: OBSERVATION_VERSION,
    meta,
  };
}

export function decodePolicy(policy: PolicyWeights): Float32Array {
  if (
    policy?.format !== POLICY_FORMAT ||
    policy.obsVersion !== OBSERVATION_VERSION ||
    !Array.isArray(policy.layers) ||
    policy.layers.length !== POLICY_DIMENSIONS.length - 1 ||
    !Number.isFinite(policy.beta) ||
    !Number.isFinite(Math.fround(policy.beta))
  ) {
    throw new TypeError("Unsupported CHOWK policy format");
  }
  const vector = new Float32Array(POLICY_VECTOR_LENGTH);
  let offset = 0;
  for (let index = 0; index < policy.layers.length; index++) {
    const layer = policy.layers[index];
    if (
      !layer ||
      layer.in !== POLICY_DIMENSIONS[index] ||
      layer.out !== POLICY_DIMENSIONS[index + 1]
    )
      throw new TypeError("Invalid CHOWK layer shape");
    const endWeights = offset + layer.in * layer.out;
    decodeFloats(layer.w, vector.subarray(offset, endWeights));
    decodeFloats(layer.b, vector.subarray(endWeights, endWeights + layer.out));
    offset = endWeights + layer.out;
  }
  vector[offset] = policy.beta;
  return vector;
}

export function generationZero(): Float32Array {
  const vector = new Float32Array(POLICY_VECTOR_LENGTH);
  vector[POLICY_PARAMETER_COUNT] = 1;
  return vector;
}
