import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AdditiveBlending,
  type BufferGeometry,
  Color,
  type InstancedMesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  ShaderMaterial,
  Vector3,
} from "three";
import type { Box } from "./corridorGeometry";
import { district } from "./corridorGeometry";
import { currentMood, moodUniforms } from "./moodLighting";
import { loadMeshAsset } from "./vehicleGeometries";

function buildingMaterial() {
  const material = new MeshStandardMaterial({ roughness: 0.94, metalness: 0 });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.windowLevel = moodUniforms.windows;
    shader.uniforms.facadeTint = moodUniforms.facadeTint;
    shader.uniforms.facadeMix = moodUniforms.facadeMix;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 facadePoint; varying vec3 facadeNormal; varying vec2 buildingSeed;",
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
      facadePoint = (instanceMatrix * vec4(position, 1.0)).xyz;
      buildingSeed = instanceMatrix[3].xz;
      facadeNormal = normal;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
      varying vec3 facadePoint; varying vec3 facadeNormal; varying vec2 buildingSeed;
      uniform float windowLevel;
      uniform vec3 facadeTint;
      uniform float facadeMix;
      float windowHash(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * .1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }
      // Weathered limewash and distemper colours common on Indian street frontages.
      vec3 facadePaint(float h) {
        if (h < .16) return vec3(.95, .90, .80);
        if (h < .28) return vec3(.90, .74, .48);
        if (h < .37) return vec3(.82, .56, .44);
        if (h < .46) return vec3(.68, .82, .74);
        if (h < .55) return vec3(.64, .76, .86);
        if (h < .64) return vec3(.93, .70, .62);
        if (h < .74) return vec3(.95, .87, .60);
        if (h < .80) return vec3(.78, .72, .84);
        return vec3(.92, .92, .89);
      }
      vec3 shutterPaint(float h) {
        if (h < .25) return vec3(.42, .45, .48);
        if (h < .45) return vec3(.18, .38, .60);
        if (h < .60) return vec3(.62, .22, .20);
        if (h < .75) return vec3(.20, .46, .32);
        return vec3(.70, .56, .22);
      }`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
      float side = 1.0 - step(.6, abs(facadeNormal.y));
      float along = mix(facadePoint.x, facadePoint.z, step(.6, abs(facadeNormal.x)));
      float buildingType = windowHash(buildingSeed * .037);
      vec3 paint = facadePaint(windowHash(buildingSeed * .071 + 3.7));
      vec3 daylight = facadeTint * paint * mix(.98, 1.22, windowHash(buildingSeed * .113));
      // Monsoon streaks below each window bay and a darker plinth.
      float streak = windowHash(vec2(floor(along * .8), buildingSeed.x * .31));
      daylight *= mix(1., mix(.82, 1., smoothstep(.0, 9., facadePoint.y)), side * step(.55, streak));
      float street = side * (1.0 - step(3.8, facadePoint.y));
      vec3 shutters = shutterPaint(windowHash(vec2(floor(along / 3.2), buildingSeed.y * .17)));
      float shutterRib = .86 + .14 * step(.5, fract(facadePoint.y * 6.));
      daylight = mix(daylight, shutters * shutterRib * facadeTint * 1.25, street * step(.6, facadePoint.y));
      diffuseColor.rgb = mix(diffuseColor.rgb, daylight, facadeMix);
      diffuseColor.rgb *= mix(vec3(1.), mix(vec3(1.), paint * 1.08, .45), (1.0 - facadeMix) * side);
      vec2 grid = vec2(along / mix(2.3, 3.45, buildingType), facadePoint.y / mix(2.9, 3.65, buildingType));
      vec2 cell = floor(grid);
      vec2 uvWindow = fract(grid);
      float band = smoothstep(.20, .23, uvWindow.y) * (1.0 - smoothstep(.61, .68, uvWindow.y));
      float bay = smoothstep(.14, .18, uvWindow.x) * (1.0 - smoothstep(.75, .79, uvWindow.x));
      float mullion = smoothstep(.025, .075, abs(uvWindow.x - .49));
      float glass = side * band * bay * mix(.46, 1., mullion) * (1.0 - street);
      float randomWindow = windowHash(cell + buildingSeed * .68);
      float lit = step(mix(.79, .95, buildingType), randomWindow);
      float curb = smoothstep(.045, .09, abs(uvWindow.y - .9));
      diffuseColor.rgb *= mix(.59, 1.08, mix(1., curb, side));
      diffuseColor.rgb *= mix(1., .33, glass);
      diffuseColor.rgb += side * .006 * (1.0 - curb);`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
      vec3 warm = vec3(1., .52, .21);
      vec3 cool = vec3(.33, .65, .91);
      vec3 windowLight = mix(warm, cool, step(.70, windowHash(cell + buildingSeed * .43)));
      float strength = mix(.16, .95, windowHash(cell + buildingSeed * .18));
      totalEmissiveRadiance += glass * lit * strength * windowLight * windowLevel;`,
      );
  };
  return material;
}

function roadMaterial() {
  const material = new MeshStandardMaterial({ roughness: 0.88, metalness: 0.13 });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.wetness = moodUniforms.wet;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 roadPoint;")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nroadPoint = (instanceMatrix * vec4(position, 1.0)).xz;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec2 roadPoint;\nuniform float wetness;",
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
      vec2 grainPoint = floor(roadPoint * 12.);
      float grain = fract(52.9829189 * fract(dot(grainPoint, vec2(.06711056, .00583715))));
      diffuseColor.rgb *= mix(.80, 1.22, grain);
      // Wet asphalt darkens, with puddles where the grain is lowest.
      float puddle = smoothstep(.62, .18, grain) * wetness;
      diffuseColor.rgb *= mix(1., .55, wetness) * mix(1., .7, puddle);`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
      roughnessFactor = mix(roughnessFactor, .55, wetness);`,
      );
  };
  return material;
}

type BatchMaterial = MeshBasicMaterial | MeshStandardMaterial;

function BoxBatch({
  boxes,
  material,
  intensity = 1,
  geometry,
}: {
  boxes: Box[];
  material: BatchMaterial;
  intensity?: number;
  geometry?: BufferGeometry;
}) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const object = new Object3D();
    const color = new Color();
    for (const [i, entry] of boxes.entries()) {
      object.position.set(entry.x, entry.y, entry.z);
      object.scale.set(entry.width, entry.height, entry.depth);
      object.rotation.y = entry.yaw;
      object.updateMatrix();
      mesh.setMatrixAt(i, object.matrix);
      mesh.setColorAt(i, color.set(entry.color).multiplyScalar(intensity));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [boxes, intensity]);

  return (
    <instancedMesh ref={ref} args={[geometry, material, boxes.length]}>
      {!geometry && <boxGeometry args={[1, 1, 1]} />}
    </instancedMesh>
  );
}

const fittedAssets = new Map<string, BufferGeometry>();

function fitAsset(name: string, source: BufferGeometry): BufferGeometry {
  const fitted = fittedAssets.get(name);
  if (fitted) return fitted;
  source.computeBoundingBox();
  const bounds = source.boundingBox;
  if (!bounds) return source;
  const size = bounds.getSize(new Vector3());
  if (Math.min(size.x, size.y, size.z) <= 0) return source;
  const center = bounds.getCenter(new Vector3());
  const geometry = source.clone().translate(-center.x, -center.y, -center.z);
  geometry.scale(1 / size.x, 1 / size.y, 1 / size.z);
  fittedAssets.set(name, geometry);
  return geometry;
}

function KitBatch({
  asset,
  boxes,
  fallback,
  material,
  fitted = false,
  intensity,
}: {
  asset: string;
  boxes: Box[];
  fallback?: Box[];
  material: BatchMaterial;
  fitted?: boolean;
  intensity?: number;
}) {
  const [geometry, setGeometry] = useState<BufferGeometry>();
  useEffect(() => {
    let active = true;
    void loadMeshAsset(asset).then((source) => {
      if (active && source) setGeometry(fitted ? fitAsset(asset, source) : source);
    });
    return () => {
      active = false;
    };
  }, [asset, fitted]);
  const visible = geometry || fitted ? boxes : fallback;
  return visible?.length ? (
    <BoxBatch
      key={geometry?.uuid ?? "fallback"}
      boxes={visible}
      material={material}
      intensity={intensity}
      geometry={geometry}
    />
  ) : null;
}

function LightPools() {
  const ref = useRef<InstancedMesh>(null);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { poolLevel: moodUniforms.pools, wetness: moodUniforms.wet },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        vertexShader: `
      varying vec2 poolUV;
      uniform float wetness;
      void main() {
        poolUV = uv;
        // On a wet road each pool streaks towards the viewer, like a reflection.
        vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.);
        vec3 centre = (modelMatrix * instanceMatrix * vec4(0., 0., 0., 1.)).xyz;
        vec2 towards = normalize(cameraPosition.xz - centre.xz + vec2(1e-4));
        vec2 offset = world.xz - centre.xz;
        world.xz += towards * dot(offset, towards) * 1.4 * wetness;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
        fragmentShader: `
      varying vec2 poolUV;
      uniform float poolLevel;
      void main() {
        float radius = length(poolUV * 2. - 1.);
        float brightness = pow(1. - smoothstep(0., 1., radius), 2.3);
        gl_FragColor = vec4(.38, .17, .051, brightness * .4 * poolLevel * (1. + .35 * wetness));
      }`,
      }),
    [],
  );
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const object = new Object3D();
    object.rotation.x = -Math.PI / 2;
    for (const [i, light] of district.pools.entries()) {
      object.position.set(light.x, -0.02, light.z);
      object.scale.set(light.radius * 2, light.radius * 1.6, 1);
      object.updateMatrix();
      mesh.setMatrixAt(i, object.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, []);
  return (
    <instancedMesh ref={ref} args={[undefined, material, district.pools.length]}>
      <planeGeometry args={[1, 1]} />
    </instancedMesh>
  );
}

export function StaticDistrict({ lowDetail = false }: { lowDetail?: boolean }) {
  const materials = useMemo(
    () => ({
      asphalt: roadMaterial(),
      facade: buildingMaterial(),
      fixtures: new MeshStandardMaterial({ roughness: 0.85 }),
      emitters: new MeshBasicMaterial({ toneMapped: false }),
      ground: new MeshStandardMaterial({ roughness: 1 }),
    }),
    [],
  );

  useFrame(() => {
    materials.facade.color.setScalar(currentMood.facade);
    materials.asphalt.color.setScalar(currentMood.road);
    materials.fixtures.color.setScalar(Math.min(currentMood.facade, 1.8));
    materials.emitters.color.setScalar(currentMood.lamps);
    materials.ground.color.copy(currentMood.ground);
    moodUniforms.windows.value = currentMood.windows;
    moodUniforms.facadeTint.value.copy(currentMood.facadeTint);
    moodUniforms.facadeMix.value = currentMood.facadeMix;
    moodUniforms.pools.value = currentMood.pools;
    moodUniforms.wet.value = currentMood.wet;
  });

  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position={[900, -0.52, 0]}>
        <planeGeometry args={[6400, 4600]} />
        <primitive object={materials.ground} attach="material" />
      </mesh>
      <BoxBatch boxes={district.asphalt} material={materials.asphalt} />
      {lowDetail ? (
        <BoxBatch boxes={district.buildings} material={materials.facade} />
      ) : (
        Array.from(district.buildingKits, ([asset, boxes]) => (
          <KitBatch key={asset} asset={asset} boxes={boxes} material={materials.facade} fitted />
        ))
      )}
      <BoxBatch boxes={district.furniture} material={materials.fixtures} />
      {Array.from(district.streetKits, ([asset, { boxes, fallback }]) => (
        <KitBatch
          key={asset}
          asset={asset}
          boxes={boxes}
          fallback={fallback}
          material={materials.fixtures}
        />
      ))}
      <BoxBatch boxes={district.markings} material={materials.fixtures} />
      <BoxBatch boxes={district.lights} material={materials.emitters} intensity={4.2} />
      <BoxBatch boxes={district.signs} material={materials.emitters} intensity={1.4} />
      <KitBatch
        asset="prop_shopstrip"
        boxes={district.shopfronts}
        material={materials.emitters}
        intensity={1.4}
        fitted
      />
      <LightPools />
    </>
  );
}
