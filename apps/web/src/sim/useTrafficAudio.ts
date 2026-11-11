import { type RefObject, useEffect, useRef } from "react";
import { SNAPSHOT_STRIDE } from "@chowk/sim";
import type { SimHost } from "./SimHost";
import { setTrafficSiren, setTrafficSoundVisible, soundSignal } from "./trafficAudio";

export function useTrafficAudio(
  host: RefObject<SimHost | null>,
  tick: number | undefined,
  active: boolean,
) {
  const previous = useRef<Uint8Array | undefined>(undefined);
  useEffect(() => {
    const visibility = () => setTrafficSoundVisible(active && !document.hidden);
    visibility();
    document.addEventListener("visibilitychange", visibility);
    return () => {
      setTrafficSoundVisible(false);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [active]);

  useEffect(() => {
    if (!active || tick === undefined) return;
    const frame = host.current?.streams[1].current;
    if (!frame) return;
    const signals = frame.signals;
    if (previous.current && signals.some((value, index) => value !== previous.current?.[index]))
      soundSignal();
    previous.current = signals;
    let ambulance = false;
    for (let offset = 0; offset < frame.count * SNAPSHOT_STRIDE; offset += SNAPSHOT_STRIDE) {
      if (frame.positions[offset + 5] === 5) {
        ambulance = true;
        break;
      }
    }
    setTrafficSiren(ambulance);
  }, [active, tick, host]);
}
