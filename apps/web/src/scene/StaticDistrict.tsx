import { useLayoutEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  Color,
  type InstancedMesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  ShaderMaterial,
} from "three";
import type { Box } from "./corridorGeometry";
import { district } from "./corridorGeometry";

function buildingMaterial() {
  const material = new MeshStandardMaterial({ roughness: 0.94, metalness: 0 });
  material.onBeforeCompile = (shader) => {
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
      float windowHash(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * .1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
      float side = 1.0 - step(.6, abs(facadeNormal.y));
      float along = mix(facadePoint.x, facadePoint.z, step(.6, abs(facadeNormal.x)));
      float buildingType = windowHash(buildingSeed * .037);
      vec2 grid = vec2(along / mix(2.3, 3.45, buildingType), facadePoint.y / mix(2.9, 3.65, buildingType));
      vec2 cell = floor(grid);
      vec2 uvWindow = fract(grid);
      float band = smoothstep(.20, .23, uvWindow.y) * (1.0 - smoothstep(.61, .68, uvWindow.y));
      float bay = smoothstep(.14, .18, uvWindow.x) * (1.0 - smoothstep(.75, .79, uvWindow.x));
      float mullion = smoothstep(.025, .075, abs(uvWindow.x - .49));
      float glass = side * band * bay * mix(.46, 1., mullion);
      float randomWindow = windowHash(cell + buildingSeed * .68);
      float lit = step(mix(.73, .94, buildingType), randomWindow);
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
      float strength = mix(.28, 1.78, windowHash(cell + buildingSeed * .18));
      totalEmissiveRadiance += glass * lit * strength * windowLight;`,
      );
  };
  return material;
}

function roadMaterial() {
  const material = new MeshStandardMaterial({ roughness: 0.88, metalness: 0.13 });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 roadPoint;")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nroadPoint = (instanceMatrix * vec4(position, 1.0)).xz;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec2 roadPoint;")
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
      vec2 grainPoint = floor(roadPoint * 12.);
      float grain = fract(52.9829189 * fract(dot(grainPoint, vec2(.06711056, .00583715))));
      diffuseColor.rgb *= mix(.80, 1.22, grain);`,
      );
  };
  return material;
}

type BatchMaterial = MeshBasicMaterial | MeshStandardMaterial;

function BoxBatch({
  boxes,
  material,
  intensity = 1,
}: {
  boxes: Box[];
  material: BatchMaterial;
  intensity?: number;
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
    <instancedMesh ref={ref} args={[undefined, material, boxes.length]}>
      <boxGeometry args={[1, 1, 1]} />
    </instancedMesh>
  );
}

function LightPools() {
  const ref = useRef<InstancedMesh>(null);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        vertexShader: `
      varying vec2 poolUV;
      void main() {
        poolUV = uv;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.);
      }`,
        fragmentShader: `
      varying vec2 poolUV;
      void main() {
        float radius = length(poolUV * 2. - 1.);
        float brightness = pow(1. - smoothstep(0., 1., radius), 2.3);
        gl_FragColor = vec4(.38, .17, .051, brightness * .54);
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

export function StaticDistrict() {
  const materials = useMemo(
    () => ({
      asphalt: roadMaterial(),
      facade: buildingMaterial(),
      fixtures: new MeshStandardMaterial({ roughness: 0.85 }),
      emitters: new MeshBasicMaterial({ toneMapped: false }),
    }),
    [],
  );

  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position={[900, -0.52, 0]}>
        <planeGeometry args={[6400, 4600]} />
        <meshStandardMaterial color="#0c121b" roughness={1} />
      </mesh>
      <BoxBatch boxes={district.asphalt} material={materials.asphalt} />
      <BoxBatch boxes={district.buildings} material={materials.facade} />
      <BoxBatch boxes={district.furniture} material={materials.fixtures} />
      <BoxBatch boxes={district.markings} material={materials.fixtures} />
      <BoxBatch boxes={district.lights} material={materials.emitters} intensity={4.2} />
      <BoxBatch boxes={district.signs} material={materials.emitters} intensity={1.4} />
      <LightPools />
    </>
  );
}
