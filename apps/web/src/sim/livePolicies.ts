import { decodePolicy, type PolicyWeights } from "@chowk/controllers";
import type { ControllerChoice } from "./protocol";

const policyUrls = import.meta.glob<string>("/public/policies/{chowk,chowk-pure}.json", {
  eager: true,
  import: "default",
  query: "?url&no-inline",
});
const manifests = import.meta.glob<string>("/public/policies/training-curve.json", {
  eager: true,
  import: "default",
  query: "?raw",
});
export const hasPolicyAssets = Object.keys(policyUrls).length > 0;

export function parsePolicy(value: unknown): PolicyWeights {
  const policy = value as PolicyWeights;
  decodePolicy(policy);
  return policy;
}

async function bundledPolicy(name: string, signal: AbortSignal) {
  const url = policyUrls[`/public/policies/${name}.json`];
  if (!url) return undefined;
  try {
    const response = await fetch(url, { signal });
    return response.ok ? parsePolicy(await response.json()) : undefined;
  } catch {
    return undefined;
  }
}

export const baselineChoices: { controller: ControllerChoice; label: string }[] = [
  { controller: { id: "webster" }, label: "Fixed-time (Webster)" },
  { controller: { id: "actuated" }, label: "Actuated (gap-out)" },
  { controller: { id: "mp-count" }, label: "Max-pressure (counts)" },
  { controller: { id: "mp-area" }, label: "Max-pressure (area)" },
];

export async function loadControllerChoices(signal: AbortSignal) {
  const [learned, pure] = await Promise.all([
    bundledPolicy("chowk", signal),
    bundledPolicy("chowk-pure", signal),
  ]);
  const choices = [...baselineChoices];
  if (learned)
    choices.push({
      controller: { id: "chowk", policy: learned },
      label: learned.meta.generation === 0 ? "CHOWK (generation 0)" : "CHOWK",
    });
  if (learned && learned.meta.generation !== 0)
    choices.push({
      controller: { id: "chowk+preempt", policy: learned },
      label: "CHOWK with ambulance pre-emption",
    });
  if (pure) choices.push({ controller: { id: "chowk-pure", policy: pure }, label: "CHOWK-pure" });
  return choices;
}

export const defaultControllers = [
  baselineChoices[0].controller,
  baselineChoices[3].controller,
] as const;

export interface TrainingCurve {
  bestGeneration: number;
  points: { generation: number; validationFitness?: number }[];
  checkpoints: { generation: number; url: string }[];
}

export function trainingCurve(): TrainingCurve | undefined {
  const source = manifests["/public/policies/training-curve.json"];
  if (!source) return undefined;
  try {
    const curve = JSON.parse(source) as TrainingCurve;
    if (Array.isArray(curve.checkpoints) && Array.isArray(curve.points)) return curve;
  } catch {
    return undefined;
  }
}
