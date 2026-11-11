import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  Points,
  ShaderMaterial,
} from "three";

export interface Glow {
  readonly points: Points<BufferGeometry, ShaderMaterial>;
  readonly positions: Float32Array;
  readonly colors: Float32Array;
  /** Uploads the first `count` lights and sets the pixels-per-metre factor at unit distance. */
  commit(count: number, pixelsPerUnit: number): void;
  dispose(): void;
}

/**
 * Additive point lights with a minimum on-screen size.
 * Close up they are halos around lamps; from the aerial camera they keep every
 * vehicle visible as a dot of light, so flow and queues read at corridor scale.
 */
export function createGlow(capacity: number, worldSize: number, minPixels: number): Glow {
  const positions = new Float32Array(capacity * 3);
  const colors = new Float32Array(capacity * 3);
  const geometry = new BufferGeometry();
  const position = new BufferAttribute(positions, 3).setUsage(DynamicDrawUsage);
  const color = new BufferAttribute(colors, 3).setUsage(DynamicDrawUsage);
  geometry.setAttribute("position", position);
  geometry.setAttribute("glow", color);
  geometry.setDrawRange(0, 0);
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
    uniforms: {
      pixelsPerUnit: { value: 1000 },
      worldSize: { value: worldSize },
      minPixels: { value: minPixels },
    },
    vertexShader: `
      attribute vec3 glow;
      uniform float pixelsPerUnit;
      uniform float worldSize;
      uniform float minPixels;
      varying vec3 lightColor;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.);
        gl_Position = projectionMatrix * viewPosition;
        float natural = worldSize * pixelsPerUnit / max(-viewPosition.z, 1.);
        gl_PointSize = clamp(natural, minPixels, 96.);
        // A light enlarged to stay visible is dimmed so distant traffic does not flare.
        lightColor = glow * clamp(natural / minPixels, .85, 1.);
      }`,
    fragmentShader: `
      varying vec3 lightColor;
      void main() {
        float radius = length(gl_PointCoord - .5) * 2.;
        float falloff = pow(max(1. - radius, 0.), 2.2);
        gl_FragColor = vec4(lightColor * falloff, 1.);
      }`,
  });
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 2;
  return {
    points,
    positions,
    colors,
    commit(count, pixelsPerUnit) {
      geometry.setDrawRange(0, count);
      material.uniforms.pixelsPerUnit.value = pixelsPerUnit;
      position.needsUpdate = true;
      color.needsUpdate = true;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
