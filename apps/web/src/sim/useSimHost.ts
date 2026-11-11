import type { Scenario } from "@chowk/sim";
import { useEffect, useRef } from "react";
import { type ControllerPair, type MetricsPair, SimHost } from "./SimHost";

interface SessionOptions {
  start?: boolean;
  active: boolean;
  paused: boolean;
  speed: number;
  seed: number;
  maxVehicles: number;
  scenario?: Scenario;
  revision: number;
  controllers: ControllerPair;
  pressure: boolean;
  decision: boolean;
  inspection: boolean;
  onReady: (ready: boolean) => void;
  onMetrics: (metrics: MetricsPair, tick: number, warmup?: readonly MetricsPair[]) => void;
  onRestart: () => void;
  onError: (message: string) => void;
}

export function useSimHost(options: SessionOptions) {
  const host = useRef<SimHost>(null);
  const settings = useRef(options);
  const {
    start = true,
    seed,
    maxVehicles,
    scenario,
    revision,
    controllers,
    pressure,
    decision,
    inspection,
  } = options;

  useEffect(() => {
    settings.current = options;
  }, [options]);

  useEffect(() => {
    if (!start) return;
    settings.current.onRestart();
    const source = new SimHost({
      seed,
      maxVehicles,
      scenario,
      controllers: settings.current.controllers,
      onReady: () => {
        if (settings.current.revision === revision) settings.current.onReady(true);
      },
      onMetrics: (metrics, tick, warmup) => {
        if (settings.current.revision === revision)
          settings.current.onMetrics(metrics, tick, warmup);
      },
      onError: (message) => {
        if (settings.current.revision !== revision) return;
        settings.current.onReady(false);
        settings.current.onError(message);
      },
    });
    host.current = source;
    source.setOverlayData(
      settings.current.pressure,
      settings.current.decision,
      settings.current.inspection,
    );
    let lastTime = performance.now();
    let animation: number;
    const advance = (now: number) => {
      const { active, paused, speed } = settings.current;
      source.advance((now - lastTime) / 1000, speed, active && !paused && !document.hidden);
      lastTime = now;
      animation = requestAnimationFrame(advance);
    };
    animation = requestAnimationFrame(advance);
    return () => {
      cancelAnimationFrame(animation);
      host.current = null;
      source.dispose();
    };
  }, [start, seed, maxVehicles, scenario, revision]);

  useEffect(() => {
    host.current?.setController(0, controllers[0]);
    host.current?.setController(1, controllers[1]);
  }, [controllers]);

  useEffect(() => {
    host.current?.setOverlayData(pressure, decision, inspection);
  }, [pressure, decision, inspection]);

  return host;
}
