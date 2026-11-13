import { corridor, DT, SNAPSHOT_STRIDE, STOPPED_FLAG, VEHICLE_CLASSES } from "@chowk/sim";
import { type RefObject, useEffect, useRef } from "react";
import { type ActiveEvent, eventPoint } from "../sim/liveEvents";
import { fadeMs, type SimHost, type SnapshotStream } from "../sim/SimHost";
import { district } from "./corridorGeometry";
import {
  type CameraSelection,
  type OverlayMode,
  peopleColors,
  peopleMetresPerRootPerson,
  speedBand,
  speedBands,
  type VehicleFollow,
} from "./sceneSettings";

const colours = ["#72ccbe", "#c8ac68", "#bcc9df", "#7c9bd2", "#c398cf", "#82b3ff"];
const states = ["#47efbd", "#ffbd66", "#ff6575"];
const nodesX = corridor.nodes.map(({ x }) => x);
const nodesZ = corridor.nodes.map(({ z }) => z);
const minX = Math.min(...nodesX);
const maxX = Math.max(...nodesX);
const minZ = Math.min(...nodesZ);
const maxZ = Math.max(...nodesZ);
const centreX = (minX + maxX) / 2;
const centreZ = (minZ + maxZ) / 2;

interface Options {
  active: boolean;
  host: RefObject<SimHost | null>;
  camera: CameraSelection;
  vehicle?: VehicleFollow;
  wipe: number;
  singleView: boolean;
  overlay: OverlayMode;
  events: readonly ActiveEvent[];
  tick: number;
  paused: boolean;
  speed: number;
  onRoadPick: (x: number, z: number, screenX: number) => void;
}

function drawRoads(context: CanvasRenderingContext2D) {
  for (const box of district.asphalt) {
    context.save();
    context.translate(box.x, box.z);
    context.rotate(-box.yaw);
    context.fillStyle = "#252c3b";
    context.fillRect(-box.width / 2, -box.depth / 2, box.width, box.depth);
    context.restore();
  }
}

function drawPressure(context: CanvasRenderingContext2D, stream: SnapshotStream) {
  const sense = stream.current?.sense;
  if (!sense) return;
  for (const { id, approaches } of corridor.junctions) {
    for (let index = 0; index < approaches.length; index++) {
      const link = corridor.links[approaches[index]];
      const zones = sense[id].approaches[index];
      const depth = link.strips * corridor.stripWidth;
      context.save();
      context.translate(link.origin[0], link.origin[1]);
      context.rotate(Math.atan2(link.dir[1], link.dir[0]));
      for (let zone = 0; zone < 3; zone++) {
        const near = zone === 0 ? 0 : zone === 1 ? 60 : 150;
        const far = zone === 0 ? 60 : zone === 1 ? 150 : 300;
        const value = zone === 0 ? zones.areaNear : zone === 1 ? zones.areaMid : zones.areaFar;
        const length = Math.max(0, Math.min(link.length, far) - near);
        context.fillStyle = value > 0.3 ? "#f05da8" : "#efab59";
        context.globalAlpha = Math.min(0.62, value * 1.6 + 0.04);
        context.fillRect(Math.max(0, link.length - far), 0, length, depth);
      }
      context.restore();
    }
  }
}

function drawTraffic(
  context: CanvasRenderingContext2D,
  stream: SnapshotStream,
  time: number,
  scale: number,
  options: Options,
) {
  const snapshot = stream.current;
  if (!snapshot) return;
  if (options.overlay === "pressure") drawPressure(context, stream);
  const previous = stream.previous;
  const age = time - stream.receivedAt;
  const period = ((snapshot.tick - (previous?.tick ?? snapshot.tick)) * DT * 1000) / options.speed;
  const mix = !previous || options.paused ? 1 : Math.min(1, age / Math.max(1, period));
  const positions = snapshot.positions;
  for (let index = 0; index < snapshot.count * SNAPSHOT_STRIDE; index += SNAPSHOT_STRIDE) {
    const cls = positions[index + 5];
    const { length, width, occupancy } = VEHICLE_CLASSES[cls];
    const id = positions[index + 6];
    let x = positions[index];
    let z = positions[index + 1];
    const older = previous?.index.get(id);
    if (previous && older !== undefined && mix < 1) {
      x = previous.positions[older] + mix * (x - previous.positions[older]);
      z = previous.positions[older + 1] + mix * (z - previous.positions[older + 1]);
    }
    const dx = positions[index + 2];
    const dz = positions[index + 3];
    const born = stream.births.get(id);
    const fade = born === undefined ? 1 : Math.min(1, (time - born) / fadeMs);
    const stopped = (positions[index + 7] & STOPPED_FLAG) !== 0;
    context.save();
    context.translate(x, z);
    context.transform(dx, dz, -dz, dx, 0, 0);
    context.globalAlpha = fade;
    context.fillStyle =
      options.overlay === "speed"
        ? speedBands[speedBand(positions[index + 4])].color
        : colours[cls];
    context.fillRect(-length / 2, -width / 2, length, Math.max(width, 1.4 / scale));
    const lamp = Math.max(0.35, 0.6 / scale);
    context.fillStyle = cls === 5 ? "#8fbdff" : "#fff1d7";
    context.fillRect(length / 2, -lamp / 2, lamp, lamp);
    context.fillStyle = stopped ? "#ff6575" : "#b94652";
    context.fillRect(-length / 2 - lamp, -lamp / 2, lamp, lamp);
    if (options.overlay === "people" && occupancy > 0) {
      // The same marker as the 3D view: area grows with the people on board.
      context.beginPath();
      context.arc(0, 0, (peopleMetresPerRootPerson * Math.sqrt(occupancy)) / 2, 0, Math.PI * 2);
      context.globalAlpha = fade * 0.85;
      context.fillStyle = stopped ? peopleColors.waiting : peopleColors.moving;
      context.fill();
    }
    context.restore();
  }

  const marker = Math.max(1.2, 2.4 / scale);
  for (const junction of corridor.junctions) {
    const phase = junction.phases[snapshot.signals[2 * junction.id]];
    const stage = snapshot.signals[2 * junction.id + 1];
    for (const approach of junction.approaches) {
      const link = corridor.links[approach];
      const x = link.origin[0] + link.dir[0] * link.length - link.left[0];
      const z = link.origin[1] + link.dir[1] * link.length - link.left[1];
      context.fillStyle = phase?.approaches.includes(approach) ? states[stage] : states[2];
      context.beginPath();
      context.arc(x, z, marker, 0, 2 * Math.PI);
      context.fill();
    }
  }
}

export function TopDownCorridor(options: Options) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef(options);
  const { active } = options;
  useEffect(() => {
    latest.current = options;
  }, [options]);

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!active || !element || !context) return;
    let x = centreX;
    let z = centreZ;
    let scale = 1;
    let animation: number;
    let previousTime = -Infinity;
    const resize = () => {
      const ratio = Math.min(1.25, window.devicePixelRatio);
      element.width = Math.max(1, Math.round(element.clientWidth * ratio));
      element.height = Math.max(1, Math.round(element.clientHeight * ratio));
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    const click = (event: MouseEvent) => {
      const bounds = element.getBoundingClientRect();
      const dx = (event.clientX - bounds.left) * (element.width / bounds.width) - element.width / 2;
      const dz =
        (event.clientY - bounds.top) * (element.height / bounds.height) - element.height / 2;
      latest.current.onRoadPick(x + dx / scale, z + dz / scale, event.clientX);
    };
    element.addEventListener("click", click);

    const paint = (time: number) => {
      animation = requestAnimationFrame(paint);
      if (document.hidden || time - previousTime < 32) return;
      previousTime = time;
      const current = latest.current;
      const width = element.width;
      const height = element.height;
      const station =
        typeof current.camera === "number" ? corridor.junctions[current.camera] : undefined;
      const node = station && corridor.nodes[station.node];
      x = node?.x ?? centreX;
      z = node?.z ?? centreZ;
      scale = station
        ? Math.min(width / 450, height / 300)
        : Math.min(width / (maxX - minX + 90), height / (maxZ - minZ + 140));
      const pair = current.host.current?.streams;
      if (current.camera === "ride" || current.camera === "ambulance") {
        const snapshot = pair?.[current.vehicle?.side ?? 1].current;
        if (snapshot) {
          let offset = current.vehicle ? snapshot.index.get(current.vehicle.id) : undefined;
          if (offset === undefined) {
            const cls = current.camera === "ambulance" ? 5 : 0;
            for (
              let index = 0;
              index < snapshot.count * SNAPSHOT_STRIDE;
              index += SNAPSHOT_STRIDE
            ) {
              if (snapshot.positions[index + 5] !== cls) continue;
              offset = index;
              break;
            }
          }
          if (offset !== undefined) {
            x = snapshot.positions[offset];
            z = snapshot.positions[offset + 1];
            scale = Math.min(width / 380, height / 270);
          }
        }
      }
      context.resetTransform();
      context.fillStyle = "#0a0f1a";
      context.fillRect(0, 0, width, height);
      context.setTransform(scale, 0, 0, scale, width / 2 - x * scale, height / 2 - z * scale);
      drawRoads(context);
      if (pair) {
        const split = current.singleView ? 0 : (width * current.wipe) / 100;
        for (const side of [0, 1] as const) {
          if (side === 0 && split === 0) continue;
          context.save();
          context.resetTransform();
          context.beginPath();
          context.rect(side === 0 ? 0 : split, 0, side === 0 ? split : width - split, height);
          context.clip();
          context.setTransform(scale, 0, 0, scale, width / 2 - x * scale, height / 2 - z * scale);
          drawTraffic(context, pair[side], time, scale, current);
          context.restore();
        }
      }
      context.font = `${12 / scale}px system-ui`;
      for (const { id, node } of corridor.junctions) {
        const station = corridor.nodes[node];
        context.fillStyle = "#dce4f0";
        context.fillText(`J${id + 1}`, station.x + 15 / scale, station.z - 15 / scale);
      }
      for (const { tick, event } of current.events) {
        if (
          current.tick < tick ||
          current.tick - tick >= ("duration" in event ? event.duration : 20) / DT
        )
          continue;
        const [eventX, eventZ] = eventPoint(event);
        context.strokeStyle = "#ffbd79";
        context.lineWidth = 1.7 / scale;
        context.beginPath();
        context.arc(eventX, eventZ, 7 / scale, 0, 2 * Math.PI);
        context.stroke();
      }
    };
    animation = requestAnimationFrame(paint);
    return () => {
      cancelAnimationFrame(animation);
      observer.disconnect();
      element.removeEventListener("click", click);
    };
  }, [active]);

  return (
    <canvas
      className="top-down-corridor"
      ref={canvas}
      role="img"
      aria-label="Top-down corridor simulation"
    >
      Top-down traffic and signal positions.
    </canvas>
  );
}
