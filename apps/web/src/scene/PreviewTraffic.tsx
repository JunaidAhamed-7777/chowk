import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Color, DynamicDrawUsage, type InstancedMesh, Object3D } from "three";
import type { PreviewFrame } from "../workers/preview.worker";
import { district } from "./corridorGeometry";
import { previewGreen, previewPhase, previewVehicles, previewYellow } from "./previewVehicles";
import type { PlaybackSpeed } from "./sceneSettings";
import { snapshotInterval } from "./sceneSettings";

interface TrafficProps {
  active: boolean;
  paused: boolean;
  speed: PlaybackSpeed;
  limit: number;
  onReady: (ready: boolean) => void;
}

interface Frames {
  earlier?: Float32Array<ArrayBuffer>;
  current?: Float32Array<ArrayBuffer>;
  receivedAt: number;
  time: number;
}

const signalLights = [
  new Color(3.1, 0.054, 0.025),
  new Color(4.6, 1.69, 0.03),
  new Color(0.055, 3.6, 1.12),
];
const blankSignal = new Color("#151b23");
const warmWhite = new Color(6.4, 4.85, 2.95);
const tailRed = new Color(5.7, 0.035, 0.022);

export function PreviewTraffic({ active, paused, speed, limit, onReady }: TrafficProps) {
  const bodyRef = useRef<InstancedMesh>(null);
  const roofRef = useRef<InstancedMesh>(null);
  const headRef = useRef<InstancedMesh>(null);
  const tailRef = useRef<InstancedMesh>(null);
  const signalRef = useRef<InstancedMesh>(null);
  const workerRef = useRef<Worker>(null);
  const frames = useRef<Frames>({ receivedAt: 0, time: 0 });
  const [matrix] = useState(() => new Object3D());
  const [failed, setFailed] = useState(false);
  const lastSignalFrame = useRef(-1);
  const lastSettledFrame = useRef({ receivedAt: -1, count: -1 });
  const limitCount = Math.min(previewVehicles.length, limit);
  const total = previewVehicles.length;
  const signals = district.signalMounts.length * 3;

  useEffect(() => {
    const worker = new Worker(new URL("../workers/preview.worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;
    worker.onmessage = ({ data }: MessageEvent<PreviewFrame>) => {
      const frame = frames.current;
      if (frame.earlier)
        worker.postMessage({ recycle: frame.earlier.buffer }, [frame.earlier.buffer]);
      frame.earlier = frame.current;
      frame.current = new Float32Array(data.positions);
      frame.receivedAt = performance.now();
      frame.time = data.time;
      if (!frame.earlier) onReady(true);
    };
    worker.onerror = () => {
      onReady(false);
      setFailed(true);
    };
    return () => {
      workerRef.current = null;
      worker.terminate();
      frames.current = { receivedAt: 0, time: 0 };
    };
  }, [onReady]);

  useEffect(() => {
    const sendSettings = () =>
      workerRef.current?.postMessage({ running: active && !paused && !document.hidden, speed });
    sendSettings();
    document.addEventListener("visibilitychange", sendSettings);
    return () => document.removeEventListener("visibilitychange", sendSettings);
  }, [active, paused, speed]);

  useLayoutEffect(() => {
    const bodies = bodyRef.current;
    const roofs = roofRef.current;
    const lamps = signalRef.current;
    if (!bodies || !roofs || !lamps) return;
    const color = new Color();
    for (const [index, vehicle] of previewVehicles.entries()) {
      bodies.setColorAt(index, color.set(vehicle.body.color));
      roofs.setColorAt(index, color.multiplyScalar(vehicle.body.length > 5 ? 0.78 : 0.48));
    }
    for (const [index, mount] of district.signalMounts.entries()) {
      matrix.rotation.y = mount.yaw;
      matrix.scale.set(0.14, 0.27, 0.26);
      for (let lamp = 0; lamp < 3; lamp += 1) {
        matrix.position.set(mount.x, 4.95 - lamp * 0.38, mount.z);
        matrix.updateMatrix();
        lamps.setMatrixAt(index * 3 + lamp, matrix.matrix);
        lamps.setColorAt(index * 3 + lamp, blankSignal);
      }
    }
    for (const mesh of [bodies, roofs, headRef.current, tailRef.current])
      mesh?.instanceMatrix.setUsage(DynamicDrawUsage);
    if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
    if (roofs.instanceColor) roofs.instanceColor.needsUpdate = true;
    if (lamps.instanceColor) lamps.instanceColor.needsUpdate = true;
    lamps.instanceMatrix.needsUpdate = true;
    lamps.computeBoundingSphere();
  }, [matrix]);

  useFrame(() => {
    const body = bodyRef.current;
    const roof = roofRef.current;
    const head = headRef.current;
    const tail = tailRef.current;
    const signals = signalRef.current;
    const { earlier, current, receivedAt, time } = frames.current;
    if (!body || !roof || !head || !tail || !signals || !current) return;
    const mix =
      paused || !earlier ? 1 : Math.min((performance.now() - receivedAt) / snapshotInterval, 1);
    const settled = lastSettledFrame.current;
    if (mix === 1 && settled.receivedAt === receivedAt && settled.count === limitCount) return;
    if (mix === 1) {
      settled.receivedAt = receivedAt;
      settled.count = limitCount;
    }

    body.count = limitCount;
    roof.count = limitCount;
    head.count = limitCount * 2;
    tail.count = limitCount * 2;
    for (let index = 0; index < limitCount; index += 1) {
      const vehicle = previewVehicles[index];
      let currentDistance = current[index];
      let previousDistance = earlier?.[index] ?? currentDistance;
      if (vehicle.crossing) {
        if (previousDistance >= 0 && currentDistance < 0) currentDistance = vehicle.length;
        if (previousDistance < 0 && currentDistance >= 0) previousDistance = 0;
      } else if (previousDistance > currentDistance + vehicle.length / 2) {
        previousDistance -= vehicle.length;
      }
      let distance = previousDistance + mix * (currentDistance - previousDistance);
      if (!vehicle.crossing && distance < 0) distance += vehicle.length;
      const fade = Math.max(
        0,
        Math.min(
          1,
          distance / (vehicle.speed * 0.2),
          (vehicle.length - distance) / (vehicle.speed * 0.2),
        ),
      );
      const x = vehicle.startX + distance * vehicle.dirX;
      const z = vehicle.startZ + distance * vehicle.dirZ;
      const { width, length, height, roof: roofHeight } = vehicle.body;
      const headlight = length * 0.5 + 0.034;
      const lampSize = width < 1 ? 0.24 : 0.34;
      const lateral = width < 1 ? 0 : width * 0.31;
      matrix.rotation.y = vehicle.yaw;
      matrix.position.set(x, (height - roofHeight) * 0.5, z);
      matrix.scale.set(width * fade, (height - roofHeight) * fade, length * fade);
      matrix.updateMatrix();
      body.setMatrixAt(index, matrix.matrix);
      matrix.position.y = height - roofHeight * 0.5;
      matrix.scale.set(
        width * 0.84 * fade,
        roofHeight * fade,
        length * (length > 5 ? 0.88 : 0.57) * fade,
      );
      matrix.updateMatrix();
      roof.setMatrixAt(index, matrix.matrix);

      for (let lamp = 0; lamp < 2; lamp += 1) {
        const side = lamp === 0 ? -lateral : lateral;
        matrix.scale.set(lampSize * fade, lampSize * fade, 0.22 * fade);
        matrix.position.set(
          x + side * vehicle.leftX + headlight * vehicle.dirX,
          0.53,
          z + side * vehicle.leftZ + headlight * vehicle.dirZ,
        );
        matrix.updateMatrix();
        head.setMatrixAt(index * 2 + lamp, matrix.matrix);
        matrix.position.set(
          x + side * vehicle.leftX - headlight * vehicle.dirX,
          0.58,
          z + side * vehicle.leftZ - headlight * vehicle.dirZ,
        );
        matrix.updateMatrix();
        tail.setMatrixAt(index * 2 + lamp, matrix.matrix);
      }
    }
    body.instanceMatrix.needsUpdate = true;
    roof.instanceMatrix.needsUpdate = true;
    head.instanceMatrix.needsUpdate = true;
    tail.instanceMatrix.needsUpdate = true;

    const signalFrame = Math.floor(time);
    if (lastSignalFrame.current === signalFrame) return;
    lastSignalFrame.current = signalFrame;
    for (let index = 0; index < district.signalMounts.length; index += 1) {
      const mount = district.signalMounts[index];
      const phase = previewPhase(signalFrame, mount.junction);
      const phaseStart = Math.floor(phase);
      const phaseTime = (phase - phaseStart) * (previewGreen + previewYellow + 1);
      const approach = phaseStart % mount.approachCount;
      const lit =
        approach !== mount.approach || phaseTime >= previewGreen + previewYellow
          ? 0
          : phaseTime >= previewGreen
            ? 1
            : 2;
      for (let lamp = 0; lamp < 3; lamp += 1)
        signals.setColorAt(index * 3 + lamp, lamp === lit ? signalLights[lamp] : blankSignal);
    }
    if (signals.instanceColor) signals.instanceColor.needsUpdate = true;
  });

  if (failed) throw new Error("The corridor preview worker stopped.");
  return (
    <>
      <instancedMesh
        ref={bodyRef}
        args={[undefined, undefined, total]}
        count={0}
        frustumCulled={false}
      >
        <boxGeometry />
        <meshStandardMaterial metalness={0.28} roughness={0.5} />
      </instancedMesh>
      <instancedMesh
        ref={roofRef}
        args={[undefined, undefined, total]}
        count={0}
        frustumCulled={false}
      >
        <boxGeometry />
        <meshStandardMaterial roughness={0.39} />
      </instancedMesh>
      <instancedMesh
        ref={headRef}
        args={[undefined, undefined, total * 2]}
        count={0}
        frustumCulled={false}
      >
        <boxGeometry />
        <meshBasicMaterial color={warmWhite} toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        ref={tailRef}
        args={[undefined, undefined, total * 2]}
        count={0}
        frustumCulled={false}
      >
        <boxGeometry />
        <meshBasicMaterial color={tailRed} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={signalRef} args={[undefined, undefined, signals]}>
        <boxGeometry />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </>
  );
}
