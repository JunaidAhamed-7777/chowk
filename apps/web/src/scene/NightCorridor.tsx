import { DT, SNAPSHOT_STRIDE, VEHICLE_CLASSES } from "@chowk/sim";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  BlendFunction,
  BloomEffect,
  EffectComposer,
  EffectPass,
  FXAAEffect,
  RenderPass,
  SMAAEffect,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from "postprocessing";
import { type RefObject, useEffect, useRef, useState } from "react";
import {
  Color,
  type DirectionalLight,
  FogExp2,
  HalfFloatType,
  type HemisphereLight,
  NoToneMapping,
  PerspectiveCamera,
  Vector3,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { ActiveEvent } from "../sim/liveEvents";
import type { SimHost } from "../sim/SimHost";
import type { Mood } from "../sim/scenarioScene";
import { junctions } from "./corridorGeometry";
import { EventMarkers, RoadPicker } from "./EventMarkers";
import { blendMood, currentMood, moodTarget, snapMood } from "./moodLighting";
import { SimulationTraffic } from "./SimulationTraffic";
import { StaticDistrict } from "./StaticDistrict";
import type {
  CameraSelection,
  OverlayMode,
  PlaybackSpeed,
  Quality,
  VehicleFollow,
} from "./sceneSettings";
import { qualityPresets } from "./sceneSettings";

interface SceneProps {
  active: boolean;
  automatic: boolean;
  camera: CameraSelection;
  onQuality: (quality: Quality) => void;
  host: RefObject<SimHost | null>;
  wipe: number;
  singleView: boolean;
  overlay: OverlayMode;
  events: readonly ActiveEvent[];
  tick: number;
  vehicle: VehicleFollow | undefined;
  onRoadPick: (x: number, z: number, screenX: number) => void;
  onContext: (state: "lost" | "restored") => void;
  ready: boolean;
  paused: boolean;
  quality: Quality;
  reducedMotion: boolean;
  speed: PlaybackSpeed;
  mood: Mood;
  rain: boolean;
}

const aerialPosition = [520, 214, 236] as const;
const driftReach = 260;
const driftRate = 0.045;
const aerialTarget = [925, 0, -6] as const;
// The tour opens low over J3's western approach, then cranes up to the aerial view.
const streetPosition = [738, 14, 30] as const;
const streetTarget = [790, 1, -6] as const;
const craneSpeed = 0.75;

function CorridorCamera({
  selection,
  reducedMotion,
  host,
  vehicle,
  paused,
  speed,
}: {
  selection: CameraSelection;
  reducedMotion: boolean;
  host: RefObject<SimHost | null>;
  vehicle: VehicleFollow | undefined;
  paused: boolean;
  speed: PlaybackSpeed;
}) {
  const { camera, gl } = useThree();
  const orbit = useRef<OrbitControls | null>(null);
  const [preset] = useState(() => ({
    position: new Vector3(...aerialPosition),
    target: new Vector3(...aerialTarget),
  }));
  const transition = useRef(false);
  const crane = useRef(false);
  const previousSelection = useRef<CameraSelection>(selection);
  const followed = useRef<number | undefined>(undefined);
  // Until the visitor takes the camera, the aerial view travels slowly along the arterial.
  const drift = useRef({ active: false, time: 0, offset: 0 });

  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    controls.target.set(...aerialTarget);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.enablePan = false;
    controls.minDistance = 58;
    controls.maxDistance = 1300;
    controls.minPolarAngle = Math.PI / 12;
    controls.maxPolarAngle = (Math.PI * 80) / 180;
    controls.update();
    const interrupt = () => {
      transition.current = false;
      drift.current.active = false;
    };
    controls.addEventListener("start", interrupt);
    orbit.current = controls;
    return () => {
      orbit.current = null;
      controls.removeEventListener("start", interrupt);
      controls.dispose();
    };
  }, [camera, gl]);

  useEffect(() => {
    const junction = junctions.find(({ id }) => id === selection);
    crane.current = previousSelection.current === "street" && selection === "aerial";
    previousSelection.current = selection;
    if (junction) {
      preset.position.set(junction.x - 69, 72, junction.z + 77);
      preset.target.set(junction.x + 4, 0.7, junction.z - 5);
    } else if (selection === "street") {
      preset.position.set(...streetPosition);
      preset.target.set(...streetTarget);
    } else {
      preset.position.set(...aerialPosition);
      preset.target.set(...aerialTarget);
    }
    drift.current = {
      active: selection === "aerial" && !reducedMotion,
      time: 0,
      offset: 0,
    };
    transition.current = true;
    followed.current = vehicle?.id;
  }, [selection, preset, reducedMotion, vehicle]);

  useFrame((_, delta) => {
    const controls = orbit.current;
    if (!controls) return;
    const following = selection === "ride" || selection === "ambulance";
    const rate = reducedMotion ? 1 : 1 - Math.exp(-4.9 * delta);
    const perspective = camera instanceof PerspectiveCamera ? camera : null;
    const stream = host.current?.streams[selection === "ride" ? (vehicle?.side ?? 1) : 1];
    const snapshot = stream?.current;
    if (following && stream && snapshot) {
      let offset =
        followed.current === undefined ? undefined : snapshot.index.get(followed.current);
      if (offset === undefined) {
        const cls = selection === "ambulance" ? 5 : 0;
        const positions = snapshot.positions;
        let distance = Infinity;
        for (let index = 0; index < snapshot.count * SNAPSHOT_STRIDE; index += SNAPSHOT_STRIDE) {
          if (positions[index + 5] !== cls) continue;
          const candidate = Math.abs(positions[index] - aerialTarget[0]);
          if (candidate < distance) {
            distance = candidate;
            offset = index;
          }
        }
        if (offset !== undefined) followed.current = positions[offset + 6];
      }
      if (offset !== undefined) {
        controls.enabled = false;
        controls.minDistance = 1;
        const p = snapshot.positions;
        const previous = stream.previous;
        const old = previous?.index.get(p[offset + 6]);
        let x = p[offset];
        let z = p[offset + 1];
        if (!paused && previous && old !== undefined) {
          const period = Math.max(1, ((snapshot.tick - previous.tick) * DT * 1000) / speed);
          const progress = Math.min(1, (performance.now() - stream.receivedAt) / period);
          x = previous.positions[old] + (x - previous.positions[old]) * progress;
          z = previous.positions[old + 1] + (z - previous.positions[old + 1]) * progress;
        }
        const dx = p[offset + 2];
        const dz = p[offset + 3];
        const behind = VEHICLE_CLASSES[p[offset + 5]].length / 2 + 5;
        const sideways = 1.8;
        preset.position.set(x - behind * dx + sideways * dz, 1.4, z - behind * dz - sideways * dx);
        preset.target.set(x + 24 * dx, 1.1, z + 24 * dz);
        camera.position.lerp(preset.position, rate);
        controls.target.lerp(preset.target, rate);
        if (perspective && Math.abs(perspective.fov - 70) > 0.05) {
          perspective.fov += (70 - perspective.fov) * rate;
          perspective.updateProjectionMatrix();
        }
        camera.lookAt(controls.target);
        return;
      }
    }
    controls.enabled = true;
    controls.minDistance = 58;
    if (perspective && Math.abs(perspective.fov - 35) > 0.05) {
      perspective.fov += (35 - perspective.fov) * rate;
      perspective.updateProjectionMatrix();
    }
    if (transition.current) {
      const step = crane.current && !reducedMotion ? 1 - Math.exp(-craneSpeed * delta) : rate;
      camera.position.lerp(preset.position, step);
      controls.target.lerp(preset.target, step);
      if (
        camera.position.distanceToSquared(preset.position) < 0.006 &&
        controls.target.distanceToSquared(preset.target) < 0.006
      )
        transition.current = false;
    } else if (drift.current.active) {
      const state = drift.current;
      state.time += Math.min(delta, 0.1);
      const offset = Math.sin(state.time * driftRate) * driftReach;
      camera.position.x += offset - state.offset;
      controls.target.x += offset - state.offset;
      state.offset = offset;
    }
    controls.update();
  }, -1);
  return null;
}

function MoodController({
  mood,
  rain,
  reducedMotion,
}: {
  mood: Mood;
  rain: boolean;
  reducedMotion: boolean;
}) {
  const scene = useThree((state) => state.scene);
  const hemisphere = useRef<HemisphereLight>(null);
  const sun = useRef<DirectionalLight>(null);
  const [background] = useState(() => new Color());
  const [fog] = useState(() => new FogExp2("#000", 0));
  const first = useRef(true);
  useEffect(() => {
    scene.background = background;
    scene.fog = fog;
  }, [scene, background, fog]);
  useFrame((_, delta) => {
    const target = moodTarget(mood, rain);
    if (first.current || reducedMotion) {
      first.current = false;
      snapMood(target);
    } else blendMood(target, 1 - Math.exp(-2.2 * Math.min(delta, 0.1)));
    background.copy(currentMood.sky);
    fog.color.copy(currentMood.fog);
    fog.density = currentMood.fogDensity;
    if (hemisphere.current) {
      hemisphere.current.color.copy(currentMood.hemiSky);
      hemisphere.current.groundColor.copy(currentMood.hemiGround);
      hemisphere.current.intensity = currentMood.hemi;
    }
    if (sun.current) {
      sun.current.color.copy(currentMood.sun);
      sun.current.intensity = currentMood.sunIntensity;
      sun.current.position.set(currentMood.sunX, currentMood.sunY, currentMood.sunZ);
    }
  }, -2);
  return (
    <>
      <hemisphereLight ref={hemisphere} />
      <directionalLight ref={sun} />
    </>
  );
}

function ContextRecovery({ onContext }: { onContext: SceneProps["onContext"] }) {
  const canvas = useThree((state) => state.gl.domElement);
  useEffect(() => {
    const lost = (event: Event) => {
      event.preventDefault();
      onContext("lost");
    };
    const restored = () => onContext("restored");
    canvas.addEventListener("webglcontextlost", lost);
    canvas.addEventListener("webglcontextrestored", restored);
    return () => {
      canvas.removeEventListener("webglcontextlost", lost);
      canvas.removeEventListener("webglcontextrestored", restored);
    };
  }, [canvas, onContext]);
  return null;
}

function PostProcessing({ quality }: { quality: Quality }) {
  const { camera, gl, scene, size, viewport } = useThree();
  const ref = useRef<{
    composer: EffectComposer;
    bloom: BloomEffect;
    vignette: VignetteEffect;
  } | null>(null);

  useEffect(() => {
    const composer = new EffectComposer(gl, { frameBufferType: HalfFloatType, multisampling: 0 });
    const bloom = new BloomEffect({
      blendFunction: BlendFunction.ADD,
      luminanceThreshold: 0.54,
      luminanceSmoothing: 0.17,
      mipmapBlur: true,
      intensity: 0.8,
      radius: 0.76,
      levels: quality === "low" ? 4 : 6,
    });
    const vignette = new VignetteEffect({ offset: 0.19, darkness: 0.5 });
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(
      new EffectPass(
        camera,
        bloom,
        vignette,
        new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }),
      ),
    );
    if (quality !== "low")
      composer.addPass(
        new EffectPass(camera, quality === "high" ? new SMAAEffect() : new FXAAEffect()),
      );
    ref.current = { composer, bloom, vignette };
    return () => {
      ref.current = null;
      composer.dispose();
    };
  }, [camera, gl, scene, quality]);

  useEffect(() => {
    if (!ref.current || size.width < 1 || size.height < 1) return;
    const { composer, bloom } = ref.current;
    const scale = Math.sqrt(qualityPresets[quality].bloomScale) * viewport.dpr;
    composer.setSize(size.width, size.height, false);
    bloom.mipmapBlurPass.setSize(Math.ceil(size.width * scale), Math.ceil(size.height * scale));
  }, [quality, size.width, size.height, viewport.dpr]);

  useFrame((state, delta) => {
    if (ref.current) {
      ref.current.bloom.luminanceMaterial.threshold = currentMood.bloomThreshold;
      ref.current.bloom.intensity = currentMood.bloomIntensity;
      ref.current.vignette.darkness = currentMood.vignette;
    }
    if (ref.current) ref.current.composer.render(delta);
    else state.gl.render(state.scene, state.camera);
  }, 1);
  return null;
}

function QualityProbe({
  automatic,
  ready,
  quality,
  onQuality,
}: {
  automatic: boolean;
  ready: boolean;
  quality: Quality;
  onQuality: (quality: Quality) => void;
}) {
  const probe = useRef({ elapsed: 0, duration: 0, frames: -8, checks: 0, waitUntil: 0 });
  useEffect(() => {
    if (automatic) probe.current = { elapsed: 0, duration: 0, frames: -8, checks: 0, waitUntil: 0 };
  }, [automatic]);
  useFrame((_, delta) => {
    if (!automatic || !ready || document.hidden || probe.current.checks === 2) return;
    const sample = probe.current;
    const time = Math.min(delta, 0.25);
    sample.elapsed += time;
    if (sample.elapsed < sample.waitUntil) return;
    sample.frames += 1;
    if (sample.frames <= 0) return;
    sample.duration += time;
    if (sample.frames < 90) return;
    const mean = sample.duration / sample.frames;
    if (mean > 0.028 && quality !== "low") onQuality(quality === "high" ? "medium" : "low");
    else if (mean < 0.012 && quality === "medium") onQuality("high");
    sample.checks += 1;
    sample.duration = 0;
    sample.frames = 0;
    sample.waitUntil = sample.elapsed + 5;
  });
  return null;
}

export function NightCorridor({
  active,
  automatic,
  camera,
  onQuality,
  host,
  wipe,
  singleView,
  overlay,
  events,
  tick,
  vehicle,
  onRoadPick,
  onContext,
  ready,
  paused,
  quality,
  reducedMotion,
  speed,
  mood,
  rain,
}: SceneProps) {
  const tier = qualityPresets[quality];
  return (
    <Canvas
      className="scene-canvas"
      style={{ position: "absolute", inset: 0 }}
      frameloop={active ? "always" : "never"}
      dpr={[0.75, tier.dpr]}
      gl={{
        antialias: false,
        alpha: false,
        powerPreference: "high-performance",
        toneMapping: NoToneMapping,
      }}
      camera={{ position: [...aerialPosition], fov: 35, near: 0.8, far: 3400 }}
      onCreated={({ camera: sceneCamera }) => {
        if (sceneCamera instanceof PerspectiveCamera) sceneCamera.lookAt(...aerialTarget);
      }}
      aria-label="Oblique aerial view of the illuminated corridor"
      role="img"
    >
      <MoodController mood={mood} rain={rain} reducedMotion={reducedMotion} />
      <StaticDistrict lowDetail={quality === "low"} />
      <SimulationTraffic
        host={host}
        paused={paused}
        speed={speed}
        quality={quality}
        wipe={wipe}
        singleView={singleView}
        overlay={overlay}
        aerial={camera === "aerial"}
        reducedMotion={reducedMotion}
      />
      <EventMarkers events={events} tick={tick} />
      <RoadPicker onPick={onRoadPick} />
      <CorridorCamera
        selection={camera}
        reducedMotion={reducedMotion}
        host={host}
        vehicle={vehicle}
        paused={paused}
        speed={speed}
      />
      <ContextRecovery onContext={onContext} />
      <QualityProbe automatic={automatic} ready={ready} quality={quality} onQuality={onQuality} />
      <PostProcessing quality={quality} />
    </Canvas>
  );
}
