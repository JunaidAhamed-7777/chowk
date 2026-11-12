import { corridor, DT, SNAPSHOT_STRIDE } from "@chowk/sim";
import { type RefObject, useEffect, useRef } from "react";
import type { SimHost, SimulationSide } from "../sim/SimHost";
import "./timeSpace.css";

// A rolling time-space diagram of the arterial: one dot per vehicle per simulated second,
// eastbound and westbound in separate colours, with each junction's green for that
// direction drawn as a bar at its position. Buffers are allocated once.
const WINDOW_SECONDS = 300;
const MAX_POINTS = 900;
const ARTERIAL_HALF_WIDTH = 12;
const SAMPLE_TICKS = Math.round(1 / DT);
const DRAW_INTERVAL_MS = 250;

const junctionNodes = corridor.junctions.map(({ node }) => corridor.nodes[node]);
const corridorStart = Math.min(...corridor.nodes.map(({ x }) => x));
const corridorEnd = Math.max(...corridor.nodes.map(({ x }) => x));

/** Phase index serving each arterial direction at each junction, or -1. */
const directionalPhase = corridor.junctions.map((junction) =>
  [1, -1].map((sign) =>
    junction.phases.findIndex(({ approaches }) =>
      approaches.some((link) => corridor.links[link].dir[0] * sign > 0.9),
    ),
  ),
);

interface Trace {
  ticks: Float64Array;
  counts: Uint16Array;
  x: Float32Array;
  east: Uint8Array;
  green: Uint8Array;
  head: number;
  filled: number;
  lastTick: number;
}

function createTrace(): Trace {
  return {
    ticks: new Float64Array(WINDOW_SECONDS),
    counts: new Uint16Array(WINDOW_SECONDS),
    x: new Float32Array(WINDOW_SECONDS * MAX_POINTS),
    east: new Uint8Array(WINDOW_SECONDS * MAX_POINTS),
    green: new Uint8Array(WINDOW_SECONDS * corridor.junctions.length * 2),
    head: 0,
    filled: 0,
    lastTick: -Infinity,
  };
}

function sample(trace: Trace, host: SimHost, side: SimulationSide) {
  const snapshot = host.streams[side].current;
  if (!snapshot) return;
  if (snapshot.tick < trace.lastTick) {
    trace.head = 0;
    trace.filled = 0;
    trace.lastTick = -Infinity;
  }
  if (snapshot.tick - trace.lastTick < SAMPLE_TICKS) return;
  trace.lastTick = snapshot.tick;
  const row = trace.head;
  const base = row * MAX_POINTS;
  const { positions, count, signals } = snapshot;
  let points = 0;
  for (
    let offset = 0;
    offset < count * SNAPSHOT_STRIDE && points < MAX_POINTS;
    offset += SNAPSHOT_STRIDE
  ) {
    const dx = positions[offset + 2];
    if (Math.abs(positions[offset + 1]) > ARTERIAL_HALF_WIDTH || Math.abs(dx) < 0.9) continue;
    trace.x[base + points] = positions[offset];
    trace.east[base + points] = dx > 0 ? 1 : 0;
    points++;
  }
  trace.counts[row] = points;
  trace.ticks[row] = snapshot.tick;
  const junctions = corridor.junctions.length;
  for (let junction = 0; junction < junctions; junction++) {
    const phase = signals[2 * junction];
    const green = signals[2 * junction + 1] === 0;
    for (let direction = 0; direction < 2; direction++) {
      trace.green[(row * junctions + junction) * 2 + direction] =
        green && directionalPhase[junction][direction] === phase ? 1 : 0;
    }
  }
  trace.head = (row + 1) % WINDOW_SECONDS;
  trace.filled = Math.min(WINDOW_SECONDS, trace.filled + 1);
}

function draw(canvas: HTMLCanvasElement, trace: Trace, colors: Palette) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
  }
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  if (trace.filled === 0) return;
  const latest = trace.ticks[(trace.head + WINDOW_SECONDS - 1) % WINDOW_SECONDS];
  const timeX = (tick: number) => width - ((latest - tick) * DT * width) / WINDOW_SECONDS;
  const spaceY = (x: number) =>
    height - ((x - corridorStart) / (corridorEnd - corridorStart)) * height;
  const junctions = corridor.junctions.length;
  const column = Math.max(1.5, width / WINDOW_SECONDS);

  for (let junction = 0; junction < junctions; junction++) {
    const y = spaceY(junctionNodes[junction].x);
    context.fillStyle = colors.grid;
    context.fillRect(0, y - 0.5, width, 1);
    for (let index = 0; index < trace.filled; index++) {
      const row = (trace.head + WINDOW_SECONDS - trace.filled + index) % WINDOW_SECONDS;
      const x = timeX(trace.ticks[row]);
      for (let direction = 0; direction < 2; direction++) {
        const green = trace.green[(row * junctions + junction) * 2 + direction] === 1;
        context.fillStyle = green ? colors.green : colors.red;
        context.fillRect(x - column, y + (direction === 0 ? 1.5 : -4.5), column, 3);
      }
    }
  }

  for (let index = 0; index < trace.filled; index++) {
    const row = (trace.head + WINDOW_SECONDS - trace.filled + index) % WINDOW_SECONDS;
    const x = timeX(trace.ticks[row]);
    const base = row * MAX_POINTS;
    for (let point = 0; point < trace.counts[row]; point++) {
      context.fillStyle = trace.east[base + point] === 1 ? colors.east : colors.west;
      context.fillRect(x - 1, spaceY(trace.x[base + point]) - 1, 2, 2);
    }
  }
}

interface Palette {
  east: string;
  west: string;
  green: string;
  red: string;
  grid: string;
}

function palette(element: Element): Palette {
  const style = getComputedStyle(element);
  const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    east: read("--ts-east", "#7dd3fc"),
    west: read("--ts-west", "#fbbf24"),
    green: read("--ts-green", "#34d399"),
    red: read("--ts-red", "#f8717166"),
    grid: read("--ts-grid", "#ffffff1f"),
  };
}

export function TimeSpacePanel({
  host,
  labels,
  onClose,
}: {
  host: RefObject<SimHost | null>;
  labels: readonly [string, string];
  onClose: () => void;
}) {
  const canvases = useRef<(HTMLCanvasElement | null)[]>([null, null]);
  const traces = useRef<[Trace, Trace]>([createTrace(), createTrace()]);

  useEffect(() => {
    let request = 0;
    let lastDraw = 0;
    const colors = canvases.current[0] ? palette(canvases.current[0]) : undefined;
    const frame = (now: number) => {
      const current = host.current;
      if (current) {
        sample(traces.current[0], current, 0);
        sample(traces.current[1], current, 1);
      }
      if (colors && now - lastDraw > DRAW_INTERVAL_MS) {
        lastDraw = now;
        for (let side = 0; side < 2; side++) {
          const canvas = canvases.current[side];
          if (canvas) draw(canvas, traces.current[side], colors);
        }
      }
      request = requestAnimationFrame(frame);
    };
    request = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(request);
  }, [host]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);

  return (
    <section className="time-space-panel" aria-label="Time-space diagram">
      <header className="time-space-header">
        <div>
          <h2>Time-space diagram</h2>
          <p>
            Every vehicle on the main road, once per simulated second, over the last five minutes.
            Flat runs are queues; steady slopes are moving platoons.
          </p>
        </div>
        <button type="button" className="time-space-close" onClick={onClose}>
          <span aria-hidden="true">×</span>
          <span className="sr-only">Close time-space diagram</span>
        </button>
      </header>
      {labels.map((label, side) => (
        <figure className="time-space-figure" key={label + side}>
          <figcaption>
            <span className="time-space-side">{side === 0 ? "A" : "B"}</span> {label}
          </figcaption>
          <div className="time-space-plot">
            <div className="time-space-axis" aria-hidden="true">
              {junctionNodes.map(({ x }, junction) => (
                <span
                  key={x}
                  style={{
                    bottom: `${((x - corridorStart) / (corridorEnd - corridorStart)) * 100}%`,
                  }}
                >
                  J{junction + 1}
                </span>
              ))}
            </div>
            <div className="time-space-canvas">
              <canvas
                ref={(element) => {
                  canvases.current[side] = element;
                }}
                role="img"
                aria-label={`Vehicle trajectories along the corridor under ${label}`}
              />
            </div>
          </div>
        </figure>
      ))}
      <footer className="time-space-legend">
        <span className="legend-east">Eastbound</span>
        <span className="legend-west">Westbound</span>
        <span className="legend-green">Green for that direction</span>
        <span className="time-space-time">← 5 min · now</span>
      </footer>
    </section>
  );
}
