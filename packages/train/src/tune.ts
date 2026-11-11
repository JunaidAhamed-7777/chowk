import { availableParallelism } from "node:os";
import { parseArgs } from "node:util";
import type { ControllerId } from "@chowk/controllers";
import { makeScenario, saturationFor } from "@chowk/scenarios";
import { corridor } from "@chowk/sim";
import type { Episode, EpisodeOutcome } from "./episode";
import { TrainingPool } from "./pool";
import { atomicText } from "./run-files";
import { VALIDATION_SEEDS } from "./seed";

const { values } = parseArgs({
  options: {
    workers: { type: "string" },
    "validation-seeds": { type: "string" },
    warmup: { type: "string" },
    measured: { type: "string" },
  },
});

function integer(
  value: string | undefined,
  fallback: number,
  label: string,
  min: number,
  max: number,
): number {
  const number = Number(value ?? fallback);
  if (!Number.isInteger(number) || number < min || number > max)
    throw new RangeError(`--${label} must be an integer from ${min} to ${max}`);
  return number;
}

function average(outcomes: EpisodeOutcome[]) {
  return {
    delayPerPerson:
      outcomes.reduce((sum, outcome) => sum + outcome.personDelay, 0) / outcomes.length,
    completed: outcomes.reduce((sum, outcome) => sum + outcome.completed, 0) / outcomes.length,
    backlog: outcomes.reduce((sum, outcome) => sum + outcome.backlog, 0) / outcomes.length,
  };
}

const count = integer(
  values["validation-seeds"],
  8,
  "validation-seeds",
  1,
  VALIDATION_SEEDS.length,
);
const workers = integer(
  values.workers,
  Math.max(1, Math.min(6, availableParallelism() - 1)),
  "workers",
  1,
  64,
);
const warmup = integer(values.warmup, 150, "warmup", 0, 3_600);
const measured = integer(values.measured, 450, "measured", 30, 3_600);
const scenario = makeScenario("morning-peak", { network: corridor, duration: warmup + measured });
const episodes: Episode[] = VALIDATION_SEEDS.slice(0, count).map((seed) => ({
  seed,
  split: "validation",
  scenario,
  warmup,
  measured,
}));
const saturation = corridor.links.map(({ id }) => saturationFor(corridor, scenario, id));
const candidates = [
  { controller: "webster" as const, hysteresis: 0 },
  ...[0, 0.0125, 0.025, 0.05, 0.1].map((hysteresis) => ({
    controller: "mp-area" as const,
    hysteresis,
  })),
  ...[0, 1, 2, 4, 8].map((hysteresis) => ({
    controller: "mp-count" as const,
    hysteresis,
  })),
];

const pool = new TrainingPool(workers);
try {
  const results = await Promise.all(
    candidates.map(async (candidate) => {
      const outcomes = await Promise.all(
        episodes.map(
          async (episode) =>
            (await pool.evaluate({ ...candidate, episodes: [episode], saturation }))[0],
        ),
      );
      return { ...candidate, ...average(outcomes) };
    }),
  );
  function selected(controller: ControllerId) {
    const winner = results
      .filter((item) => item.controller === controller)
      .sort((a, b) => a.delayPerPerson - b.delayPerPerson || a.hysteresis - b.hysteresis)[0];
    if (!winner) throw new Error(`No tuning results for ${controller}`);
    return winner.hysteresis;
  }
  const report = {
    area: selected("mp-area"),
    count: selected("mp-count"),
    scenario: scenario.id,
    warmup,
    measured,
    validationSeeds: episodes.map(({ seed }) => seed),
    candidates: results,
  };
  await atomicText(
    "packages/controllers/src/tuned-hysteresis.json",
    `${JSON.stringify(report, null, 2)}\n`,
  );
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} finally {
  await pool.close();
}
