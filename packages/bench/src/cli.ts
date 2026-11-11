import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { availableParallelism } from "node:os";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { Worker } from "node:worker_threads";
import type { PolicyWeights } from "@chowk/controllers";
import type { WorkerJob, WorkerReply } from "./cli-worker";
import { headlineFor } from "./headline";
import { measurePolicy } from "./measure-policy";
import {
  benchmarkPath,
  policyDirectory,
  readBenchmark,
  sha256,
  simulatorVersion,
  verifyBenchmark,
  versionPaths,
} from "./provenance";
import { writeReports } from "./report";
import { summariseRuns } from "./statistics";
import {
  equivalentIdentity,
  isSuiteId,
  measurementSeconds,
  policyFor,
  suiteRuns,
  warmupSeconds,
} from "./suites";
import {
  type BenchmarkFile,
  type BenchmarkRun,
  type EngineeringReport,
  type RunIdentity,
  runKey,
  type SuiteId,
} from "./types";

const root = process.cwd();

function git(...args: string[]): string {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function assertCleanInputs(policies: Iterable<string>): void {
  const inputs = [
    ...versionPaths,
    ...Array.from(policies, (policy) => `${policyDirectory}/${policy}.json`),
    "packages/bench/src/cli.ts",
    "packages/bench/src/cli-worker.ts",
  ];
  const dirty = git("status", "--porcelain=v1", "--untracked-files=all", "--", ...inputs);
  if (dirty) throw new Error(`Commit benchmark inputs before running held-out seeds.\n${dirty}`);
}

function readEngineering(): EngineeringReport | undefined {
  const path = resolve(root, "results/engineering.json");
  return existsSync(path)
    ? (JSON.parse(readFileSync(path, "utf8")) as EngineeringReport)
    : undefined;
}

function readPolicy(name: string): { weights: PolicyWeights; hash: string } {
  const path = resolve(root, policyDirectory, `${name}.json`);
  if (!existsSync(path))
    throw new Error(
      `Export the validation-selected policy at ${policyDirectory}/${name}.json before running this suite`,
    );
  const bytes = readFileSync(path);
  return { weights: JSON.parse(bytes.toString("utf8")) as PolicyWeights, hash: sha256(bytes) };
}

function withPublishLock<T>(run: () => T): T {
  const directory = resolve(root, "runs");
  mkdirSync(directory, { recursive: true });
  const lock = resolve(directory, "benchmark-publish.lock");
  try {
    writeFileSync(lock, `${process.pid}\n`, { flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST")
      throw new Error("Another benchmark process is publishing. Retry when it finishes.");
    throw error;
  }
  try {
    return run();
  } finally {
    unlinkSync(lock);
  }
}

function save(benchmark: BenchmarkFile): void {
  mkdirSync(resolve(root, "results"), { recursive: true });
  const file = resolve(root, benchmarkPath);
  const temporary = `${file}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(benchmark, null, 2)}\n`);
  try {
    renameSync(temporary, file);
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}

function regenerate(benchmark: BenchmarkFile): BenchmarkFile {
  const { summary, comparisons } = summariseRuns(benchmark.runs);
  return { ...benchmark, summary, comparisons, headline: headlineFor(comparisons) };
}

async function execute(jobs: WorkerJob[], concurrency: number): Promise<BenchmarkRun[]> {
  if (jobs.length === 0) return [];
  const workers: Worker[] = [];
  const results = new Array<BenchmarkRun>(jobs.length);
  let started = 0;
  let finished = 0;
  const progressEvery = Math.max(1, Math.floor(jobs.length / 20));
  try {
    await new Promise<void>((accept, reject) => {
      function start(worker: Worker) {
        const job = jobs[started++];
        if (job) worker.postMessage(job);
      }
      for (let i = 0; i < Math.min(concurrency, jobs.length); i++) {
        const worker = new Worker(new URL("./cli-worker.mjs", import.meta.url));
        workers.push(worker);
        worker.once("error", reject);
        worker.once("exit", (status) => {
          if (finished < jobs.length)
            reject(new Error(`Benchmark worker exited with status ${status}`));
        });
        worker.on("message", (message: WorkerReply) => {
          if ("error" in message) {
            reject(new Error(`${runKey(jobs[message.index].identity)}: ${message.error}`));
            return;
          }
          results[message.index] = message.run;
          finished++;
          if (finished % progressEvery === 0 || finished === jobs.length)
            console.log(`Completed ${finished}/${jobs.length} episodes`);
          if (finished === jobs.length) accept();
          else start(worker);
        });
        start(worker);
      }
    });
    return results;
  } finally {
    await Promise.allSettled(workers.map((worker) => worker.terminate()));
  }
}

function currentBenchmark(): BenchmarkFile | undefined {
  const benchmark = readBenchmark(root);
  if (benchmark) {
    const problems = verifyBenchmark(root, benchmark);
    if (problems.length > 0)
      throw new Error(
        `Existing benchmark is stale. Start a new publication with --replace.\n${problems.join("\n")}`,
      );
  }
  return benchmark;
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      suite: { type: "string", multiple: true },
      jobs: { type: "string" },
      replace: { type: "boolean" },
    },
  });
  const [command = "run"] = positionals;
  if (positionals.length > 1) throw new Error("Expected one benchmark command");
  const concurrency =
    values.jobs === undefined
      ? Math.min(8, Math.max(1, availableParallelism() - 1))
      : Number(values.jobs);
  if (!Number.isSafeInteger(concurrency) || concurrency <= 0)
    throw new RangeError("--jobs must be a positive integer");
  if (command === "measure-policy") {
    const { weights, hash } = readPolicy("chowk");
    const measurement = {
      ...measurePolicy(weights),
      policyHash: hash,
      runtime: `Node ${process.version}`,
    };
    const directory = resolve(root, "runs");
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      resolve(directory, "policy-inference.json"),
      `${JSON.stringify(measurement, null, 2)}\n`,
    );
    console.log(
      `Exported generation ${measurement.generation} · ${measurement.policyMicroseconds.toFixed(2)} µs per inference (${measurement.decisions} timed decisions)`,
    );
    return;
  }
  if (command === "smoke") {
    const identities = suiteRuns("B1", [500_000]).filter(
      ({ scenario, controller }) =>
        scenario === "off-peak" && (controller === "webster" || controller === "mp-area"),
    );
    const runs = await execute(
      identities.map((identity, index) => ({
        index,
        identity,
        options: { warmup: 10, measurement: 90 },
      })),
      concurrency,
    );
    for (const run of runs) {
      if (!(run.metrics.generated > 0) || !Number.isFinite(run.metrics.delayPerPerson))
        throw new Error(`Smoke run ${run.controller} did not exercise real demand`);
      console.log(
        `${run.scenario} · ${run.controller} · validation seed ${run.seed} · state ${run.finalHash.toString(16).padStart(8, "0")}`,
      );
    }
    return;
  }
  if (command === "summarise" || command === "readme") {
    withPublishLock(() => {
      const benchmark = currentBenchmark();
      if (!benchmark) throw new Error("Run the benchmark before generating reports");
      const generated = regenerate(benchmark);
      if (command === "summarise") save(generated);
      writeReports(root, generated);
      console.log(generated.headline);
    });
    return;
  }
  if (command !== "run" && command !== "all")
    throw new Error(`Unknown benchmark command ${command}`);
  const selected =
    command === "all"
      ? ["B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8"]
      : (values.suite ?? ["B1"]).flatMap((suite) => suite.toUpperCase().split(","));
  const suites: SuiteId[] = [];
  for (const suite of new Set(selected)) {
    if (isSuiteId(suite)) suites.push(suite);
    else if (suite !== "B8") throw new RangeError(`Unknown benchmark suite ${suite}`);
  }
  const requests = suites.flatMap((suite) => suiteRuns(suite));
  const neededPolicies = new Set([
    "chowk",
    ...requests.flatMap(({ controller }) => policyFor(controller) ?? []),
  ]);
  assertCleanInputs(neededPolicies);
  const startCommit = git("rev-parse", "HEAD");
  const simVersion = simulatorVersion(root);
  const old = values.replace ? undefined : currentBenchmark();
  const refreshEngineering = selected.includes("B8");
  const engineering = refreshEngineering
    ? (readEngineering() ?? old?.engineering)
    : old?.engineering;
  if (refreshEngineering && !engineering)
    throw new Error(
      "Record B8 measurements in results/engineering.json before adding them to the benchmark",
    );
  if (requests.length === 0 && !old)
    throw new Error("Publish traffic runs before appending engineering measurements");
  const policies = new Map([...neededPolicies].sort().map((name) => [name, readPolicy(name)]));
  const canonicalResults = new Map(
    (old?.runs ?? []).map((run) => [runKey(equivalentIdentity(run)), run]),
  );
  const queue = new Map<string, RunIdentity>();
  for (const request of requests) {
    const equivalent = equivalentIdentity(request);
    const key = runKey(equivalent);
    if (!canonicalResults.has(key)) queue.set(key, equivalent);
  }
  const jobs = [...queue.values()].map((identity, index) => ({
    index,
    identity,
    options: { policy: policies.get(identity.controller)?.weights },
  }));
  console.log(
    `Benchmark ${selected.join(", ")} · ${jobs.length} new episodes · ${concurrency} workers`,
  );
  const start = performance.now();
  const completed = await execute(jobs, concurrency);
  const elapsed = (performance.now() - start) / 1_000;
  for (const run of completed) canonicalResults.set(runKey(run), run);
  assertCleanInputs(neededPolicies);
  if (simulatorVersion(root) !== simVersion)
    throw new Error("Simulator inputs changed during the benchmark");
  for (const [policy, data] of policies) {
    if (readPolicy(policy).hash !== data.hash)
      throw new Error(`Policy ${policy} changed during the benchmark`);
  }
  withPublishLock(() => {
    const previous = values.replace ? undefined : currentBenchmark();
    const reuseTrafficProvenance = completed.length === 0 && previous?.meta;
    const allRuns = new Map((previous?.runs ?? []).map((run) => [runKey(run), run]));
    for (const request of requests) {
      const result = canonicalResults.get(runKey(equivalentIdentity(request)));
      if (!result) throw new Error(`Episode ${runKey(request)} did not return a result`);
      allRuns.set(runKey(request), {
        ...request,
        metrics: result.metrics,
        finalHash: result.finalHash,
      });
    }
    const runs = [...allRuns.keys()].sort().map((key) => {
      const run = allRuns.get(key);
      if (!run) throw new Error("Benchmark run disappeared before publication");
      return run;
    });
    const policyHashes = {
      ...previous?.meta.policyHashes,
      ...Object.fromEntries([...policies].map(([name, data]) => [name, data.hash])),
    };
    const benchmark = regenerate({
      meta: {
        gitCommit: reuseTrafficProvenance ? reuseTrafficProvenance.gitCommit : startCommit,
        simVersion,
        policyHash: policyHashes.chowk,
        policyHashes,
        createdAt: reuseTrafficProvenance
          ? reuseTrafficProvenance.createdAt
          : new Date().toISOString(),
        runtime: reuseTrafficProvenance
          ? reuseTrafficProvenance.runtime
          : `Node ${process.version}`,
        wallSeconds: (previous?.meta.wallSeconds ?? 0) + (completed.length === 0 ? 0 : elapsed),
        simulatedSeconds:
          new Set(runs.map((run) => runKey(equivalentIdentity(run)))).size *
          (warmupSeconds + measurementSeconds),
        warmupSeconds,
        measurementSeconds,
        seeds: [...new Set(runs.map(({ seed }) => seed))].sort((a, b) => a - b),
      },
      runs,
      summary: [],
      comparisons: [],
      headline: "",
      engineering: refreshEngineering
        ? (readEngineering() ?? previous?.engineering ?? engineering)
        : (previous?.engineering ?? engineering),
    });
    save(benchmark);
    writeReports(root, benchmark);
    console.log(benchmark.headline);
  });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
