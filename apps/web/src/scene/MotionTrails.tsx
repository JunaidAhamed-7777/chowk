import { DT, SNAPSHOT_STRIDE, VEHICLE_CLASSES } from "@chowk/sim";
import { useFrame } from "@react-three/fiber";
import { type RefObject, useEffect, useRef, useState } from "react";
import {
  AdditiveBlending,
  BufferAttribute,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  type Mesh,
  ShaderMaterial,
  Vector2,
} from "three";
import type { SnapshotStream } from "../sim/SimHost";
import { clipMaterial, type WipeClip } from "./wipeClip";

export function MotionTrails({
  host,
  capacity,
  enabled,
  speed,
  clip,
}: {
  host: RefObject<SnapshotStream | null>;
  capacity: number;
  enabled: boolean;
  speed: number;
  clip: WipeClip;
}) {
  const mesh = useRef<Mesh>(null);
  const [trail] = useState(() => {
    const geometry = new InstancedBufferGeometry();
    const starts = new InstancedBufferAttribute(new Float32Array(capacity * 3), 3).setUsage(
      DynamicDrawUsage,
    );
    const ends = new InstancedBufferAttribute(new Float32Array(capacity * 3), 3).setUsage(
      DynamicDrawUsage,
    );
    const glow = new InstancedBufferAttribute(new Float32Array(capacity), 1).setUsage(
      DynamicDrawUsage,
    );
    geometry.setIndex([0, 1, 2, 2, 1, 3]);
    geometry.setAttribute(
      "position",
      new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0]), 3),
    );
    geometry.setAttribute("trailStart", starts);
    geometry.setAttribute("trailEnd", ends);
    geometry.setAttribute("trailGlow", glow);
    geometry.instanceCount = 0;
    const resolution = { value: new Vector2(1, 1) };
    const material = clipMaterial(
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false,
        uniforms: { resolution },
        vertexShader: `
        attribute vec3 trailStart;
        attribute vec3 trailEnd;
        attribute float trailGlow;
        uniform vec2 resolution;
        varying vec2 alongAcross;
        varying float brightness;
        void main() {
          vec4 start = projectionMatrix * modelViewMatrix * vec4(trailStart, 1.);
          vec4 end = projectionMatrix * modelViewMatrix * vec4(trailEnd, 1.);
          vec2 direction = (end.xy / max(.01, end.w) - start.xy / max(.01, start.w)) * resolution;
          vec2 perpendicular = vec2(-direction.y, direction.x) / max(.01, length(direction));
          vec4 projected = mix(start, end, position.x);
          projected.xy += perpendicular * (position.y * 2. - 1.) * projected.w * 2. / resolution;
          gl_Position = start.w > 0. && end.w > 0. ? projected : vec4(2., 2., 2., 1.);
          alongAcross = position.xy;
          brightness = trailGlow;
        }
      `,
        fragmentShader: `
        varying vec2 alongAcross;
        varying float brightness;
        void main() {
          float fade = pow(alongAcross.x, 2.0) * (1. - abs(alongAcross.y * 2. - 1.));
          gl_FragColor = vec4(2.8, .09, .045, fade * brightness);
        }
      `,
      }),
      clip,
    );
    return { geometry, starts, ends, glow, resolution, material };
  });
  useEffect(
    () => () => {
      trail.geometry.dispose();
      trail.material.dispose();
    },
    [trail],
  );
  useFrame((state) => {
    const target = mesh.current;
    const stream = host.current;
    const frame = stream?.current;
    const previous = stream?.previous;
    if (!target || !stream || !enabled || !frame || !previous) {
      if (target) target.visible = false;
      return;
    }
    const period = Math.max(1, ((frame.tick - previous.tick) * DT * 1000) / speed);
    const mix = Math.min(1, (performance.now() - stream.receivedAt) / period);
    const positions = frame.positions;
    let count = 0;
    for (
      let offset = 0;
      offset < frame.count * SNAPSHOT_STRIDE && count < capacity;
      offset += SNAPSHOT_STRIDE
    ) {
      const v = positions[offset + 4];
      if (v <= 2.4) continue;
      const id = positions[offset + 6];
      const prior = previous.index.get(id);
      if (prior === undefined) continue;
      const old = previous.positions;
      const dx = positions[offset + 2];
      const dz = positions[offset + 3];
      const cls = positions[offset + 5];
      const bumper = VEHICLE_CLASSES[cls].length / 2;
      const x = old[prior] + (positions[offset] - old[prior]) * mix - dx * bumper;
      const z = old[prior + 1] + (positions[offset + 1] - old[prior + 1]) * mix - dz * bumper;
      const travelX = positions[offset] - old[prior];
      const travelZ = positions[offset + 1] - old[prior + 1];
      const displacement = Math.hypot(travelX, travelZ);
      if (displacement < 0.12) continue;
      const length = Math.min(13, v * 0.54);
      trail.starts.setXYZ(
        count,
        x - (travelX / displacement) * length,
        0.59,
        z - (travelZ / displacement) * length,
      );
      trail.ends.setXYZ(count, x, 0.59, z);
      trail.glow.setX(count, Math.min(0.6, v / 16));
      count++;
    }
    trail.geometry.instanceCount = count;
    target.visible = count > 0;
    if (!count) return;
    trail.resolution.value.set(
      state.size.width * state.viewport.dpr,
      state.size.height * state.viewport.dpr,
    );
    trail.starts.needsUpdate = true;
    trail.ends.needsUpdate = true;
    trail.glow.needsUpdate = true;
  });
  return (
    <mesh
      ref={mesh}
      geometry={trail.geometry}
      material={trail.material}
      visible={false}
      frustumCulled={false}
      renderOrder={2}
    />
  );
}
