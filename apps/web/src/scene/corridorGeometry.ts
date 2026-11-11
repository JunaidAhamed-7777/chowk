import { corridor } from "@chowk/sim";

export interface Box {
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  yaw: number;
  color: string;
}

interface Lamp {
  x: number;
  z: number;
  radius: number;
}

export const junctions = corridor.junctions.map((junction, index) => {
  const node = corridor.nodes.find((entry) => entry.id === junction.node);
  if (!node) throw new Error(`Junction ${junction.id} is missing its node`);
  return { id: junction.id, label: `J${index + 1}`, x: node.x, z: node.z };
});

function box(
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  depth: number,
  color: string,
  yaw = 0,
): Box {
  return { x, y, z, width, height, depth, yaw, color };
}

export function unit(index: number, salt = 0) {
  let value = Math.imul(index + salt * 1433 + 71, 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

const asphalt: Box[] = [];
const furniture: Box[] = [];
const markings: Box[] = [];
const buildings: Box[] = [];
const lights: Box[] = [];
const pools: Lamp[] = [];
const signs: Box[] = [];
const signalMounts: {
  x: number;
  z: number;
  yaw: number;
  junction: number;
  approach: number;
  approachCount: number;
}[] = [];

const linkRects = corridor.links.map((link) => {
  const { dir, left, origin, length } = link;
  const width = link.strips * corridor.stripWidth;
  const yaw = -Math.atan2(dir[1], dir[0]);
  const center = (along: number, lateral: number) =>
    [
      origin[0] + dir[0] * along - left[0] * lateral,
      origin[1] + dir[1] * along - left[1] * lateral,
    ] as const;
  const [x, z] = center(length / 2, width / 2);
  asphalt.push(box(x, -0.32, z, length, 0.5, width, "#12161f", yaw));
  for (const [offset, curbWidth, color] of [
    [-0.98, 2, "#28313c"],
    [width + 0.3, 0.62, "#343943"],
  ] as const) {
    const [cx, cz] = center(length / 2, offset);
    furniture.push(box(cx, -0.22, cz, length, 0.43, curbWidth, color, yaw));
  }
  const [edgex, edgez] = center(length / 2, 0.26);
  markings.push(box(edgex, -0.059, edgez, length - 4, 0.012, 0.09, "#666d74", yaw));

  const endJunction = corridor.junctions.find((entry) => entry.node === link.to);
  if (endJunction) {
    const [sx, sz] = center(length - 3.8, width * 0.5);
    markings.push(box(sx, -0.054, sz, 0.28, 0.016, width - 0.45, "#8a8e8e", yaw));
    for (let i = 0.6; i < width - 0.35; i += 0.92) {
      const [px, pz] = center(length - 1.75, i);
      markings.push(box(px, -0.052, pz, 2.1, 0.017, 0.46, "#777f82", yaw));
    }
    const [px, pz] = center(length - 1.7, -0.62);
    furniture.push(box(px, 2.35, pz, 0.22, 5.4, 0.22, "#51616a"));
    const [ax, az] = center(length - 1.7, width * 0.28);
    furniture.push(box(ax, 5, az, 0.2, 0.2, width * 0.57 + 1.2, "#4d5a64", yaw));
    const [hx, hz] = center(length - 2.08, width * 0.58);
    furniture.push(box(hx, 4.55, hz, 0.42, 1.23, 0.5, "#202a30", yaw));
    signalMounts.push({
      x: hx - dir[0] * 0.24,
      z: hz - dir[1] * 0.24,
      yaw,
      junction: endJunction.id,
      approach: endJunction.approaches.indexOf(link.id),
      approachCount: endJunction.approaches.length,
    });
  }

  const pitch = width > 8 ? 29 : 37;
  for (let distance = 11; distance < length - 12; distance += pitch) {
    const [lx, lz] = center(distance, -0.93);
    const [hx, hz] = center(distance, 1.75);
    const [poolX, poolZ] = center(distance, 4);
    furniture.push(box(lx, 3.35, lz, 0.17, 7.1, 0.17, "#526070"));
    furniture.push(box((lx + hx) / 2, 6.86, (lz + hz) / 2, 0.14, 0.16, 2.8, "#526070", yaw));
    lights.push(box(hx, 6.8, hz, 0.33, 0.15, 0.67, "#ffb057", yaw));
    pools.push({ x: poolX, z: poolZ, radius: width > 8 ? 14 : 10 });
  }

  const boundsX = (Math.abs(dir[0]) * length) / 2 + (Math.abs(left[0]) * width) / 2;
  const boundsZ = (Math.abs(dir[1]) * length) / 2 + (Math.abs(left[1]) * width) / 2;
  return { x, z, boundsX, boundsZ };
});

for (const junction of junctions) {
  const networkJunction = corridor.junctions.find((entry) => entry.id === junction.id);
  if (!networkJunction) continue;
  let extentX = 0;
  let extentZ = 0;
  for (const link of corridor.links) {
    if (link.to !== networkJunction.node && link.from !== networkJunction.node) continue;
    const along = link.to === networkJunction.node ? link.length : 0;
    const width = link.strips * corridor.stripWidth;
    for (const lateral of [0, width]) {
      extentX = Math.max(
        extentX,
        Math.abs(link.origin[0] + link.dir[0] * along - link.left[0] * lateral - junction.x),
      );
      extentZ = Math.max(
        extentZ,
        Math.abs(link.origin[1] + link.dir[1] * along - link.left[1] * lateral - junction.z),
      );
    }
  }
  asphalt.push(box(junction.x, -0.335, junction.z, extentX * 2, 0.5, extentZ * 2, "#161b25"));
}

const buildingColors = ["#222e40", "#273749", "#262f3a", "#303948", "#2a3241", "#232f42"];
const signColors = ["#ffe0a3", "#7dceef", "#f1875d", "#ed8aa5", "#7ab9b6"];

let lot = 0;
for (let z = -640; z <= 670; z += 27) {
  for (let x = -520; x <= 2400; x += 31) {
    lot += 1;
    if (unit(lot, 1) < 0.17) continue;
    const cx = x + (unit(lot, 2) - 0.5) * 12;
    const cz = z + (unit(lot, 3) - 0.5) * 9;
    const width = 12 + unit(lot, 4) * 13;
    const depth = 11 + unit(lot, 5) * 12;
    let frontage = Number.POSITIVE_INFINITY;
    for (const road of linkRects) {
      const dx = Math.max(Math.abs(cx - road.x) - road.boundsX - width / 2, 0);
      const dz = Math.max(Math.abs(cz - road.z) - road.boundsZ - depth / 2, 0);
      frontage = Math.min(frontage, Math.hypot(dx, dz));
    }
    if (
      frontage < 5 ||
      junctions.some(
        (junction) =>
          Math.abs(cx - junction.x) < 21 + width / 2 && Math.abs(cz - junction.z) < 21 + depth / 2,
      )
    )
      continue;

    const nearRoad = frontage < 20;
    const height = nearRoad ? 5.7 + unit(lot, 6) * 15 : 8 + unit(lot, 6) ** 2.8 * 60;
    const color = buildingColors[Math.floor(unit(lot, 7) * buildingColors.length)] ?? "#252d3c";
    buildings.push(box(cx, height / 2 - 0.42, cz, width, height, depth, color));
    if (unit(lot, 8) > 0.52) {
      buildings.push(
        box(
          cx - width * 0.21,
          height + 1.0,
          cz - depth * 0.15,
          width * 0.38,
          2.9,
          depth * 0.37,
          color,
        ),
      );
    }
    if (nearRoad && unit(lot, 9) > 0.25) {
      const signColor = signColors[Math.floor(unit(lot, 10) * signColors.length)] ?? "#ffe0a3";
      const facing = cz < 0 ? 1 : -1;
      signs.push(
        box(cx, 3.6, cz + facing * (depth / 2 + 0.1), width * 0.65, 0.82, 0.25, signColor),
      );
      pools.push({ x: cx, z: cz + facing * (depth / 2 + 1.4), radius: 5.4 });
    }
  }
}

export const district = {
  asphalt,
  furniture,
  markings,
  buildings,
  lights,
  pools,
  signs,
  signalMounts,
};
