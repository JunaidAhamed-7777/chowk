import { corridor, DT } from "@chowk/sim";
import { useEffect, useState } from "react";
import { type BufferGeometry, MeshStandardMaterial } from "three";
import { type ActiveEvent, eventPoint } from "../sim/liveEvents";
import { loadMeshAsset } from "./vehicleGeometries";

const colours = {
  surge: "#f7a357",
  block: "#f1a95e",
  ambulance: "#80aaff",
  sensorFreeze: "#d5a4fc",
  outage: "#f57e85",
};

export function EventMarkers({ events, tick }: { events: readonly ActiveEvent[]; tick: number }) {
  const [cones, setCones] = useState<BufferGeometry | null>(null);
  const [conePaint] = useState(
    () =>
      new MeshStandardMaterial({
        color: "#f99a3e",
        emissive: "#ed6920",
        emissiveIntensity: 0.25,
        roughness: 0.72,
      }),
  );
  const hasBlock = events.some(({ event }) => event.type === "block");
  useEffect(() => {
    if (!hasBlock) return;
    let mounted = true;
    void loadMeshAsset("prop_breakdown").then((geometry) => {
      if (mounted) setCones(geometry);
    });
    return () => {
      mounted = false;
    };
  }, [hasBlock]);
  useEffect(() => () => conePaint.dispose(), [conePaint]);

  return events.map(({ id, tick: start, event }) => {
    const duration = "duration" in event ? event.duration : 20;
    if (tick < start || tick - start >= duration / DT) return null;
    const [x, z] = eventPoint(event);
    const color = colours[event.type];
    const link = event.type === "block" ? corridor.links[event.link] : undefined;
    return (
      <group key={id} position={[x, 0.16, z]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[4.6, 5.1, 28]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
        <mesh position={[0, 4, 0]}>
          <cylinderGeometry args={[0.12, 0.12, 8, 5]} />
          <meshBasicMaterial color={color} transparent opacity={0.7} depthWrite={false} />
        </mesh>
        <mesh position={[0, 8, 0]}>
          <octahedronGeometry args={[0.9]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
        {event.type === "block" && link && cones && (
          <group rotation={[0, -Math.atan2(link.dir[1], link.dir[0]), 0]}>
            <mesh
              geometry={cones}
              material={conePaint}
              dispose={null}
              position={[(event.start - event.end) / 2 - 1.3, -0.16, 0]}
            />
            <mesh
              geometry={cones}
              material={conePaint}
              dispose={null}
              position={[(event.end - event.start) / 2 + 1.3, -0.16, 0]}
            />
          </group>
        )}
      </group>
    );
  });
}

export function RoadPicker({
  onPick,
}: {
  onPick: (x: number, z: number, screenX: number) => void;
}) {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Three's hit plane has a native Place at J3 button alternative.
    <mesh
      position={[900, 0.1, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      onClick={(event) => {
        if (event.delta > 5) return;
        event.stopPropagation();
        onPick(event.point.x, event.point.z, event.nativeEvent.clientX);
      }}
    >
      <planeGeometry args={[5000, 5000]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
}
