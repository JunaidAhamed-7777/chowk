import { BRAKING_FLAG, corridor, DT, SNAPSHOT_STRIDE, VEHICLE_CLASSES } from "@chowk/sim";
import { useFrame } from "@react-three/fiber";
import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AdditiveBlending,
  BoxGeometry,
  type BufferAttribute,
  Color,
  DynamicDrawUsage,
  type InstancedMesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  type PerspectiveCamera,
  PlaneGeometry,
  ShaderMaterial,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { fadeMs, type SnapshotStream } from "../sim/SimHost";
import { district } from "./corridorGeometry";
import { createGlow, type Glow } from "./glow";
import { createMarkers } from "./overlayMarkers";
import {
  type OverlayMode,
  type PlaybackSpeed,
  peopleColors,
  peopleMetresPerRootPerson,
  speedBand,
  speedBands,
} from "./sceneSettings";
import { useVehicleGeometries } from "./vehicleGeometries";
import { clipMaterial, type WipeClip } from "./wipeClip";

const style = [
  { height: 1.02, roof: 0.28, color: "#576676" },
  { height: 1.78, roof: 0.6, color: "#749878" },
  { height: 1.52, roof: 0.58, color: "#738da5" },
  { height: 2.35, roof: 0.63, color: "#c4b8a0" },
  { height: 3.12, roof: 0.89, color: "#ae7860" },
  { height: 2.45, roof: 0.65, color: "#d3c4aa" },
] as const;

// Body paint per class, picked by vehicle id so a vehicle keeps its colour.
const paints = [
  ["#1b1d22", "#7a1418", "#17325e", "#c9ccd1", "#3a3d44"],
  ["#d6a514", "#d6a514", "#2f7d46", "#d6a514"],
  ["#d9dde2", "#9aa1a9", "#3b4048", "#14161a", "#7d1a1c", "#1c3d73", "#c9c2b0"],
  ["#d8d6cf", "#b9b29e", "#2c4f7a", "#c9ccd1"],
  ["#b3261e", "#1f5fa8", "#2a7f52", "#c96a1a"],
  ["#e8eaed"],
].map((palette) => palette.map((hex) => new Color(hex)));
const signs = [
  new Color(0, 0, 0),
  new Color(2.2, 1.5, 0.2),
  new Color(0, 0, 0),
  new Color(0, 0, 0),
  new Color(2.6, 1.3, 0.25),
  new Color(0.2, 0.5, 6),
];
const beaconRed = new Color(6, 0.2, 0.15);
const beaconBlue = new Color(0.2, 0.5, 6);
const ambulanceClass = 5;
const busClass = 4;
const occupancyColor = new Color("#9decca");
const bandColors = speedBands.map(({ color }) => new Color(color));
const waitingColor = new Color(peopleColors.waiting);
const movingColor = new Color(peopleColors.moving);
// Overlay markers float above the tallest roof, and keep at least this many pixels per metre.
const markerHeight = 5.2;
const speedMarkerMetres = 3.4;
const markerMinPixelsPerMetre = 2.2;
const overlayFadeSeconds = 0.3;

function fadeOverlay(current: number, enabled: boolean, change: number) {
  return enabled ? Math.min(1, current + change) : Math.max(0, current - change);
}

/** Standard material that reads the model's mask attribute for trim, glass and lamps. */
function makeVehicleMaterial(cls: number) {
  const material = new MeshStandardMaterial({ roughness: 0.44, metalness: 0.3 });
  const sign = { value: signs[cls].clone() };
  const cabin = { value: cls === busClass ? 0.7 : 0.05 };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.signColor = sign;
    shader.uniforms.cabinGlow = cabin;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute vec3 mask; varying vec3 paintMask;",
      )
      .replace("#include <begin_vertex>", "#include <begin_vertex>\npaintMask = mask;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 paintMask; uniform vec3 signColor; uniform float cabinGlow;",
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
      float lamp = step(.5, max(paintMask.r, max(paintMask.g, paintMask.b)));
      float trim = step(.2, min(paintMask.r, min(paintMask.g, paintMask.b)));
      float glass = trim * step(.08, paintMask.b - paintMask.r);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.03, .034, .042), max(trim, lamp));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.05, .075, .11), glass);`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
      totalEmissiveRadiance += step(.5, paintMask.g) * vec3(5., 4., 2.6);
      totalEmissiveRadiance += step(.5, paintMask.r) * vec3(2.4, .04, .03);
      totalEmissiveRadiance += step(.5, paintMask.b) * signColor;
      totalEmissiveRadiance += glass * cabinGlow * vec3(1., .72, .4);`,
      );
  };
  return { material, sign };
}

const lamps = [
  new Color(3.1, 0.054, 0.025),
  new Color(4.6, 1.69, 0.03),
  new Color(0.055, 3.6, 1.12),
];
const darkLamp = new Color("#151b23");
const headlightColor = new Color(6.4, 4.85, 2.95);
const tailLight = new Color(2.85, 0.032, 0.023);
const brakeLight = new Color(8.4, 0.057, 0.034);
const headGlow = [2.3, 1.85, 1.2] as const;
const tailGlow = [1.5, 0.05, 0.03] as const;
const brakeGlow = [3.4, 0.09, 0.05] as const;
const signalGlow = [
  [3.2, 0.1, 0.06],
  [3.4, 1.5, 0.05],
  [0.08, 3.2, 1.1],
] as const;
const signalLampHeight = 4.95;
const updateRanges = new WeakMap<BufferAttribute, { start: number; count: number }>();

function prepareUpload(attribute: BufferAttribute) {
  attribute.setUsage(DynamicDrawUsage);
  updateRanges.set(attribute, { start: 0, count: 0 });
}

function upload(attribute: BufferAttribute, count: number) {
  const range = updateRanges.get(attribute);
  if (!range || count === 0) return;
  range.count = count;
  attribute.updateRanges[0] = range;
  attribute.needsUpdate = true;
}

function uploadTransforms(mesh: InstancedMesh, count: number) {
  mesh.count = count;
  upload(mesh.instanceMatrix, count * 16);
}

function makeFallbackGeometries() {
  return VEHICLE_CLASSES.map(({ length, width }, cls) => {
    const { height, roof } = style[cls];
    const base = new BoxGeometry(width, height - roof, length).translate(0, (height - roof) / 2, 0);
    const cabin = new BoxGeometry(
      width * 0.84,
      roof,
      length * (length > 5 ? 0.88 : 0.57),
    ).translate(0, height - roof / 2, 0);
    const geometry = mergeGeometries([base, cabin]);
    base.dispose();
    cabin.dispose();
    return geometry;
  });
}

function drawVehicle(
  matrix: Object3D,
  mesh: InstancedMesh,
  heads: InstancedMesh,
  tails: InstancedMesh,
  beams: InstancedMesh | null,
  glow: Glow,
  instance: number,
  lampIndex: number,
  x: number,
  z: number,
  dx: number,
  dz: number,
  cls: number,
  flags: number,
  fade: number,
  id: number,
  velocity: number,
  speedTint: number,
  peopleTint: number,
  color: Color,
) {
  const { length, width } = VEHICLE_CLASSES[cls];
  const headlight = length * 0.5 + 0.034;
  const lampSize = width < 1 ? 0.24 : 0.34;
  const lateral = width < 1 ? 0 : width * 0.31;
  const brake = (flags & BRAKING_FLAG) !== 0;
  matrix.rotation.y = Math.atan2(-dx, -dz);
  matrix.position.set(x, 0, z);
  matrix.scale.setScalar(fade);
  matrix.updateMatrix();
  mesh.setMatrixAt(instance, matrix.matrix);
  const palette = paints[cls];
  const occupancy = VEHICLE_CLASSES[cls].occupancy;
  color.copy(palette[id % palette.length]);
  if (speedTint > 0) color.lerp(bandColors[speedBand(velocity)], speedTint);
  if (peopleTint > 0 && occupancy > 8) color.lerp(occupancyColor, peopleTint);
  mesh.setColorAt(instance, color);

  matrix.scale.set(lampSize * fade, lampSize * fade, 0.22 * fade);
  for (let light = 0; light < 2; light += 1) {
    const side = (light === 0 ? -lateral : lateral) * fade;
    const forward = headlight * fade;
    matrix.position.set(x + side * dz + forward * dx, 0.53 * fade, z - side * dx + forward * dz);
    matrix.updateMatrix();
    heads.setMatrixAt(lampIndex + light, matrix.matrix);
    matrix.position.set(x + side * dz - forward * dx, 0.58 * fade, z - side * dx - forward * dz);
    matrix.updateMatrix();
    tails.setMatrixAt(lampIndex + light, matrix.matrix);
    tails.setColorAt(lampIndex + light, brake ? brakeLight : tailLight);
  }

  // One halo at each end keeps the vehicle readable when its lamps are sub-pixel.
  const forward = headlight * fade;
  const rear = brake ? brakeGlow : tailGlow;
  const { positions, colors } = glow;
  const base = lampIndex * 3;
  const emphasis = 1 + Math.min(1.3, occupancy / 22) * peopleTint;
  positions[base] = x + forward * dx;
  positions[base + 1] = 0.62;
  positions[base + 2] = z + forward * dz;
  positions[base + 3] = x - forward * dx;
  positions[base + 4] = 0.66;
  positions[base + 5] = z - forward * dz;
  for (let channel = 0; channel < 3; channel += 1) {
    colors[base + channel] = headGlow[channel] * fade * emphasis;
    colors[base + 3 + channel] = rear[channel] * fade * emphasis;
  }

  if (beams) {
    matrix.position.set(x + forward * dx, 0.04, z + forward * dz);
    matrix.scale.set((width + 1.5) * fade, 1, (width < 1 ? 7.5 : 11) * fade);
    matrix.updateMatrix();
    beams.setMatrixAt(lampIndex / 2, matrix.matrix);
  }
}

function makeBeam() {
  // Unit quad on the road, reaching from the bumper along local -Z, the forward axis of a vehicle.
  const geometry = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, -0.5);
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
    vertexShader: `
      varying vec2 beamUV;
      void main() {
        beamUV = uv;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.);
      }`,
    fragmentShader: `
      varying vec2 beamUV;
      void main() {
        float reach = beamUV.y;
        float spread = mix(.34, 1., reach);
        float across = 1. - smoothstep(0., spread, abs(beamUV.x * 2. - 1.));
        float along = pow(1. - reach, 1.6) * smoothstep(0., .06, reach);
        gl_FragColor = vec4(vec3(.62, .5, .33) * across * along * .5, 1.);
      }`,
  });
  return { geometry, material };
}

export function TrafficMeshes({
  host,
  capacity,
  paused,
  speed,
  lowDetail,
  beamDetail,
  visible,
  overlay,
  clip,
}: {
  host: RefObject<SnapshotStream | null>;
  capacity: number;
  paused: boolean;
  speed: PlaybackSpeed;
  lowDetail: boolean;
  beamDetail: boolean;
  visible: boolean;
  overlay: OverlayMode;
  clip: WipeClip;
}) {
  const bodies = useRef<(InstancedMesh | null)[]>([]);
  const heads = useRef<InstancedMesh>(null);
  const tails = useRef<InstancedMesh>(null);
  const signalLamps = useRef<InstancedMesh>(null);
  const [matrix] = useState(() => new Object3D());
  const [color] = useState(() => new Color());
  const tint = useRef({ speed: 0, people: 0 });
  const [counts] = useState(() => new Uint16Array(VEHICLE_CLASSES.length));
  const [fallback] = useState(makeFallbackGeometries);
  const beams = useRef<InstancedMesh>(null);
  const [finishes] = useState(() =>
    VEHICLE_CLASSES.map((_, cls) => {
      const finish = makeVehicleMaterial(cls);
      clipMaterial(finish.material, clip);
      return finish;
    }),
  );
  const [beam] = useState(() => {
    const beam = makeBeam();
    clipMaterial(beam.material, clip);
    return beam;
  });
  const [vehicleGlow] = useState(() => {
    const glow = createGlow(capacity * 2, 1.6, 3.7);
    clipMaterial(glow.points.material, clip);
    return glow;
  });
  const [markers] = useState(() => {
    const layer = createMarkers(capacity, markerMinPixelsPerMetre);
    clipMaterial(layer.points.material, clip);
    return layer;
  });
  const [signalHalo] = useState(() => {
    const glow = createGlow(district.signalMounts.length, 3.4, 4.5);
    clipMaterial(glow.points.material, clip);
    return glow;
  });
  const [lampMaterials] = useState(() => [
    clipMaterial(new MeshBasicMaterial({ color: headlightColor, toneMapped: false }), clip),
    clipMaterial(new MeshBasicMaterial({ toneMapped: false }), clip),
    clipMaterial(new MeshBasicMaterial({ toneMapped: false }), clip),
  ]);
  const models = useVehicleGeometries(lowDetail);
  const lastSignalTick = useRef(-1);
  const lastSettledTick = useRef(-1);
  const lampsCount = district.signalMounts.length * 3;

  useEffect(
    () => () => {
      for (const geometry of fallback) geometry.dispose();
      for (const { material } of finishes) material.dispose();
      beam.geometry.dispose();
      beam.material.dispose();
      vehicleGlow.dispose();
      markers.dispose();
      signalHalo.dispose();
      for (const material of lampMaterials) material.dispose();
    },
    [fallback, beam, finishes, vehicleGlow, markers, signalHalo, lampMaterials],
  );

  useLayoutEffect(() => {
    const signals = signalLamps.current;
    const tail = tails.current;
    if (!signals || !tail) return;
    for (const mesh of bodies.current) {
      if (!mesh) continue;
      prepareUpload(mesh.instanceMatrix);
      mesh.setColorAt(0, paints[0][0]);
      if (mesh.instanceColor) prepareUpload(mesh.instanceColor);
    }
    if (heads.current) prepareUpload(heads.current.instanceMatrix);
    if (beams.current) prepareUpload(beams.current.instanceMatrix);
    for (const [index, mount] of district.signalMounts.entries()) {
      signalHalo.positions[index * 3] = mount.x;
      signalHalo.positions[index * 3 + 1] = signalLampHeight - 0.38;
      signalHalo.positions[index * 3 + 2] = mount.z;
    }
    prepareUpload(tail.instanceMatrix);
    for (let index = 0; index < capacity * 2; index += 1) tail.setColorAt(index, tailLight);
    for (const [index, mount] of district.signalMounts.entries()) {
      matrix.rotation.y = mount.yaw;
      matrix.scale.set(0.14, 0.27, 0.26);
      for (let lamp = 0; lamp < 3; lamp += 1) {
        matrix.position.set(mount.x, signalLampHeight - lamp * 0.38, mount.z);
        matrix.updateMatrix();
        signals.setMatrixAt(index * 3 + lamp, matrix.matrix);
        signals.setColorAt(index * 3 + lamp, darkLamp);
      }
    }
    if (tail.instanceColor) prepareUpload(tail.instanceColor);
    if (signals.instanceColor) signals.instanceColor.needsUpdate = true;
    signals.instanceMatrix.needsUpdate = true;
    signals.computeBoundingSphere();
  }, [capacity, matrix, signalHalo]);

  useLayoutEffect(() => {
    if (beamDetail && !lowDetail && beams.current) prepareUpload(beams.current.instanceMatrix);
    lastSettledTick.current = -1;
  }, [beamDetail, lowDetail]);

  useFrame((state, delta) => {
    if (!visible) return;
    const currentHost = host.current;
    const view = state.camera as PerspectiveCamera;
    const pixelsPerUnit =
      (state.size.height * state.viewport.dpr) / (2 * Math.tan((view.fov * Math.PI) / 360));
    const beamMesh = beams.current;
    const head = heads.current;
    const tail = tails.current;
    const signals = signalLamps.current;
    const current = currentHost?.current;
    if (!currentHost || !current || !head || !tail || !signals) return;
    const now = performance.now();
    const previous = currentHost.previous;
    const age = now - currentHost.receivedAt;
    const sampleTime = Math.max(
      1,
      ((current.tick - (previous?.tick ?? current.tick)) * DT * 1000) / speed,
    );
    const mix = !previous || paused ? 1 : Math.min(age / sampleTime, 1);
    const speedTint = fadeOverlay(
      tint.current.speed,
      overlay === "speed",
      delta / overlayFadeSeconds,
    );
    const peopleTint = fadeOverlay(
      tint.current.people,
      overlay === "people",
      delta / overlayFadeSeconds,
    );
    if (
      mix === 1 &&
      age >= fadeMs &&
      lastSettledTick.current === current.tick &&
      tint.current.speed === speedTint &&
      tint.current.people === peopleTint
    )
      return;
    tint.current.speed = speedTint;
    tint.current.people = peopleTint;
    if (mix === 1 && age >= fadeMs) lastSettledTick.current = current.tick;
    counts.fill(0);
    const points = current.positions;
    let drawn = 0;
    // Speed and People each draw a marker above every vehicle; while one fades into the other,
    // the stronger one decides what the markers show.
    const markerOpacity = Math.max(speedTint, peopleTint);
    const showSpeed = speedTint >= peopleTint;
    let marked = 0;
    for (let offset = 0; offset < current.count * SNAPSHOT_STRIDE; offset += SNAPSHOT_STRIDE) {
      const cls = points[offset + 5];
      const mesh = bodies.current[cls];
      if (!mesh) continue;
      const id = points[offset + 6];
      const bornAt = currentHost.births.get(id);
      const fade = bornAt === undefined ? 1 : Math.min((now - bornAt) / fadeMs, 1);
      let x = points[offset];
      let z = points[offset + 1];
      let dx = points[offset + 2];
      let dz = points[offset + 3];
      const oldOffset = previous?.index.get(id);
      if (mix < 1 && previous && oldOffset !== undefined) {
        const old = previous.positions;
        x = old[oldOffset] + mix * (x - old[oldOffset]);
        z = old[oldOffset + 1] + mix * (z - old[oldOffset + 1]);
        const headingX = old[oldOffset + 2] + mix * (dx - old[oldOffset + 2]);
        const headingZ = old[oldOffset + 3] + mix * (dz - old[oldOffset + 3]);
        const headingLength = Math.hypot(headingX, headingZ);
        if (headingLength > 0.01) {
          dx = headingX / headingLength;
          dz = headingZ / headingLength;
        }
      }
      drawVehicle(
        matrix,
        mesh,
        head,
        tail,
        beamMesh,
        vehicleGlow,
        counts[cls]++,
        drawn++ * 2,
        x,
        z,
        dx,
        dz,
        cls,
        points[offset + 7],
        fade,
        id,
        points[offset + 4],
        speedTint,
        peopleTint,
        color,
      );
      if (markerOpacity > 0) {
        const occupancy = VEHICLE_CLASSES[cls].occupancy;
        const metres = showSpeed
          ? speedMarkerMetres
          : peopleMetresPerRootPerson * Math.sqrt(occupancy);
        if (metres > 0) {
          const velocity = points[offset + 4];
          const tone = showSpeed
            ? bandColors[speedBand(velocity)]
            : velocity < speedBands[0].upTo
              ? waitingColor
              : movingColor;
          const base = marked * 3;
          markers.positions[base] = x;
          markers.positions[base + 1] = markerHeight;
          markers.positions[base + 2] = z;
          markers.tints[base] = tone.r;
          markers.tints[base + 1] = tone.g;
          markers.tints[base + 2] = tone.b;
          markers.sizes[marked] = metres * fade;
          marked++;
        }
      }
    }
    const departures = currentHost.departures;
    for (let index = 0; index < departures.length && drawn < capacity; index += 1) {
      const vehicle = departures[index];
      const fade = 1 - (now - vehicle.time) / fadeMs;
      const mesh = bodies.current[vehicle.cls];
      if (fade <= 0 || !mesh) continue;
      drawVehicle(
        matrix,
        mesh,
        head,
        tail,
        beamMesh,
        vehicleGlow,
        counts[vehicle.cls]++,
        drawn++ * 2,
        vehicle.x,
        vehicle.z,
        vehicle.dx,
        vehicle.dz,
        vehicle.cls,
        vehicle.flags,
        fade,
        vehicle.id,
        0,
        speedTint,
        peopleTint,
        color,
      );
    }

    for (let cls = 0; cls < bodies.current.length; cls += 1) {
      const mesh = bodies.current[cls];
      if (!mesh) continue;
      uploadTransforms(mesh, counts[cls]);
      if (mesh.instanceColor) upload(mesh.instanceColor, counts[cls] * 3);
    }
    // The ambulance beacon alternates red and blue twice a second.
    finishes[ambulanceClass].sign.value.copy(
      Math.floor(now / 250) % 2 === 0 ? beaconRed : beaconBlue,
    );
    uploadTransforms(head, drawn * 2);
    uploadTransforms(tail, drawn * 2);
    if (beamMesh) uploadTransforms(beamMesh, drawn);
    vehicleGlow.commit(drawn * 2, pixelsPerUnit);
    markers.commit(marked, pixelsPerUnit, markerOpacity);
    if (tail.instanceColor) upload(tail.instanceColor, drawn * 6);

    if (lastSignalTick.current === current.tick) return;
    lastSignalTick.current = current.tick;
    for (let index = 0; index < district.signalMounts.length; index += 1) {
      const mount = district.signalMounts[index];
      const phase = current.signals[mount.junction * 2];
      const state = current.signals[mount.junction * 2 + 1];
      const approaches = corridor.junctions[mount.junction].phases[phase]?.approaches;
      const lit = state === 2 || !approaches?.includes(mount.link) ? 0 : state === 1 ? 1 : 2;
      for (let lamp = 0; lamp < 3; lamp += 1) {
        signals.setColorAt(index * 3 + lamp, lamp === lit ? lamps[lamp] : darkLamp);
      }
      for (let channel = 0; channel < 3; channel += 1) {
        signalHalo.colors[index * 3 + channel] = signalGlow[lit][channel];
      }
    }
    signalHalo.commit(district.signalMounts.length, pixelsPerUnit);
    if (signals.instanceColor) signals.instanceColor.needsUpdate = true;
  });

  return (
    <group visible={visible}>
      {VEHICLE_CLASSES.map(({ id }, cls) => (
        <instancedMesh
          key={id}
          ref={(mesh) => {
            bodies.current[cls] = mesh;
          }}
          args={[undefined, undefined, capacity]}
          geometry={models[cls] ?? fallback[cls]}
          material={finishes[cls].material}
          count={0}
          frustumCulled={false}
        />
      ))}
      <instancedMesh
        ref={heads}
        args={[undefined, undefined, capacity * 2]}
        material={lampMaterials[0]}
        count={0}
        frustumCulled={false}
      >
        <boxGeometry />
      </instancedMesh>
      <instancedMesh
        ref={tails}
        args={[undefined, undefined, capacity * 2]}
        material={lampMaterials[1]}
        count={0}
        frustumCulled={false}
      >
        <boxGeometry />
      </instancedMesh>
      <instancedMesh
        ref={signalLamps}
        args={[undefined, undefined, lampsCount]}
        material={lampMaterials[2]}
      >
        <boxGeometry />
      </instancedMesh>
      {beamDetail && (
        <instancedMesh
          ref={beams}
          args={[beam.geometry, beam.material, capacity]}
          count={0}
          frustumCulled={false}
          renderOrder={1}
        />
      )}
      <primitive object={vehicleGlow.points} />
      <primitive object={markers.points} />
      <primitive object={signalHalo.points} />
    </group>
  );
}
