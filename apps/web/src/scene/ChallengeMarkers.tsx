import { corridor } from "@chowk/sim";
import { useFrame } from "@react-three/fiber";
import { type RefObject, useEffect, useState } from "react";
import {
  CanvasTexture,
  LinearFilter,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector3,
} from "three";
import type { SimHost } from "../sim/SimHost";

const size = 96;
// Just upstream of the stop line and above the signal head: the junction view frames the box,
// so markers here stay clear of the panels that cover the far ends of the arms.
const setback = 4;
const height = 12;

type Lamp = 0 | 1 | 2;
const fills = ["#05070de8", "#2be38b", "#ffb347"] as const;
const rings = ["#c9d6e4", "#2be38b", "#ffb347"] as const;
const digits = ["#f4f7fb", "#04120d", "#1d1203"] as const;

interface Marker {
  canvas: HTMLCanvasElement;
  texture: CanvasTexture;
  sprite: Sprite;
  anchor: Vector3;
  phase: number;
  lamp: Lamp | -1;
}

function draw(marker: Marker, lamp: Lamp) {
  const context = marker.canvas.getContext("2d");
  if (!context) return;
  const centre = size / 2;
  context.clearRect(0, 0, size, size);
  context.beginPath();
  context.arc(centre, centre, centre - 6, 0, Math.PI * 2);
  context.fillStyle = fills[lamp];
  context.fill();
  context.lineWidth = 5;
  context.strokeStyle = rings[lamp];
  context.stroke();
  context.fillStyle = digits[lamp];
  context.font = "700 46px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(String(marker.phase + 1), centre, centre + 3);
  marker.texture.needsUpdate = true;
}

/**
 * Key numbers floating over each approach of the junction the visitor runs in Beat the AI.
 * They sit in the world, so they stay over the right road however the camera turns, and they
 * light with side A's signal so the visitor sees which arm has green.
 */
export function ChallengeMarkers({
  host,
  junction,
}: {
  host: RefObject<SimHost | null>;
  junction: number;
}) {
  const [markers] = useState<Marker[]>(() => {
    const { approaches, phases } = corridor.junctions[junction];
    return approaches.map((link) => {
      const road = corridor.links[link];
      const along = road.length - setback;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const texture = new CanvasTexture(canvas);
      texture.colorSpace = SRGBColorSpace;
      texture.minFilter = LinearFilter;
      texture.generateMipmaps = false;
      const sprite = new Sprite(
        new SpriteMaterial({
          map: texture,
          depthTest: false,
          depthWrite: false,
          transparent: true,
          toneMapped: false,
        }),
      );
      const anchor = new Vector3(
        road.origin[0] + road.dir[0] * along,
        height,
        road.origin[1] + road.dir[1] * along,
      );
      sprite.position.copy(anchor);
      sprite.renderOrder = 6;
      const phase = phases.findIndex(({ approaches: served }) => served.includes(link));
      return { canvas, texture, sprite, anchor, phase, lamp: -1 };
    });
  });

  useEffect(
    () => () => {
      for (const { sprite, texture } of markers) {
        sprite.material.dispose();
        texture.dispose();
      }
    },
    [markers],
  );

  useFrame(({ camera }) => {
    const signals = host.current?.streams[0].current?.signals;
    const current = signals?.[2 * junction] ?? -1;
    const state = signals?.[2 * junction + 1] ?? 2;
    for (let index = 0; index < markers.length; index++) {
      const marker = markers[index];
      // A near-constant size on screen: big enough to read from the aerial view, small at the kerb.
      const scale = Math.min(34, Math.max(4.2, camera.position.distanceTo(marker.anchor) * 0.058));
      marker.sprite.scale.set(scale, scale, 1);
      const lamp: Lamp = marker.phase !== current || state === 2 ? 0 : state === 0 ? 1 : 2;
      if (lamp !== marker.lamp) {
        draw(marker, lamp);
        marker.lamp = lamp;
      }
    }
  });

  return markers.map(({ sprite }, index) => (
    <primitive key={corridor.junctions[junction].approaches[index]} object={sprite} />
  ));
}
