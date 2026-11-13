import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { decodePolicy, type PolicyWeights } from "@chowk/controllers";
import { atomicText, checkpointName, readState, runPath } from "./run-files";

const { values } = parseArgs({ options: { run: { type: "string" }, out: { type: "string" } } });
const run = runPath(values.run ?? "main");
const state = await readState(run);
if (state.config.smoke && !values.out)
  throw new Error("Use --out to export a smoke run to a separate directory");
const out = values.out ?? "apps/web/public/policies";
const variant = state.config.variant;
const generations = [...new Set([0, 5, 20, 60, state.bestGeneration, state.generation])]
  .filter(
    (generation) =>
      state.history.find((item) => item.generation === generation)?.validationFitness !== undefined,
  )
  .sort((a, b) => a - b);
const checkpoints: { generation: number; url: string; validationFitness: number }[] = [];
for (const generation of generations) {
  const source = join(run, "checkpoints", checkpointName(generation));
  const json = await readFile(source, "utf8");
  const policy = JSON.parse(json) as PolicyWeights;
  decodePolicy(policy);
  if (policy.meta.generation !== generation || policy.meta.configHash !== state.configHash)
    throw new Error(`Checkpoint provenance mismatch at generation ${generation}`);
  if (variant === "chowk") {
    const filename = `checkpoint-${String(generation).padStart(4, "0")}.json`;
    await atomicText(join(out, filename), json);
    checkpoints.push({
      generation,
      url: `/policies/${filename}`,
      validationFitness: policy.meta.validationFitness,
    });
  }
  if (generation === state.bestGeneration) {
    // The pure policy ignores the residual coefficient. Persist its effective value.
    const exported =
      variant === "chowk-pure" ? `${JSON.stringify({ ...policy, beta: 0 })}\n` : json;
    await atomicText(join(out, `${variant}.json`), exported);
  }
}
if (variant === "chowk") {
  const points = state.history.map(
    ({ generation, meanFitness, bestFitness, validationFitness }) => ({
      generation,
      meanFitness,
      bestFitness,
      validationFitness,
    }),
  );
  // How much simulated traffic the run consumed. Each training generation evaluates every
  // perturbed policy and the area max-pressure baseline on `episodes` sampled episodes; each
  // validation runs the centre on every validation seed, after one baseline pass at the start.
  const { population, episodes, validationSeeds, warmup, measured } = state.config;
  const training = state.history.filter(({ generation }) => generation > 0).length;
  const validations = state.history.filter(
    ({ validationFitness }) => validationFitness !== undefined,
  ).length;
  const trainingEpisodes = training * (population + 1) * episodes;
  const validationEpisodes = (validations + 1) * validationSeeds;
  const totals = {
    generations: state.generation,
    episodeSeconds: warmup + measured,
    trainingEpisodes,
    validationEpisodes,
    simulatedHours: ((trainingEpisodes + validationEpisodes) * (warmup + measured)) / 3_600,
    wallSeconds: state.history.reduce((sum, { wallSeconds }) => sum + wallSeconds, 0),
  };
  const curve = {
    version: 1,
    variant,
    bestGeneration: state.bestGeneration,
    bestValidationFitness: state.bestValidationFitness,
    totals,
    points,
    checkpoints,
  };
  await atomicText(join(out, "training-curve.json"), `${JSON.stringify(curve, null, 2)}\n`);
}
process.stdout.write(`Exported ${variant} generation ${state.bestGeneration} to ${out}\n`);
