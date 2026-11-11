import { access, open, mkdir, unlink } from "node:fs/promises";
import { availableParallelism } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import {
  encodePolicy,
  generationZero,
  type LearnedId,
  POLICY_DIMENSIONS,
  POLICY_PARAMETER_COUNT,
} from "@chowk/controllers";
import { Random } from "@chowk/sim";
import { sampledEpisodes, validationEpisodes } from "./domain";
import { type Episode, pairedFitness } from "./episode";
import { adamState, noiseVector, normal, perturb, updateCenter } from "./es";
import { TrainingPool } from "./pool";
import {
  atomicText,
  checkpointName,
  configFingerprint,
  type GenerationRecord,
  persistState,
  readState,
  type RunState,
  runPath,
  syncLog,
  type TrainingConfig,
} from "./run-files";
import { requireTrainingSeed } from "./seed";

const WEIGHT_DECAY = 0.005;
const MILESTONES = [5, 20, 60];
const variants: readonly LearnedId[] = [
  "chowk",
  "chowk-vehicle",
  "chowk-count",
  "chowk-pure",
  "chowk-solo",
];

const { values } = parseArgs({
  options: {
    help: { type: "boolean", short: "h" },
    smoke: { type: "boolean" },
    resume: { type: "boolean" },
    run: { type: "string" },
    generations: { type: "string" },
    population: { type: "string" },
    episodes: { type: "string" },
    workers: { type: "string" },
    warmup: { type: "string" },
    measured: { type: "string" },
    "validation-seeds": { type: "string" },
    anneal: { type: "string" },
    sigma: { type: "string" },
    "learning-rate": { type: "string" },
    variant: { type: "string" },
    seed: { type: "string" },
  },
});

function integer(
  value: string | undefined,
  fallback: number,
  label: string,
  min: number,
  max = 100_000,
): number {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max)
    throw new RangeError(`--${label} must be an integer in ${min}–${max}`);
  return parsed;
}

function positive(value: string | undefined, fallback: number, label: string): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed) || parsed < 0.00001 || parsed > 0.2) {
    throw new RangeError(`--${label} must be between 0.00001 and 0.2`);
  }
  return parsed;
}

function initialConfig(): TrainingConfig {
  const smoke = values.smoke === true;
  const variant = variants.find((id) => id === (values.variant ?? "chowk"));
  if (!variant) throw new RangeError(`Unknown training variant ${values.variant}`);
  const config = {
    seed: integer(values.seed, 3_421, "seed", 0, 99_999),
    population: integer(values.population, smoke ? 4 : 64, "population", 2, 512),
    episodes: integer(values.episodes, 2, "episodes", 1, 16),
    warmup: integer(values.warmup, smoke ? 30 : 300, "warmup", 0, 3_600),
    measured: integer(values.measured, smoke ? 60 : 900, "measured", 5, 10_800),
    validationSeeds: integer(values["validation-seeds"], smoke ? 2 : 20, "validation-seeds", 1, 20),
    anneal: integer(values.anneal, smoke ? 10 : 100, "anneal", 1),
    sigma: positive(values.sigma, 0.05, "sigma"),
    learningRate: positive(values["learning-rate"], 0.02, "learning-rate"),
    variant,
    smoke,
  };
  requireTrainingSeed(config.seed, "training");
  if (config.population % 2 !== 0)
    throw new RangeError("--population must be even for antithetic sampling");
  return config;
}

function initialize(random: Random, variant: LearnedId): Float32Array {
  const vector = generationZero();
  const pure = variant === "chowk-pure";
  let offset = 0;
  for (let layer = 0; layer < (pure ? 3 : 2); layer++) {
    const inputs = POLICY_DIMENSIONS[layer];
    const outputs = POLICY_DIMENSIONS[layer + 1];
    const scale = Math.sqrt(2 / inputs);
    for (let weight = 0; weight < inputs * outputs; weight++)
      vector[offset + weight] = normal(random) * scale;
    offset += inputs * outputs + outputs;
  }
  if (pure) vector[POLICY_PARAMETER_COUNT] = 0;
  return vector;
}

async function acquireLock(path: string) {
  const file = join(path, ".lock");
  const lock = await open(file, "wx").catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "EEXIST") throw error;
    throw new Error(
      `Another training process owns ${path}. The .lock file records its process ID.`,
    );
  });
  await lock.writeFile(String(process.pid));
  return async () => {
    await lock.close();
    await unlink(file);
  };
}

async function run() {
  const path = runPath(values.run ?? (values.smoke ? "smoke" : "main"));
  if (
    values.resume &&
    Object.keys(values).some((flag) => !["resume", "run", "generations", "workers"].includes(flag))
  )
    throw new Error(
      "Resume uses the saved training configuration. Pass only --run, --generations and --workers.",
    );
  const restored = values.resume ? await readState(path) : undefined;
  const config = restored?.config ?? initialConfig();
  const generations = integer(values.generations, config.smoke ? 10 : 100, "generations", 1);
  const workers = integer(
    values.workers,
    Math.max(1, Math.min(7, availableParallelism() - 1)),
    "workers",
    1,
    64,
  );
  const provenance = await configFingerprint(config);
  if (restored && restored.configHash !== provenance.configHash)
    throw new Error(
      "The simulator or training configuration changed since this run. Start a new run.",
    );
  await mkdir(path, { recursive: true });
  const release = await acquireLock(path);
  const pool = new TrainingPool(workers);
  let stop = false;
  const requestStop = () => {
    stop = true;
  };
  process.on("SIGINT", requestStop);
  process.on("SIGTERM", requestStop);
  try {
    if (!restored) {
      const exists = await access(join(path, "state.json")).then(
        () => true,
        (error: NodeJS.ErrnoException) => {
          if (error.code !== "ENOENT") throw error;
          return false;
        },
      );
      if (exists)
        throw new Error(`A checkpoint already exists in ${path}. Use --resume or a new run name.`);
    }
    const random = new Random(restored?.randomState ?? config.seed);
    const center = restored
      ? Float32Array.from(restored.center)
      : initialize(random, config.variant);
    const optimizer = restored
      ? {
          ...restored.optimizer,
          first: Float64Array.from(restored.optimizer.first),
          second: Float64Array.from(restored.optimizer.second),
        }
      : adamState(center.length);
    const validation = validationEpisodes(config.validationSeeds, config);
    const objective = config.variant === "chowk-vehicle" ? "vehicle" : "person";
    const evaluateBaseline = (episodes: readonly Episode[]) =>
      Promise.all(
        episodes.map(
          async (episode) =>
            (await pool.evaluate({ controller: "mp-area", episodes: [episode] }))[0],
        ),
      );
    const validationBaseline = await evaluateBaseline(validation);
    const state: RunState = restored ?? {
      version: 1,
      config,
      ...provenance,
      generation: 0,
      bestGeneration: 0,
      bestValidationFitness: Infinity,
      randomState: random.getState(),
      center: [],
      optimizer: { first: [], second: [], firstPower: 1, secondPower: 1 },
      history: [],
    };

    async function save(record: GenerationRecord, validate: boolean, started: number) {
      const generation = record.generation;
      if (validate) {
        const outcomes = await Promise.all(
          validation.map(
            async (episode) =>
              (
                await pool.evaluate({
                  controller: config.variant,
                  episodes: [episode],
                  parameters: center,
                })
              )[0],
          ),
        );
        record.validationFitness = pairedFitness(outcomes, validationBaseline, objective);
        if (generation === 0) {
          record.meanFitness = record.validationFitness;
          record.bestFitness = record.validationFitness;
        }
        if (
          generation === 0 &&
          config.variant !== "chowk-count" &&
          config.variant !== "chowk-pure" &&
          outcomes.some((outcome, index) => outcome.hash !== validationBaseline[index].hash)
        ) {
          throw new Error("Generation zero diverged from area max-pressure");
        }
        if (record.validationFitness < state.bestValidationFitness) {
          state.bestGeneration = generation;
          state.bestValidationFitness = record.validationFitness;
        }
        const policy = encodePolicy(center, {
          generation,
          validationFitness: record.validationFitness,
          gitCommit: state.gitCommit,
          configHash: state.configHash,
        });
        await atomicText(
          join(path, "checkpoints", checkpointName(generation)),
          `${JSON.stringify(policy)}\n`,
        );
      }
      record.wallSeconds = (performance.now() - started) / 1_000;
      state.generation = generation;
      state.history.push(record);
      state.randomState = random.getState();
      state.center = Array.from(center);
      state.optimizer = {
        ...optimizer,
        first: Array.from(optimizer.first),
        second: Array.from(optimizer.second),
      };
      await persistState(path, state);
      const validated =
        record.validationFitness === undefined
          ? ""
          : ` | validation ${record.validationFitness.toFixed(6)}`;
      process.stdout.write(
        `Generation ${generation} | mean ${record.meanFitness.toFixed(6)} | best ${record.bestFitness.toFixed(6)}${validated} | ${record.wallSeconds.toFixed(2)} s\n`,
      );
    }

    if (restored) await syncLog(path, state);
    else
      await save(
        {
          generation: 0,
          meanFitness: 1,
          bestFitness: 1,
          sigma: config.sigma,
          learningRate: config.learningRate,
          wallSeconds: 0,
        },
        true,
        performance.now(),
      );
    for (let generation = state.generation + 1; generation <= generations && !stop; generation++) {
      const started = performance.now();
      const progress = Math.min(1, (generation - 1) / config.anneal);
      const sigma = config.sigma * (1 - progress * 0.6);
      const learningRate = config.learningRate * (1 - progress * 0.75);
      const episodes = sampledEpisodes(random, config.episodes, config);
      const baseline = await evaluateBaseline(episodes);
      const noise = Array.from({ length: config.population / 2 }, () =>
        noiseVector(center.length, random),
      );
      const jobs = noise.flatMap((direction) =>
        [sigma, -sigma].map(async (amount) => {
          const parameters = perturb(center, direction, amount);
          const outcomes = await pool.evaluate({
            controller: config.variant,
            episodes,
            parameters,
          });
          return pairedFitness(outcomes, baseline, objective);
        }),
      );
      const fitness = await Promise.all(jobs);
      updateCenter(
        center,
        noise,
        fitness,
        sigma,
        learningRate,
        WEIGHT_DECAY,
        optimizer,
        POLICY_PARAMETER_COUNT,
      );
      const meanFitness = fitness.reduce((sum, value) => sum + value, 0) / fitness.length;
      await save(
        {
          generation,
          meanFitness,
          bestFitness: Math.min(...fitness),
          sigma,
          learningRate,
          wallSeconds: 0,
        },
        generation % 10 === 0 ||
          MILESTONES.includes(generation) ||
          generation === generations ||
          stop,
        started,
      );
    }
    process.stdout.write(
      `Best validation ${state.bestValidationFitness.toFixed(6)} at generation ${state.bestGeneration}\n`,
    );
  } finally {
    process.off("SIGINT", requestStop);
    process.off("SIGTERM", requestStop);
    await pool.close();
    await release();
  }
}

if (values.help) {
  process.stdout.write(
    "npm run train -- [--smoke] [--run ID] [--resume] [--generations N] [--workers N]\n                [--population N] [--episodes N] [--warmup S] [--measured S]\n                [--validation-seeds N] [--anneal N] [--seed N] [--variant ID]\n                [--sigma X] [--learning-rate X]\n",
  );
} else await run();
