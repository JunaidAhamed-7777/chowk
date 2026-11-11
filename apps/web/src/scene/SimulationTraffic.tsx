import type { Metrics } from "@chowk/sim";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { SimHost } from "../sim/SimHost";
import type { PlaybackSpeed } from "./sceneSettings";
import { qualityPresets } from "./sceneSettings";
import { TrafficMeshes } from "./TrafficMeshes";

const capacity = qualityPresets.high.vehicleLimit;

export function SimulationTraffic({
  active,
  paused,
  speed,
  lowDetail,
  onReady,
  onMetrics,
}: {
  active: boolean;
  paused: boolean;
  speed: PlaybackSpeed;
  lowDetail: boolean;
  onReady: (ready: boolean) => void;
  onMetrics: (metrics: Metrics) => void;
}) {
  const host = useRef<SimHost>(null);
  const [failure, setFailure] = useState<string>();

  useEffect(() => {
    const source = new SimHost(
      capacity,
      () => onReady(true),
      onMetrics,
      (message) => {
        onReady(false);
        setFailure(message);
      },
    );
    host.current = source;
    return () => {
      host.current = null;
      source.dispose();
    };
  }, [onReady, onMetrics]);

  useFrame((_, delta) => {
    host.current?.advance(delta, speed, active && !paused && !document.hidden);
  }, -2);

  if (failure) throw new Error(failure);
  return (
    <TrafficMeshes
      host={host}
      capacity={capacity}
      paused={paused}
      speed={speed}
      lowDetail={lowDetail}
    />
  );
}
