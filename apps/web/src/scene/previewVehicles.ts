import { corridor } from "@chowk/sim";
import { previewCapacity } from "./sceneSettings";

const types = [
  { length: 1.9, width: 0.7, height: 1.02, roof: 0.28, color: "#576676" },
  { length: 3.2, width: 1.4, height: 1.78, roof: 0.6, color: "#5d7462" },
  { length: 4.2, width: 1.7, height: 1.52, roof: 0.58, color: "#768399" },
  { length: 5.5, width: 2, height: 2.35, roof: 0.63, color: "#c4b8a0" },
  { length: 11, width: 2.5, height: 3.12, roof: 0.89, color: "#9d7264" },
] as const;

interface PreviewVehicle {
  body: (typeof types)[number];
  startX: number;
  startZ: number;
  dirX: number;
  dirZ: number;
  leftX: number;
  leftZ: number;
  length: number;
  speed: number;
  offset: number;
  yaw: number;
  order: number;
  crossing?: { junction: number; approach: number; approachCount: number };
}

export const previewGreen = 17;
export const previewYellow = 3;
const previewPhaseDuration = previewGreen + previewYellow + 1;

export function previewPhase(time: number, junction: number) {
  return (time + junction * 7) / previewPhaseDuration;
}

function seededUnit(index: number, salt: number) {
  let value = Math.imul(index + salt * 1433 + 71, 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

// Each preview ribbon has a common speed and fixed headways. This stays
// entirely independent of demand, controllers and simulation results.
function makeVehicles() {
  const slots: PreviewVehicle[] = [];
  let slotId = 0;
  for (const link of corridor.links) {
    const width = link.strips * corridor.stripWidth;
    const ribbons = Math.floor(width / 2.2);
    const ribbonWidth = width / ribbons;
    for (let ribbon = 0; ribbon < ribbons; ribbon += 1) {
      const speed = link.speedLimit * (0.48 + 0.48 * seededUnit(link.id, ribbon));
      const pitch = 5.0 + 4.3 * seededUnit(link.id, ribbon + 20);
      const length = link.length - 13;
      const count = Math.floor(length / pitch);
      const phase = length * seededUnit(link.id, ribbon + 27);
      const lateral = ribbonWidth * (ribbon + 0.5);
      for (let index = 0; index < count; index += 1) {
        slotId += 1;
        const mix = seededUnit(slotId, 1);
        const body =
          mix < 0.48
            ? types[0]
            : mix < 0.62
              ? types[1]
              : mix < 0.94 || pitch < 5.8
                ? types[2]
                : mix < 0.982 || pitch < 8.9 || ribbonWidth < 2.6 || index % 3 !== 1
                  ? types[3]
                  : types[4];
        slots.push({
          body,
          startX: link.origin[0] - lateral * link.left[0] + 6.5 * link.dir[0],
          startZ: link.origin[1] - lateral * link.left[1] + 6.5 * link.dir[1],
          dirX: link.dir[0],
          dirZ: link.dir[1],
          leftX: link.left[0],
          leftZ: link.left[1],
          length,
          speed,
          offset: (phase + (index * length) / count) % length,
          yaw: Math.atan2(-link.dir[0], -link.dir[1]),
          order: seededUnit(slotId, 2),
        });
      }
    }
  }
  const crossings: PreviewVehicle[] = [];
  for (const connector of corridor.connectors) {
    if (connector.movement !== "through") continue;
    const from = corridor.links.find((entry) => entry.id === connector.fromLink);
    const to = corridor.links.find((entry) => entry.id === connector.toLink);
    const junction = corridor.junctions.find((entry) => entry.id === connector.junction);
    if (!from || !to || !junction) continue;

    const startX = from.origin[0] + from.length * from.dir[0];
    const startZ = from.origin[1] + from.length * from.dir[1];
    const width = Math.min(from.strips, to.strips) * corridor.stripWidth;
    const length = (to.origin[0] - startX) * from.dir[0] + (to.origin[1] - startZ) * from.dir[1];
    const crossing = {
      junction: junction.id,
      approach: junction.approaches.indexOf(from.id),
      approachCount: junction.approaches.length,
    };
    for (let ribbon = 0; ribbon < 3; ribbon += 1) {
      const lateral = (width * (ribbon + 0.5)) / 3;
      for (let index = 0; index < 5; index += 1) {
        crossings.push({
          body: types[(index + ribbon) % 3],
          startX: startX - lateral * from.left[0],
          startZ: startZ - lateral * from.left[1],
          dirX: from.dir[0],
          dirZ: from.dir[1],
          leftX: from.left[0],
          leftZ: from.left[1],
          length,
          speed: from.speedLimit * 0.72,
          offset: index * 2.5 + ribbon * 0.64,
          yaw: Math.atan2(-from.dir[0], -from.dir[1]),
          order: 0,
          crossing,
        });
      }
    }
  }

  slots.sort((a, b) => a.order - b.order);
  return crossings.concat(slots).slice(0, previewCapacity);
}

export const previewVehicles = makeVehicles();
