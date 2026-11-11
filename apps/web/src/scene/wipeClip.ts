import { type Material, ShaderMaterial } from "three";
import type { SimulationSide } from "../sim/SimHost";

export interface WipeClip {
  readonly position: { value: number };
  readonly side: SimulationSide;
}

function clippedFragment(source: string) {
  return `uniform float uWipeX;
uniform float uWipeSide;
${source.replace(
  "void main() {",
  `void main() {
      if ((gl_FragCoord.x < uWipeX) != (uWipeSide < 0.5)) discard;`,
)}`;
}

export function clipMaterial<T extends Material>(material: T, clip: WipeClip): T {
  const uniforms = { uWipeX: clip.position, uWipeSide: { value: clip.side } };
  if (material instanceof ShaderMaterial) {
    Object.assign(material.uniforms, uniforms);
    material.fragmentShader = clippedFragment(material.fragmentShader);
    return material;
  }
  const compile = material.onBeforeCompile;
  const key = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    compile.call(material, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = clippedFragment(shader.fragmentShader);
  };
  material.customProgramCacheKey = () => `${key}:wipe`;
  return material;
}
