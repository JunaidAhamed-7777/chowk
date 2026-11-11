import type { PolicyWeights } from "@chowk/controllers";
import { useEffect, useRef, useState } from "react";
import { parsePolicy, trainingCurve } from "../sim/livePolicies";

const manifest = trainingCurve();
const checkpoints = manifest?.checkpoints ?? [];
const number = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 });
const bounds = { width: 210, height: 38, margin: 4 };
const validPoints = (manifest?.points ?? []).filter(
  (point): point is { generation: number; validationFitness: number } =>
    Number.isFinite(point.validationFitness),
);
const generations = validPoints.map(({ generation }) => generation);
const minimum = Math.min(...validPoints.map(({ validationFitness }) => validationFitness));
const maximum = Math.max(...validPoints.map(({ validationFitness }) => validationFitness));
const first = Math.min(...generations);
const last = Math.max(...generations);

function pointAt(generation: number, value: number) {
  const { width, height, margin } = bounds;
  return [
    margin + ((generation - first) / Math.max(1, last - first)) * (width - 2 * margin),
    height -
      margin -
      ((value - minimum) / Math.max(0.0001, maximum - minimum)) * (height - 2 * margin),
  ];
}

const path = validPoints
  .map(({ generation, validationFitness }, index) => {
    const [x, y] = pointAt(generation, validationFitness);
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
  })
  .join("");

export function CheckpointControl({
  policy,
  onPolicy,
  disabled,
}: {
  policy: PolicyWeights | undefined;
  onPolicy: (weights: PolicyWeights) => void;
  disabled: boolean;
}) {
  const fallback = checkpoints.findIndex(
    ({ generation }) => generation === manifest?.bestGeneration,
  );
  const active = checkpoints.findIndex(({ generation }) => generation === policy?.meta.generation);
  const [selection, setSelection] = useState<number | undefined>();
  const [status, setStatus] = useState("");
  const pending = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => pending.current?.abort(), []);
  if (checkpoints.length < 2) return null;
  const index = selection ?? Math.max(0, active >= 0 ? active : fallback);
  const choice = checkpoints[index];

  function choose(next: number) {
    pending.current?.abort();
    const request = new AbortController();
    pending.current = request;
    setSelection(next);
    setStatus("Loading checkpoint…");
    const target = checkpoints[next];
    void fetch(target.url, { signal: request.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Checkpoint could not be loaded.");
        const weights = parsePolicy(await response.json());
        if (weights.meta.generation !== target.generation)
          throw new Error("Checkpoint generation mismatch.");
        if (request.signal.aborted) return;
        onPolicy(weights);
        setStatus(`Generation ${target.generation} is active.`);
      })
      .catch(() => {
        if (request.signal.aborted) return;
        setSelection(undefined);
        setStatus("Checkpoint unavailable. Try again.");
      });
  }

  const selected = validPoints.find(({ generation }) => generation === choice.generation);
  const dot = selected && pointAt(selected.generation, selected.validationFitness);
  return (
    <details className="checkpoint-control event-menu">
      <summary className="control-button checkpoint-button">Watch it learn</summary>
      <div className="checkpoint-panel">
        <label>
          <span>
            Generation <strong>{choice.generation}</strong>
          </span>
          <input
            type="range"
            aria-label="Policy checkpoint"
            aria-valuetext={`Generation ${choice.generation}`}
            min={0}
            max={checkpoints.length - 1}
            step={1}
            value={index}
            disabled={disabled}
            onChange={(event) => choose(Number(event.target.value))}
          />
        </label>
        {path && (
          <svg
            viewBox={`0 0 ${bounds.width} ${bounds.height}`}
            role="img"
            aria-label="Validation fitness across generations"
          >
            <title>Validation fitness across generations</title>
            <path d={path} fill="none" stroke="#3df2b4" strokeWidth="1.4" />
            {dot && <circle cx={dot[0]} cy={dot[1]} r="3.1" fill="#d4ffef" />}
          </svg>
        )}
        <p>
          {selected
            ? `Validation fitness ${number.format(selected.validationFitness)}. Simulation result.`
            : "Validation fitness is unavailable for this checkpoint."}
        </p>
        <p role="status">{status}</p>
      </div>
    </details>
  );
}
