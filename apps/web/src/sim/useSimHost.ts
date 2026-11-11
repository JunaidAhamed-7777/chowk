import type { Scenario } from "@chowk/sim";
import { useEffect, useRef } from "react";
import { type ControllerPair, type MetricsPair, SimHost } from "./SimHost";

interface SessionOptions {
  active: boolean;
  paused: boolean;
  speed: number;
  seed: number;
  maxVehicles: number;
  scenario?: Scenario;
  revision: number;
  controllers: ControllerPair;
  pressure: boolean;
  onReady: (ready: boolean) => void;
  onMetrics: (metrics: MetricsPair, tick: number) => void;
  onError: (message: string) => void;
}

export function useSimHost(options: SessionOptions) {
  const host = useRef<SimHost>(null);
  const settings = useRef(options);
  const { seed, maxVehicles, scenario, revision, controllers, pressure } = options;

  useEffect(() => {
    settings.current = options;
  }, [options]);

  useEffect(() => {
    const source = new SimHost({
      seed,
      maxVehicles,
      scenario,
      controllers: settings.current.controllers,
      onReady: () => {
        if (settings.current.revision === revision) settings.current.onReady(true);
      },
      onMetrics: (metrics, tick) => {
        if (settings.current.revision === revision) settings.current.onMetrics(metrics, tick);
      },
      onError: (message) => {
        if (settings.current.revision !== revision) return;
        settings.current.onReady(false);
        settings.current.onError(message);
      },
    });
    host.current = source;
    source.setPressure(settings.current.pressure);
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
  }, [seed, maxVehicles, scenario, revision]);

  useEffect(() => {
    host.current?.setController(0, controllers[0]);
    host.current?.setController(1, controllers[1]);
  }, [controllers]);

  useEffect(() => {
    host.current?.setPressure(pressure);
  }, [pressure]);

  return host;
}
