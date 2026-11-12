import type { BenchmarkFile } from "@chowk/bench";
import { controllerLabel, signedPercent } from "@chowk/bench";
import { DT, holdoutNetwork, SNAPSHOT_STRIDE } from "@chowk/sim";
import { useEffect, useRef, useState } from "react";
import type { ControllerChoice } from "../sim/protocol";
import { loadPolicy } from "./BenchmarkReproduction";
import type { GridFromWorker, GridToWorker } from "./gridProtocol";

const SEED = 1042;
const SPEED = 8;
const MAX_TICKS = Math.round(1_800 / DT);
const delayFormat = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

const bounds = (() => {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const { x, z } of holdoutNetwork.nodes) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  return { minX, maxX, minZ, maxZ };
})();

interface Side {
  worker: Worker;
  frame?: GridFromWorker;
  pending: boolean;
}

function draw(canvas: HTMLCanvasElement, frame: GridFromWorker | undefined) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (canvas.width !== Math.round(width * ratio)) {
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
  }
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.fillStyle = "#05070d";
  context.fillRect(0, 0, width, height);
  const pad = 14;
  const scale = Math.min(
    (width - pad * 2) / (bounds.maxX - bounds.minX),
    (height - pad * 2) / (bounds.maxZ - bounds.minZ),
  );
  const ox = (width - (bounds.maxX - bounds.minX) * scale) / 2 - bounds.minX * scale;
  const oz = (height - (bounds.maxZ - bounds.minZ) * scale) / 2 - bounds.minZ * scale;
  context.fillStyle = "#1c2433";
  for (const { origin, dir, left, length, strips } of holdoutNetwork.links) {
    const w = strips * holdoutNetwork.stripWidth;
    const corners = [
      [origin[0], origin[1]],
      [origin[0] + dir[0] * length, origin[1] + dir[1] * length],
      [origin[0] + dir[0] * length - left[0] * w, origin[1] + dir[1] * length - left[1] * w],
      [origin[0] - left[0] * w, origin[1] - left[1] * w],
    ];
    context.beginPath();
    corners.forEach(([x, z], index) => {
      const sx = ox + x * scale;
      const sz = oz + z * scale;
      if (index === 0) context.moveTo(sx, sz);
      else context.lineTo(sx, sz);
    });
    context.fill();
  }
  if (!frame) return;
  const positions = new Float32Array(frame.positions);
  for (let offset = 0; offset < frame.count * SNAPSHOT_STRIDE; offset += SNAPSHOT_STRIDE) {
    const cls = positions[offset + 5];
    const stopped = (positions[offset + 7] & 2) !== 0;
    context.fillStyle = cls === 4 ? "#fbbf24" : stopped ? "#f87171" : "#7dd3fc";
    const size = cls === 4 ? 5 : 3;
    context.fillRect(
      ox + positions[offset] * scale - size / 2,
      oz + positions[offset + 1] * scale - size / 2,
      size,
      size,
    );
  }
}

export function GridDemo({ benchmark }: { benchmark: BenchmarkFile }) {
  const canvases = useRef<(HTMLCanvasElement | null)[]>([null, null]);
  const [running, setRunning] = useState(false);
  const [readout, setReadout] = useState<[number, number, number]>([0, 0, 0]);
  const [error, setError] = useState("");
  const published = benchmark.comparisons.find(
    (row) =>
      row.suite === "B4" &&
      row.variant === "held-out-grid" &&
      row.metric === "delayPerPerson" &&
      row.a === "chowk" &&
      row.b === "mp-area",
  );

  useEffect(() => {
    if (!running) return;
    let cancelled = false;
    let request = 0;
    const sides: Side[] = [];
    let tick = 0;
    let last = performance.now();
    let lastReadout = 0;
    void loadPolicy(new AbortController().signal, benchmark.meta.policyHash)
      .then((policy) => {
        if (cancelled) return;
        const choices: ControllerChoice[] = [{ id: "mp-area" }, { id: "chowk", policy }];
        for (const controller of choices) {
          const worker = new Worker(new URL("../workers/grid.worker.ts", import.meta.url), {
            type: "module",
          });
          const side: Side = { worker, pending: true };
          worker.onmessage = ({ data }: MessageEvent<GridFromWorker | { error: string }>) => {
            if ("error" in data) {
              setError(data.error);
              return;
            }
            if (side.frame) {
              const recycle: GridToWorker = { type: "recycle", buffer: side.frame.positions };
              worker.postMessage(recycle, [side.frame.positions]);
            }
            side.frame = data;
            side.pending = false;
          };
          const init: GridToWorker = { type: "init", seed: SEED, controller };
          worker.postMessage(init);
          sides.push(side);
        }
        const frame = (now: number) => {
          if (cancelled) return;
          const ready = sides.every((side) => !side.pending);
          if (ready && tick < MAX_TICKS) {
            tick = Math.min(
              MAX_TICKS,
              tick + Math.round(((Math.min(now - last, 100) / 1000) * SPEED) / DT),
            );
            for (const side of sides) {
              side.pending = true;
              const message: GridToWorker = { type: "advance", tick };
              side.worker.postMessage(message);
            }
          }
          last = now;
          sides.forEach((side, index) => {
            const canvas = canvases.current[index];
            if (canvas) draw(canvas, side.frame);
          });
          if (now - lastReadout > 400 && sides[0]?.frame && sides[1]?.frame) {
            lastReadout = now;
            setReadout([
              sides[0].frame.delayPerPerson,
              sides[1].frame.delayPerPerson,
              sides[0].frame.tick * DT,
            ]);
          }
          request = requestAnimationFrame(frame);
        };
        request = requestAnimationFrame(frame);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)));
    return () => {
      cancelled = true;
      cancelAnimationFrame(request);
      for (const side of sides) side.worker.terminate();
    };
  }, [running, benchmark.meta.policyHash]);

  useEffect(() => {
    canvases.current.forEach((canvas) => {
      if (canvas) draw(canvas, undefined);
    });
  }, []);

  const minutes = Math.floor(readout[2] / 60);
  return (
    <div className="grid-demo">
      <div className="grid-demo-stage">
        {(["mp-area", "chowk"] as const).map((id, index) => (
          <figure key={id}>
            <figcaption>
              {controllerLabel(id)}
              {running && readout[2] > 0 && (
                <strong>{delayFormat.format(readout[index])} s per person</strong>
              )}
            </figcaption>
            <canvas
              ref={(element) => {
                canvases.current[index] = element;
              }}
              role="img"
              aria-label={`Held-out grid under ${controllerLabel(id)}`}
            />
          </figure>
        ))}
      </div>
      <div className="grid-demo-bar">
        <button type="button" className="control-button" onClick={() => setRunning(!running)}>
          {running ? "Stop" : "Run the held-out grid"}
        </button>
        {running && (
          <span>
            {minutes} of 30 simulated minutes at {SPEED}× · seed {SEED} · blue moving, red stopped,
            amber buses
          </span>
        )}
      </div>
      {published && (
        <p className="grid-demo-note">
          Published on 20 held-out seeds: on this grid CHOWK showed{" "}
          {published.clear ? "a" : "no clear"} difference in delay per person versus area
          max-pressure ({signedPercent(published.relDiff)}, 95% CI {signedPercent(published.ciLow)}{" "}
          to {signedPercent(published.ciHigh)}). One seed here is an illustration, not that result.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
