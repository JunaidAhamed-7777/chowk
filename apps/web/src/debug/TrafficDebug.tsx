import { corridor, DT, SNAPSHOT_STRIDE, VEHICLE_CLASSES } from "@chowk/sim";
import { useCallback, useEffect, useRef, useState } from "react";
import { district } from "../scene/corridorGeometry";
import { liveDuration, liveSeed } from "../sim/liveScenario";
import type { FromSim, FromSimFrame, ToSim } from "../sim/protocol";
import "./debug.css";

const palette = ["#4de3ba", "#efb553", "#c5d6f0", "#6b9cf8", "#de8fe1", "#ff7585"];
const maxTick = Math.round(liveDuration / DT);
const canvasWidth = 1280;
const canvasHeight = 540;
const boundsX = corridor.nodes.map(({ x }) => x);
const boundsZ = corridor.nodes.map(({ z }) => z);
const overview = {
  x: (Math.min(...boundsX) + Math.max(...boundsX)) / 2,
  z: (Math.min(...boundsZ) + Math.max(...boundsZ)) / 2,
};

function draw(canvas: HTMLCanvasElement, frame: FromSimFrame, junctionId: number | undefined) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const selected = junctionId === undefined ? undefined : corridor.junctions[junctionId];
  const center = selected ? corridor.nodes[selected.node] : overview;
  const scale = selected ? 3.1 : 0.5;

  context.resetTransform();
  context.fillStyle = "#080e1a";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.translate(canvas.width / 2, canvas.height / 2);
  context.scale(scale, scale);
  context.translate(-center.x, -center.z);

  context.fillStyle = "#293449";
  for (const { x, z, yaw, width, depth } of district.asphalt) {
    context.save();
    context.translate(x, z);
    context.rotate(-yaw);
    context.fillRect(-width / 2, -depth / 2, width, depth);
    context.restore();
  }

  const vehicles = new Float32Array(frame.vehicles);
  for (let offset = 0; offset < frame.count * SNAPSHOT_STRIDE; offset += SNAPSHOT_STRIDE) {
    const cls = vehicles[offset + 5];
    const { length, width } = VEHICLE_CLASSES[cls];
    const x = vehicles[offset];
    const z = vehicles[offset + 1];
    const dirX = vehicles[offset + 2];
    const dirZ = vehicles[offset + 3];
    context.save();
    context.transform(dirX, dirZ, -dirZ, dirX, x, z);
    context.fillStyle = palette[cls];
    context.fillRect(-length / 2, -width / 2, length, width);
    context.restore();
  }

  const marker = 3 / scale;
  context.font = `${13 / scale}px system-ui`;
  for (const junction of corridor.junctions) {
    const node = corridor.nodes[junction.node];
    context.fillStyle = "#e2eaf5";
    context.fillText(`J${junction.id + 1}`, node.x + 18 / scale, node.z - 18 / scale);
    const phase = junction.phases[frame.signals[2 * junction.id]];
    const stage = frame.signals[2 * junction.id + 1];
    for (const approach of junction.approaches) {
      const link = corridor.links[approach];
      const x = link.origin[0] + link.dir[0] * link.length - link.left[0];
      const z = link.origin[1] + link.dir[1] * link.length - link.left[1];
      context.fillStyle =
        phase?.approaches.includes(approach) && stage !== 2
          ? ["#47efbd", "#ffbd66"][stage]
          : "#ff6575";
      context.beginPath();
      context.arc(x, z, marker, 0, 2 * Math.PI);
      context.fill();
    }
  }
}

export default function TrafficDebug() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const current = useRef<FromSimFrame | undefined>(undefined);
  const worker = useRef<Worker | undefined>(undefined);
  const advancing = useRef(false);
  const selected = useRef<number | undefined>(undefined);
  const [playing, setPlaying] = useState(false);
  const [view, setView] = useState<number | undefined>();
  const [frame, setFrame] = useState<Pick<FromSimFrame, "tick" | "count" | "metrics">>();
  const [error, setError] = useState("");

  useEffect(() => {
    const source = new Worker(new URL("../workers/sim.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.current = source;
    source.onmessage = ({ data }: MessageEvent<FromSim>) => {
      advancing.current = false;
      if (data.type === "error") {
        setError(data.message);
        setPlaying(false);
        return;
      }
      const old = current.current;
      if (old) {
        const message: ToSim = { type: "recycle", buffer: old.vehicles };
        source.postMessage(message, [old.vehicles]);
      }
      current.current = data;
      if (canvas.current) draw(canvas.current, data, selected.current);
      setFrame({ tick: data.tick, count: data.count, metrics: data.metrics });
      if (data.tick === maxTick) setPlaying(false);
    };
    source.onerror = (event) => {
      setError(event.message || "Simulation worker stopped.");
      setPlaying(false);
    };
    const init: ToSim = { type: "init", seed: liveSeed, maxVehicles: 3000 };
    source.postMessage(init);
    return () => {
      source.terminate();
      worker.current = undefined;
      current.current = undefined;
      advancing.current = false;
    };
  }, []);

  const step = useCallback((count: number) => {
    if (!worker.current || !current.current || advancing.current || current.current.tick >= maxTick)
      return;
    advancing.current = true;
    const message: ToSim = {
      type: "advanceTo",
      tick: Math.min(maxTick, current.current.tick + count),
    };
    worker.current.postMessage(message);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => step(1), DT * 1000);
    return () => window.clearInterval(timer);
  }, [playing, step]);

  function focus(junction: number | undefined) {
    selected.current = junction;
    setView(junction);
    if (canvas.current && current.current) draw(canvas.current, current.current, junction);
  }

  const controlsDisabled = !frame || Boolean(error) || frame.tick >= maxTick;
  return (
    <main className="traffic-debug">
      <header>
        <a href="/">← Live</a>
        <h1>Corridor debug view</h1>
        <p>Fixed-cycle signal control · Development demand · Seed {liveSeed}</p>
      </header>
      {error && <p role="alert">{error}</p>}
      <canvas
        ref={canvas}
        width={canvasWidth}
        height={canvasHeight}
        aria-label="Top-down traffic and signal positions"
      >
        Top-down traffic and signal positions.
      </canvas>
      <div className="debug-controls">
        <button type="button" onClick={() => setPlaying(!playing)} disabled={controlsDisabled}>
          {playing ? "Pause" : "Play"}
        </button>
        <button type="button" onClick={() => step(1)} disabled={controlsDisabled || playing}>
          Step 1 tick
        </button>
        <button type="button" onClick={() => step(20)} disabled={controlsDisabled || playing}>
          Step 5 seconds
        </button>
        <label>
          Camera{" "}
          <select
            value={view ?? "all"}
            onChange={(event) =>
              focus(event.target.value === "all" ? undefined : Number(event.target.value))
            }
          >
            <option value="all">Whole corridor</option>
            {corridor.junctions.map(({ id }) => (
              <option key={id} value={id}>
                Junction J{id + 1}
              </option>
            ))}
          </select>
        </label>
      </div>
      {frame ? (
        <p className="debug-counters">
          Tick {frame.tick} · {(frame.tick * DT).toFixed(2)} s · {frame.count} active ·{" "}
          {frame.metrics.completed} completed · {frame.metrics.backlog} waiting to enter
        </p>
      ) : (
        <p role="status">Warming up the simulator…</p>
      )}
      <ul className="debug-legend" aria-label="Vehicle classes">
        {VEHICLE_CLASSES.map(({ id }, cls) => (
          <li key={id}>
            <span style={{ backgroundColor: palette[cls] }} />
            {id.replaceAll("_", " ")}
          </li>
        ))}
      </ul>
    </main>
  );
}
