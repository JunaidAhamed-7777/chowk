import {
  type BenchmarkFile,
  type BenchmarkRun,
  compareRuns,
  controllerLabel,
  formatMetric,
  primaryMetric,
  reproductionRuns,
  runKey,
} from "@chowk/bench";
import type { PolicyWeights } from "@chowk/controllers";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReproductionRequest, ReproductionResponse } from "./reproduction";

interface Operation {
  abort: AbortController;
  workers: Worker[];
}

type Status = "ready" | "loading" | "running" | "complete" | "stopped" | "error";

const runPlan = reproductionRuns();

export async function loadPolicy(signal: AbortSignal, hash: string): Promise<PolicyWeights> {
  const response = await fetch(`${import.meta.env.BASE_URL}policies/chowk.json`, { signal });
  if (!response.ok) throw new Error("The published policy could not be loaded. Try again.");
  const bytes = await response.arrayBuffer();
  if (globalThis.crypto?.subtle) {
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    const actual = Array.from(digest, (value) => value.toString(16).padStart(2, "0")).join("");
    if (actual !== hash)
      throw new Error(
        "The downloaded policy differs from the published policy. Reload the page and try again.",
      );
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as PolicyWeights;
}

export function BenchmarkReproduction({ benchmark }: { benchmark: BenchmarkFile }) {
  const published = new Map(
    benchmark.runs.filter(({ suite }) => suite === "B1").map((run) => [runKey(run), run]),
  );
  const records = runPlan.map((identity) => published.get(runKey(identity)));
  const supported =
    records.every(Boolean) &&
    benchmark.meta.simVersion === __CHOWK_SIM_VERSION__ &&
    benchmark.meta.policyHash === __CHOWK_POLICY_HASH__;
  const [status, setStatus] = useState<Status>("ready");
  const [error, setError] = useState("");
  const [runs, setRuns] = useState<(BenchmarkRun | undefined)[]>([]);
  const operation = useRef<Operation | null>(null);
  const completed = runs.filter(Boolean).length;
  const busy = status === "loading" || status === "running";

  const finish = useCallback(() => {
    const current = operation.current;
    operation.current = null;
    current?.abort.abort();
    for (const worker of current?.workers ?? []) worker.terminate();
  }, []);

  useEffect(() => finish, [finish]);

  async function start() {
    if (!supported || operation.current) return;
    const current: Operation = { abort: new AbortController(), workers: [] };
    operation.current = current;
    setStatus("loading");
    setError("");
    setRuns(Array.from({ length: runPlan.length }));
    function fail(message: string) {
      if (operation.current !== current) return;
      finish();
      setError(message);
      setStatus("error");
    }
    try {
      const policy = await loadPolicy(current.abort.signal, benchmark.meta.policyHash);
      if (operation.current !== current) return;
      setStatus("running");
      let next = 0;
      let done = 0;
      function send(worker: Worker) {
        const index = next++;
        const identity = runPlan[index];
        if (!identity) return;
        worker.postMessage({
          index,
          identity,
          options: {
            warmup: benchmark.meta.warmupSeconds,
            measurement: benchmark.meta.measurementSeconds,
            policy: identity.controller === "chowk" ? policy : undefined,
          },
        } satisfies ReproductionRequest);
      }
      const workerCount = Math.min(
        4,
        runPlan.length,
        Math.max(1, (navigator.hardwareConcurrency ?? 2) - 1),
      );
      for (let i = 0; i < workerCount; i++) {
        const worker = new Worker(new URL("../workers/bench.worker.ts", import.meta.url), {
          type: "module",
        });
        current.workers.push(worker);
        worker.onerror = (event) => {
          event.preventDefault();
          fail("A benchmark worker stopped. You can restart the run.");
        };
        worker.onmessage = ({ data }: MessageEvent<ReproductionResponse>) => {
          if (operation.current !== current) return;
          if ("error" in data) {
            fail(data.error);
            return;
          }
          setRuns((previous) =>
            previous.map((run, index) => (index === data.index ? data.run : run)),
          );
          if (++done === runPlan.length) {
            finish();
            setStatus("complete");
          } else {
            send(worker);
          }
        };
        send(worker);
      }
    } catch (cause) {
      fail(cause instanceof Error ? cause.message : "The benchmark could not start. Try again.");
    }
  }

  const exact =
    status === "complete" &&
    runs.every((run, index) => {
      const expected = records[index];
      return run && expected && compareRuns(run, expected).length === 0;
    });

  return (
    <section className="results-panel repro-panel" aria-labelledby="reproduction-heading">
      <div className="results-section-heading">
        <div>
          <h2 id="reproduction-heading">Run it yourself</h2>
          <p>
            Run {runPlan.length} published morning-peak episodes in this browser. Compare each state
            hash and every metric against the published run.
          </p>
        </div>
        {supported &&
          (busy ? (
            <button
              type="button"
              className="control-button"
              onClick={() => {
                finish();
                setStatus("stopped");
              }}
            >
              Stop run
            </button>
          ) : (
            <button
              type="button"
              className="control-button repro-start"
              onClick={() => {
                void start();
              }}
            >
              {status === "ready" ? "Run benchmark" : "Run again"}
            </button>
          ))}
      </div>
      {!supported && (
        <p role="status">
          Reproduction requires all published quick-suite episodes and a matching simulator and
          policy in this build.
        </p>
      )}
      {busy && (
        <progress
          aria-label="Benchmark episodes completed"
          value={completed}
          max={runPlan.length}
        />
      )}
      {status !== "ready" && (
        <p className={exact ? "repro-match" : undefined} role="status">
          {status === "loading" && "Loading the published policy…"}
          {status === "running" && `${completed} of ${runPlan.length} episodes completed`}
          {status === "stopped" && `Stopped after ${completed} of ${runPlan.length} episodes.`}
          {status === "complete" &&
            (exact
              ? "Your browser reproduced our published numbers exactly."
              : "Some runs differ from the published results. See the differences below.")}
        </p>
      )}
      {status === "error" && <p role="alert">{error}</p>}
      {completed > 0 && (
        <div className="results-table-scroll">
          <table className="results-table">
            <caption>Reproduced episodes · delay per person (s)</caption>
            <thead>
              <tr>
                <th scope="col">Controller</th>
                <th scope="col">Seed</th>
                <th scope="col">Published</th>
                <th scope="col">This browser</th>
                <th scope="col">Match</th>
              </tr>
            </thead>
            <tbody>
              {runPlan.map((identity, index) => {
                const local = runs[index];
                const expected = records[index];
                const differences = local && expected ? compareRuns(local, expected) : undefined;
                const actual = local?.metrics[primaryMetric];
                const baseline = expected?.metrics[primaryMetric];
                return (
                  <tr key={runKey(identity)}>
                    <th scope="row">{controllerLabel(identity.controller)}</th>
                    <td>{identity.seed}</td>
                    <td>{baseline === undefined ? "—" : formatMetric(primaryMetric, baseline)}</td>
                    <td>{actual === undefined ? "—" : formatMetric(primaryMetric, actual)}</td>
                    <td>
                      {differences === undefined ? (
                        "Pending"
                      ) : differences.length === 0 ? (
                        <span className="repro-match">Exact</span>
                      ) : (
                        <details>
                          <summary>Different</summary>
                          <ul>
                            {differences.map((difference) => (
                              <li key={difference}>{difference}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <dl className="repro-hashes">
        <div>
          <dt>Published simulator</dt>
          <dd>
            <code>{benchmark.meta.simVersion}</code>
          </dd>
        </div>
        <div>
          <dt>This build</dt>
          <dd>
            <code>{__CHOWK_SIM_VERSION__}</code>
          </dd>
        </div>
      </dl>
    </section>
  );
}
