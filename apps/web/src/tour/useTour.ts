import { useEffect, useRef } from "react";
import timeline from "./timeline.json";

const duration = 75;
const wipeTransition = 0.9;
export type TourBeat = (typeof timeline)[number];

interface TourOptions {
  running: boolean;
  reducedMotion: boolean;
  onBeat: (beat: TourBeat) => void;
  onWipe: (position: number) => void;
  onLoop: () => void;
}

export function useTour(options: TourOptions) {
  const callbacks = useRef(options);
  const { running, reducedMotion } = options;

  useEffect(() => {
    callbacks.current = options;
  }, [options]);

  useEffect(() => {
    if (!running) return;
    let elapsed = 0;
    let index = 0;
    let wipe = timeline[0].wipe;
    let last = performance.now();
    let request: number;
    callbacks.current.onBeat(timeline[0]);
    callbacks.current.onWipe(wipe);

    const advance = (now: number) => {
      if (!document.hidden) elapsed += Math.min((now - last) / 1000, 0.5);
      last = now;
      if (elapsed >= duration) {
        callbacks.current.onLoop();
        return;
      }
      if (index + 1 < timeline.length && elapsed >= timeline[index + 1].t) {
        index++;
        callbacks.current.onBeat(timeline[index]);
      }
      const beat = timeline[index];
      const from = timeline[Math.max(0, index - 1)].wipe;
      const weight = reducedMotion ? 1 : Math.min(1, (elapsed - beat.t) / wipeTransition);
      const eased = weight * weight * (3 - 2 * weight);
      const next = Math.round(from + (beat.wipe - from) * eased);
      if (wipe !== next) {
        wipe = next;
        callbacks.current.onWipe(wipe);
      }
      request = requestAnimationFrame(advance);
    };
    request = requestAnimationFrame(advance);
    return () => cancelAnimationFrame(request);
  }, [running, reducedMotion]);
}
