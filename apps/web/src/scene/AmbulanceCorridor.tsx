import { corridor, EMERGENCY_FLAG, SNAPSHOT_STRIDE } from "@chowk/sim";
import { useFrame } from "@react-three/fiber";
import { type RefObject, useEffect, useMemo, useRef } from "react";
import { AdditiveBlending, type Mesh, ShaderMaterial } from "three";
import type { SnapshotStream } from "../sim/SimHost";
import { clipMaterial, type WipeClip } from "./wipeClip";

const corridorStart = Math.min(...corridor.nodes.map(({ x }) => x));
const corridorEnd = Math.max(...corridor.nodes.map(({ x }) => x));
const ARTERIAL_HALF_WIDTH = 12;
const RIBBON_WIDTH = 3.2;

/**
 * Chevrons streaming along the road ahead of an ambulance on the arterial, so a viewer can
 * follow the route it needs cleared. Drawn per side and clipped to that side of the wipe.
 */
export function AmbulanceCorridor({
  host,
  visible,
  clip,
  reducedMotion,
}: {
  host: RefObject<SnapshotStream | null>;
  visible: boolean;
  clip: WipeClip;
  reducedMotion: boolean;
}) {
  const mesh = useRef<Mesh>(null);
  const material = useMemo(
    () =>
      clipMaterial(
        new ShaderMaterial({
          uniforms: { time: { value: 0 }, length: { value: 1 } },
          transparent: true,
          depthWrite: false,
          blending: AdditiveBlending,
          vertexShader: `
        varying vec2 ribbonUV;
        void main() {
          ribbonUV = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
        }`,
          fragmentShader: `
        varying vec2 ribbonUV;
        uniform float time;
        uniform float length;
        void main() {
          float along = ribbonUV.x * length;
          float across = abs(ribbonUV.y - .5) * 2.;
          float chevron = fract((along - across * 2.2) / 7. - time * 1.4);
          float mark = smoothstep(.0, .12, chevron) * (1. - smoothstep(.32, .44, chevron));
          float fade = (1. - smoothstep(0., 1., ribbonUV.x)) * smoothstep(0., .02, ribbonUV.x);
          float edge = 1. - smoothstep(.75, 1., across);
          gl_FragColor = vec4(vec3(.2, .95, .62) * (mark * .9 + .12), (mark * .75 + .1) * fade * edge);
        }`,
        }),
        clip,
      ),
    [clip],
  );
  useEffect(() => () => material.dispose(), [material]);

  useFrame((_, delta) => {
    const target = mesh.current;
    if (!target) return;
    const snapshot = host.current?.current;
    target.visible = false;
    if (!visible || !snapshot) return;
    const { positions, count } = snapshot;
    for (let offset = 0; offset < count * SNAPSHOT_STRIDE; offset += SNAPSHOT_STRIDE) {
      if ((positions[offset + 7] & EMERGENCY_FLAG) === 0) continue;
      const x = positions[offset];
      const z = positions[offset + 1];
      const dx = positions[offset + 2];
      if (Math.abs(z) > ARTERIAL_HALF_WIDTH || Math.abs(dx) < 0.9) continue;
      const end = dx > 0 ? corridorEnd : corridorStart;
      const length = Math.abs(end - x);
      if (length < 5) continue;
      target.position.set((x + end) / 2, 0.08, z);
      target.rotation.set(-Math.PI / 2, 0, dx > 0 ? 0 : Math.PI);
      target.scale.set(length, RIBBON_WIDTH, 1);
      material.uniforms.length.value = length;
      if (!reducedMotion) material.uniforms.time.value += delta;
      target.visible = true;
      return;
    }
  });

  return (
    <mesh ref={mesh} material={material} visible={false} renderOrder={2}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}
