import { corridor } from "@chowk/sim";
import { useFrame } from "@react-three/fiber";
import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  DynamicDrawUsage,
  InstancedBufferAttribute,
  type InstancedMesh,
  Object3D,
  PlaneGeometry,
  ShaderMaterial,
} from "three";
import { roadPoint } from "../sim/liveEvents";
import type { Snapshot, SnapshotStream } from "../sim/SimHost";
import { clipMaterial, type WipeClip } from "./wipeClip";

const inZones = [
  { key: "areaNear", near: 0, far: 60 },
  { key: "areaMid", near: 60, far: 150 },
  { key: "areaFar", near: 150, far: 300 },
] as const;

const zones = corridor.junctions.flatMap(({ id, approaches }) => {
  const incoming = approaches.flatMap((link, approach) =>
    inZones.map((zone) => ({
      ...zone,
      junction: id,
      approach,
      link,
      exit: false as const,
    })),
  );
  const exits = [
    ...new Set(
      corridor.connectors.filter(({ junction }) => junction === id).map(({ toLink }) => toLink),
    ),
  ];
  return [
    ...incoming,
    ...exits.map((link) => ({
      junction: id,
      link,
      near: 0,
      far: 60,
      exit: true as const,
    })),
  ];
});

export function PressureZones({
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
  const mesh = useRef<InstancedMesh>(null);
  const last = useRef<Snapshot | undefined>(undefined);
  const [resources] = useState(() => {
    const geometry = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const occupancy = new InstancedBufferAttribute(new Float32Array(zones.length), 1).setUsage(
      DynamicDrawUsage,
    );
    geometry.setAttribute("occupancy", occupancy);
    const opacity = { value: 0 };
    const material = clipMaterial(
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        toneMapped: false,
        uniforms: { opacity },
        vertexShader: `
        attribute float occupancy;
        varying float area;
        varying vec2 zoneUv;
        void main() {
          area = occupancy;
          zoneUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.);
        }
      `,
        fragmentShader: `
        uniform float opacity;
        varying float area;
        varying vec2 zoneUv;
        void main() {
          vec3 amber = vec3(1., .54, .13);
          vec3 magenta = vec3(.95, .06, .58);
          float edge = min(min(zoneUv.x, 1. - zoneUv.x), min(zoneUv.y, 1. - zoneUv.y));
          float outline = 1. - smoothstep(.012, .038, edge);
          float coverage = min(.62, area * 1.15 + outline * .13);
          gl_FragColor = vec4(mix(amber, magenta, smoothstep(.16, .55, area)), coverage * opacity);
        }
      `,
      }),
      clip,
    );
    return { geometry, occupancy, opacity, material };
  });
  useEffect(
    () => () => {
      resources.geometry.dispose();
      resources.material.dispose();
    },
    [resources],
  );

  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    const transform = new Object3D();
    for (let index = 0; index < zones.length; index++) {
      const zone = zones[index];
      const link = corridor.links[zone.link];
      const near = Math.min(zone.near, link.length);
      const far = Math.min(zone.far, link.length);
      const depth = link.strips * corridor.stripWidth;
      const distance = zone.exit ? (near + far) / 2 : link.length - (near + far) / 2;
      const [x, z] = roadPoint(link, distance, depth / 2);
      transform.position.set(x, 0.055, z);
      transform.rotation.y = -Math.atan2(link.dir[1], link.dir[0]);
      transform.scale.set(Math.max(0, far - near - 0.5), 1, Math.max(0, depth - 0.5));
      transform.updateMatrix();
      target.setMatrixAt(index, transform.matrix);
    }
    target.instanceMatrix.needsUpdate = true;
  }, []);

  useFrame((_, delta) => {
    const target = mesh.current;
    if (!target) return;
    const previous = resources.opacity.value;
    const opacity =
      enabled && visible
        ? Math.min(1, previous + delta / 0.3)
        : Math.max(0, previous - delta / 0.3);
    resources.opacity.value = opacity;
    target.visible = opacity > 0;
    if (opacity === 0) return;
    const snapshot = host.current?.current;
    if (!snapshot?.sense || snapshot === last.current) return;
    last.current = snapshot;
    for (let index = 0; index < zones.length; index++) {
      const zone = zones[index];
      const sense = snapshot.sense[zone.junction];
      let area = 0;
      if (zone.exit && sense) {
        for (const approach of sense.approaches) {
          for (const exit of approach.exits)
            if (exit.link === zone.link) area = Math.max(area, exit.area);
        }
      } else if (!zone.exit) {
        area = sense?.approaches[zone.approach]?.[zone.key] ?? 0;
      }
      resources.occupancy.setX(index, area);
    }
    resources.occupancy.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[resources.geometry, resources.material, zones.length]}
      visible={false}
      frustumCulled={false}
    />
  );
}
