import type { Explanation } from "@chowk/controllers";
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
import type { SnapshotStream } from "../sim/SimHost";
import { clipMaterial, type WipeClip } from "./wipeClip";

const canvasWidth = 296;
const canvasHeight = 96;

interface Label {
  canvas: HTMLCanvasElement;
  sprite: Sprite;
  texture: CanvasTexture;
  anchor: Vector3;
  phase: number;
  explanation?: Explanation;
}

function same(a: Explanation | undefined, b: Explanation | undefined) {
  if (a === b) return true;
  if (!a || !b || a.reason !== b.reason || a.scores.length !== b.scores.length) return false;
  for (let index = 0; index < a.scores.length; index++) {
    if (
      a.scores[index] !== b.scores[index] ||
      a.prior?.[index] !== b.prior?.[index] ||
      a.learned?.[index] !== b.learned?.[index]
    )
      return false;
  }
  return true;
}

function draw(
  label: Label,
  junction: number,
  side: WipeClip["side"],
  explanation: Explanation | undefined,
  phase: number,
) {
  const context = label.canvas.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, canvasWidth, canvasHeight);
  context.fillStyle = "rgba(5, 7, 13, .94)";
  context.strokeStyle = "#435064";
  context.lineWidth = 2;
  context.beginPath();
  context.roundRect(2, 2, canvasWidth - 4, canvasHeight - 4, 13);
  context.fill();
  context.stroke();
  context.textBaseline = "middle";
  context.font = "600 19px monospace";
  context.fillStyle = "#b6c5d6";
  context.fillText(`${side === 0 ? "A" : "B"} · J${junction + 1} · Phase ${phase + 1}`, 74, 27);
  context.font = "500 16px system-ui";
  context.fillStyle = "#e8edf5";
  const reason = explanation?.reason ?? "Signal phase in progress";
  const words = reason.split(" ");
  let first = "";
  let second = "";
  for (const word of words) {
    if (second || context.measureText(`${first} ${word}`.trim()).width > 206)
      second += `${second ? " " : ""}${word}`;
    else first += `${first ? " " : ""}${word}`;
  }
  context.fillText(first, 74, 53, 206);
  if (second) context.fillText(second, 74, 73, 206);

  const phases = corridor.junctions[junction].phases;
  const cx = 39;
  const cy = 48;
  const scores = explanation?.scores;
  let max = 0.001;
  for (let index = 0; index < phases.length; index++) {
    max = Math.max(max, Math.abs(scores?.[index] ?? 0), Math.abs(explanation?.prior?.[index] ?? 0));
  }
  context.lineCap = "round";
  for (let index = 0; index < phases.length; index++) {
    const angle = (index * 2 * Math.PI) / phases.length - Math.PI / 2;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const base = 7;
    const score = scores?.[index] ?? 0;
    const prior = explanation?.prior?.[index];
    const endpoint = base + 4 + (19 * Math.abs(score)) / max;
    const cutoff =
      prior === undefined ? endpoint : Math.min(endpoint, base + 4 + (19 * Math.abs(prior)) / max);
    context.lineWidth = index === phase ? 7 : 5;
    context.strokeStyle = index === phase ? "#80edc5" : score < 0 ? "#bd7088" : "#8b9cae";
    context.beginPath();
    context.moveTo(cx + dx * base, cy + dy * base);
    context.lineTo(cx + dx * cutoff, cy + dy * cutoff);
    context.stroke();
    if (endpoint > cutoff) {
      context.strokeStyle = "#c4a8f5";
      context.beginPath();
      context.moveTo(cx + dx * cutoff, cy + dy * cutoff);
      context.lineTo(cx + dx * endpoint, cy + dy * endpoint);
      context.stroke();
    }
    if (index === phase) {
      context.strokeStyle = "#80edc5";
      context.lineWidth = 1.6;
      context.beginPath();
      context.arc(cx + dx * endpoint, cy + dy * endpoint, 5.5, 0, Math.PI * 2);
      context.stroke();
    }
  }
  label.texture.needsUpdate = true;
}

export function DecisionLabels({
  host,
  enabled,
  visible,
  clip,
}: {
  host: RefObject<SnapshotStream | null>;
  enabled: boolean;
  visible: boolean;
  clip: WipeClip;
}) {
  const [labels] = useState<Label[]>(() =>
    corridor.junctions.map(({ node }) => {
      const position = corridor.nodes[node];
      const canvas = document.createElement("canvas");
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const texture = new CanvasTexture(canvas);
      texture.colorSpace = SRGBColorSpace;
      texture.minFilter = LinearFilter;
      texture.generateMipmaps = false;
      const sprite = new Sprite(
        clipMaterial(
          new SpriteMaterial({
            map: texture,
            depthTest: false,
            depthWrite: false,
            transparent: true,
            toneMapped: false,
            opacity: 0,
          }),
          clip,
        ),
      );
      const anchor = new Vector3(position.x, 18, position.z);
      sprite.position.copy(anchor);
      sprite.renderOrder = 5;
      sprite.visible = false;
      return { canvas, texture, sprite, anchor, phase: -1 };
    }),
  );
  useEffect(
    () => () => {
      for (const { sprite, texture } of labels) {
        sprite.material.dispose();
        texture.dispose();
      }
    },
    [labels],
  );
  const [screen] = useState(() => ({ view: new Vector3(), projected: new Vector3() }));
  useFrame(({ camera, size, viewport }, delta) => {
    const snapshot = host.current?.current;
    const frameWidth = size.width * viewport.dpr;
    const edge = clip.position.value;
    for (let index = 0; index < labels.length; index++) {
      const label = labels[index];
      const material = label.sprite.material;
      const show = enabled && visible && Boolean(snapshot?.explanations);
      material.opacity = show
        ? Math.min(1, material.opacity + delta / 0.3)
        : Math.max(0, material.opacity - delta / 0.3);
      label.sprite.visible = material.opacity > 0;
      if (!label.sprite.visible || !snapshot) continue;
      const width = Math.min(116, Math.max(22, camera.position.distanceTo(label.anchor) * 0.135));
      const viewZ = screen.view.copy(label.anchor).applyMatrix4(camera.matrixWorldInverse).z;
      const projected = screen.projected.copy(label.anchor).project(camera);
      const pad = (width * camera.projectionMatrix.elements[0] * frameWidth) / (-4 * viewZ) + 5;
      const lower = (clip.side === 0 ? 0 : edge) + pad;
      const upper = (clip.side === 0 ? edge : frameWidth) - pad;
      const anchorX = ((projected.x + 1) * frameWidth) / 2;
      if (
        viewZ >= 0 ||
        lower > upper ||
        anchorX < lower - pad * 1.5 ||
        anchorX > upper + pad * 1.5
      ) {
        label.sprite.visible = false;
        continue;
      }
      projected.x = (Math.min(upper, Math.max(lower, anchorX)) * 2) / frameWidth - 1;
      label.sprite.position.copy(projected.unproject(camera));
      label.sprite.scale.set(width, (width * canvasHeight) / canvasWidth, 1);
      const phase = snapshot.signals[index * 2];
      const explanation = snapshot.explanations?.[index];
      if (label.phase !== phase || !same(label.explanation, explanation)) {
        draw(label, index, clip.side, explanation, phase);
        label.phase = phase;
        label.explanation = explanation;
      }
    }
  });
  return labels.map(({ sprite }, index) => (
    <primitive key={corridor.junctions[index].id} object={sprite} />
  ));
}
