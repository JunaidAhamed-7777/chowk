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
 * Faint, static chevrons painted on the road ahead of an ambulance on the arterial, so a viewer
 * can follow the route it needs cleared. The pattern is anchored to the road rather than the
 * vehicle, so the marks stay put as the ambulance drives over them. Drawn per side and clipped
 * to that side of the wipe.
 */
export function AmbulanceCorridor({
  host,
  visible,
  clip,
}: {
  host: RefObject<SnapshotStream | null>;
  visible: boolean;
  clip: WipeClip;
}) {
  const mesh = useRef<Mesh>(null);
  const material = useMemo(
    () =>
      clipMaterial(
        new ShaderMaterial({
          uniforms: { origin: { value: 0 }, length: { value: 1 } },
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
        uniform float origin;
        uniform float length;
        void main() {
          float along = ribbonUV.x * length;
          float across = abs(ribbonUV.y - .5) * 2.;
          float chevron = fract((origin + along - across * 1.8) / 10.);
          float mark = smoothstep(.0, .04, chevron) * (1. - smoothstep(.1, .14, chevron));
          float fade = (1. - smoothstep(.3, 1., ribbonUV.x)) * smoothstep(0., 6., along);
          float edge = 1. - smoothstep(.7, .95, across);
          gl_FragColor = vec4(vec3(.35, .85, .62) * mark, mark * .32 * fade * edge);
        }`,
        }),
        clip,
      ),
    [clip],
  );
  useEffect(() => () => material.dispose(), [material]);

  useFrame(() => {
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
      material.uniforms.origin.value = dx > 0 ? x : -x;
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
