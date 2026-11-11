import {
  previewGreen,
  previewPhase,
  previewVehicles,
  previewYellow,
} from "../scene/previewVehicles";
import type { PlaybackSpeed } from "../scene/sceneSettings";
import { snapshotInterval } from "../scene/sceneSettings";

interface WorkerMessage {
  running?: boolean;
  speed?: PlaybackSpeed;
  recycle?: ArrayBuffer;
}

export interface PreviewFrame {
  positions: ArrayBuffer;
  time: number;
}

const pool = Array.from(
  { length: 3 },
  () => new ArrayBuffer(previewVehicles.length * Float32Array.BYTES_PER_ELEMENT),
);
let speed: PlaybackSpeed = 1;
let running = false;
let time = 0;
let wallTime = performance.now();
let timer: ReturnType<typeof setInterval> | undefined;

function advance(now: number) {
  if (running) time += ((now - wallTime) * speed) / 1000;
  wallTime = now;
}

function publish() {
  const buffer = pool.pop();
  if (!buffer) return;
  const positions = new Float32Array(buffer);
  for (let i = 0; i < previewVehicles.length; i += 1) {
    const vehicle = previewVehicles[i];
    const crossing = vehicle.crossing;
    if (crossing) {
      const phase = previewPhase(time, crossing.junction);
      const phaseStart = Math.floor(phase);
      const phaseTime = (phase - phaseStart) * (previewGreen + previewYellow + 1);
      const position = (phaseTime - vehicle.offset) * vehicle.speed;
      positions[i] =
        phaseStart % crossing.approachCount === crossing.approach &&
        position >= 0 &&
        position <= vehicle.length
          ? position
          : -1;
    } else {
      positions[i] = (vehicle.offset + time * vehicle.speed) % vehicle.length;
    }
  }
  const frame: PreviewFrame = { positions: buffer, time };
  self.postMessage(frame, { transfer: [buffer] });
}

self.onmessage = ({ data }: MessageEvent<WorkerMessage>) => {
  if (data.recycle) {
    pool.push(data.recycle);
    return;
  }
  advance(performance.now());
  running = data.running ?? running;
  speed = data.speed ?? speed;
  if (running && timer === undefined) {
    timer = setInterval(() => {
      advance(performance.now());
      publish();
    }, snapshotInterval);
  } else if (!running && timer !== undefined) {
    clearInterval(timer);
    timer = undefined;
  }
  publish();
};
