import { decodePolicy, type PolicyWeights } from "@chowk/controllers";
import type { ControllerChoice } from "./protocol";

const bundled = import.meta.glob<string>(
  "/public/policies/{chowk,chowk-pure,training-curve}.json",
  { eager: true, import: "default", query: "?raw" },
);

export function parsePolicy(value: unknown): PolicyWeights {
  const policy = value as PolicyWeights;
  decodePolicy(policy);
  return policy;
}

function bundledPolicy(name: string) {
  const source = bundled[`/public/policies/${name}.json`];
  if (!source) return undefined;
  try {
    return parsePolicy(JSON.parse(source));
  } catch {
    return undefined;
  }
}

const learned = bundledPolicy("chowk");
const pure = bundledPolicy("chowk-pure");

const choices: { controller: ControllerChoice; label: string }[] = [
  { controller: { id: "webster" }, label: "Fixed-time (Webster)" },
  { controller: { id: "actuated" }, label: "Actuated (gap-out)" },
  { controller: { id: "mp-count" }, label: "Max-pressure (counts)" },
  { controller: { id: "mp-area" }, label: "Max-pressure (area)" },
];

if (learned)
  choices.push({
    controller: { id: "chowk", policy: learned },
    label: learned.meta.generation === 0 ? "CHOWK (generation 0)" : "CHOWK",
  });
if (pure) choices.push({ controller: { id: "chowk-pure", policy: pure }, label: "CHOWK-pure" });

export const controllerChoices = choices;
export const defaultControllers = [
  choices[0].controller,
  (choices.find(({ controller }) => controller.id === "chowk") ?? choices[3]).controller,
] as const;

export interface TrainingCurve {
  bestGeneration: number;
  points: { generation: number; validationFitness?: number }[];
  checkpoints: { generation: number; url: string }[];
}

export function trainingCurve(): TrainingCurve | undefined {
  const source = bundled["/public/policies/training-curve.json"];
  if (!source) return undefined;
  try {
    const curve = JSON.parse(source) as TrainingCurve;
    if (Array.isArray(curve.checkpoints) && Array.isArray(curve.points)) return curve;
  } catch {
    return undefined;
  }
}
