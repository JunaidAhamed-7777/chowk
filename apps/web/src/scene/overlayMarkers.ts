import {
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  NormalBlending,
  Points,
  ShaderMaterial,
} from "three";

export interface Markers {
  readonly points: Points<BufferGeometry, ShaderMaterial>;
  readonly positions: Float32Array;
  readonly tints: Float32Array;
  /** Marker diameter in metres. */
  readonly sizes: Float32Array;
  /** Uploads the first `count` markers, the pixels-per-metre factor and the overlay's fade. */
  commit(count: number, pixelsPerUnit: number, opacity: number): void;
  dispose(): void;
}

/**
 * Solid, outlined discs floating above vehicles for the Speed and People overlays. Unlike the
 * additive glows they stay legible on a daylit road, and a minimum on-screen size proportional
 * to each marker's diameter keeps them readable, and still in proportion, from the aerial view.
 */
export function createMarkers(capacity: number, minPixelsPerMetre: number): Markers {
  const positions = new Float32Array(capacity * 3);
  const tints = new Float32Array(capacity * 3);
  const sizes = new Float32Array(capacity);
  const geometry = new BufferGeometry();
  const position = new BufferAttribute(positions, 3).setUsage(DynamicDrawUsage);
  const tint = new BufferAttribute(tints, 3).setUsage(DynamicDrawUsage);
  const size = new BufferAttribute(sizes, 1).setUsage(DynamicDrawUsage);
  geometry.setAttribute("position", position);
  geometry.setAttribute("tint", tint);
  geometry.setAttribute("size", size);
  geometry.setDrawRange(0, 0);
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: NormalBlending,
    toneMapped: false,
    uniforms: {
      pixelsPerUnit: { value: 1000 },
      minPixelsPerMetre: { value: minPixelsPerMetre },
      opacity: { value: 0 },
    },
    vertexShader: `
      attribute vec3 tint;
      attribute float size;
      uniform float pixelsPerUnit;
      uniform float minPixelsPerMetre;
      varying vec3 markerTint;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.);
        gl_Position = projectionMatrix * viewPosition;
        float natural = size * pixelsPerUnit / max(-viewPosition.z, 1.);
        gl_PointSize = clamp(natural, size * minPixelsPerMetre, 72.);
        markerTint = tint;
      }`,
    fragmentShader: `
      uniform float opacity;
      varying vec3 markerTint;
      void main() {
        float radius = length(gl_PointCoord - .5) * 2.;
        if (radius > 1.) discard;
        float rim = smoothstep(.6, .76, radius);
        gl_FragColor = vec4(mix(markerTint, vec3(.012, .016, .03), rim * .8), opacity * (1. - smoothstep(.9, 1., radius)));
        #include <colorspace_fragment>
      }`,
  });
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 3;
  return {
    points,
    positions,
    tints,
    sizes,
    commit(count, pixelsPerUnit, opacity) {
      geometry.setDrawRange(0, opacity > 0 ? count : 0);
      material.uniforms.pixelsPerUnit.value = pixelsPerUnit;
      material.uniforms.opacity.value = opacity;
      position.needsUpdate = true;
      tint.needsUpdate = true;
      size.needsUpdate = true;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
