import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import type { LearnedId } from "@chowk/controllers";
import type { Horizon } from "./domain";
import type { AdamState } from "./es";

const simPaths = [
  "packages/sim/src",
  "packages/sim/networks",
  "packages/controllers/src",
  "packages/scenarios/src",
  "results/calibration.json",
];

export interface TrainingConfig extends Horizon {
  seed: number;
  population: number;
  episodes: number;
  validationSeeds: number;
  anneal: number;
  sigma: number;
  learningRate: number;
  variant: LearnedId;
  smoke: boolean;
}

export interface GenerationRecord {
  generation: number;
  meanFitness: number;
  bestFitness: number;
  validationFitness?: number;
  sigma: number;
  learningRate: number;
  wallSeconds: number;
}

export interface RunState {
  version: 1;
  config: TrainingConfig;
  configHash: string;
  gitCommit: string;
  generation: number;
  bestGeneration: number;
  bestValidationFitness: number;
  randomState: number;
  center: number[];
  optimizer: Omit<AdamState, "first" | "second"> & { first: number[]; second: number[] };
  history: GenerationRecord[];
}

function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8", windowsHide: true }).trim();
}

export async function configFingerprint(config: TrainingConfig) {
  if (!config.smoke && git(["status", "--porcelain", "--", ...simPaths, "packages/train/src"])) {
    throw new Error(
      "Commit simulator, calibration, controllers and training code before a main training run",
    );
  }
  const hash = createHash("sha256").update(JSON.stringify(config));
  for (const path of [...simPaths, "packages/train/src"]) {
    if (path.endsWith(".json")) {
      hash.update(path).update(await readFile(path));
      continue;
    }
    const files = (await readdir(path, { recursive: true }))
      .filter((name) => /\.(ts|json)$/.test(name))
      .sort();
    for (const file of files)
      hash.update(`${path}/${file.replaceAll("\\", "/")}`).update(await readFile(join(path, file)));
  }
  return { configHash: hash.digest("hex"), gitCommit: git(["rev-parse", "HEAD"]) };
}

export function runPath(id: string): string {
  if (!/^[a-z0-9][a-z0-9_-]{0,59}$/.test(id))
    throw new RangeError(
      "Run name must contain only lower-case letters, numbers, hyphens and underscores",
    );
  return join("runs", id);
}

export function checkpointName(generation: number): string {
  return `gen-${String(generation).padStart(4, "0")}.json`;
}

export async function atomicText(path: string, data: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = join(dirname(path), `.${basename(path)}.${process.pid}.tmp`);
  await writeFile(temporary, data, "utf8");
  await rename(temporary, path);
}

export async function readState(path: string): Promise<RunState> {
  const value = JSON.parse(await readFile(join(path, "state.json"), "utf8")) as RunState;
  if (
    value.version !== 1 ||
    value.history.at(-1)?.generation !== value.generation ||
    value.bestGeneration > value.generation
  )
    throw new Error("Invalid training checkpoint state");
  return value;
}

export async function persistState(path: string, state: RunState): Promise<void> {
  await atomicText(join(path, "state.json"), JSON.stringify(state));
  await syncLog(path, state);
}

export async function syncLog(path: string, state: RunState): Promise<void> {
  await atomicText(
    join(path, "log.jsonl"),
    `${state.history.map((line) => JSON.stringify(line)).join("\n")}\n`,
  );
}
