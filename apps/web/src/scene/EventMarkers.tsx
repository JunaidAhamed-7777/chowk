import { DT } from "@chowk/sim";
import { type ActiveEvent, eventPoint } from "../sim/liveEvents";

const colours = {
  surge: "#f7a357",
  block: "#f1a95e",
  ambulance: "#80aaff",
  sensorFreeze: "#d5a4fc",
  outage: "#f57e85",
};

export function EventMarkers({ events, tick }: { events: readonly ActiveEvent[]; tick: number }) {
  return events.map(({ id, tick: start, event }) => {
    const duration = "duration" in event ? event.duration : 20;
    if (tick < start || tick - start >= duration / DT) return null;
    const [x, z] = eventPoint(event);
    const color = colours[event.type];
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
