import { useFrame } from "@react-three/fiber";
import { type RefObject, useRef, useState } from "react";
import type { SimHost, SnapshotStream } from "../sim/SimHost";
import type { PlaybackSpeed, Quality } from "./sceneSettings";
import { qualityPresets } from "./sceneSettings";
import { TrafficMeshes } from "./TrafficMeshes";
import type { WipeClip } from "./wipeClip";

export function SimulationTraffic({
  host,
  paused,
  speed,
  quality,
  wipe,
  singleView,
}: {
  host: RefObject<SimHost | null>;
  paused: boolean;
  speed: PlaybackSpeed;
  quality: Quality;
  wipe: number;
  singleView: boolean;
}) {
  const left = useRef<SnapshotStream>(null);
  const right = useRef<SnapshotStream>(null);
  const [clips] = useState<readonly [WipeClip, WipeClip]>(() => {
    const position = { value: 0 };
    return [
      { position, side: 0 },
      { position, side: 1 },
    ];
  });
  useFrame((state) => {
    clips[0].position.value = singleView
      ? 0
      : Math.round((state.size.width * state.viewport.dpr * wipe) / 100);
    left.current = host.current?.streams[0] ?? null;
    right.current = host.current?.streams[1] ?? null;
  }, -2);

  const capacity = qualityPresets.high.vehicleLimit;
  return (
    <>
      <TrafficMeshes
        host={left}
        capacity={capacity}
        paused={paused}
        speed={speed}
        lowDetail={quality === "low"}
        beamDetail={quality === "high"}
        visible={!singleView && wipe > 0}
        clip={clips[0]}
      />
      <TrafficMeshes
        host={right}
        capacity={capacity}
        paused={paused}
        speed={speed}
        lowDetail={quality === "low"}
        beamDetail={quality === "high"}
        visible={singleView || wipe < 100}
        clip={clips[1]}
      />
    </>
  );
}
