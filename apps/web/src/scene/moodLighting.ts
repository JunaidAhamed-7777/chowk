import { Color } from "three";
import type { Mood } from "../sim/scenarioScene";

/** Everything the scene changes between times of day. Colours and levels are art direction. */
export interface MoodValues {
  sky: Color;
  fog: Color;
  fogDensity: number;
  hemiSky: Color;
  hemiGround: Color;
  hemi: number;
  sun: Color;
  sunIntensity: number;
  sunX: number;
  sunY: number;
  sunZ: number;
  ground: Color;
  facade: number;
  facadeTint: Color;
  facadeMix: number;
  vignette: number;
  road: number;
  windows: number;
  lamps: number;
  pools: number;
  bloomThreshold: number;
  bloomIntensity: number;
  /** How wet the road looks, 0 dry to 1 soaked. */
  wet: number;
}

function values(
  input: Omit<
    MoodValues,
    "sky" | "fog" | "hemiSky" | "hemiGround" | "sun" | "ground" | "facadeTint"
  > & {
    facadeTint: string;
    sky: string;
    fog: string;
    hemiSky: string;
    hemiGround: string;
    sun: string;
    ground: string;
  },
): MoodValues {
  return {
    ...input,
    sky: new Color(input.sky),
    fog: new Color(input.fog),
    hemiSky: new Color(input.hemiSky),
    hemiGround: new Color(input.hemiGround),
    sun: new Color(input.sun),
    ground: new Color(input.ground),
    facadeTint: new Color(input.facadeTint),
  };
}

const targets: Record<Mood | "rain", MoodValues> = {
  day: values({
    sky: "#a9c8e6",
    fog: "#d3cfc4",
    fogDensity: 0.00055,
    hemiSky: "#e4efff",
    hemiGround: "#7a7064",
    hemi: 2.1,
    sun: "#fff1d8",
    sunIntensity: 3.4,
    sunX: 380,
    sunY: 820,
    sunZ: 520,
    ground: "#6c665b",
    facade: 1,
    facadeTint: "#c4bbae",
    facadeMix: 0.88,
    vignette: 0.18,
    road: 2.4,
    windows: 0,
    lamps: 0.1,
    pools: 0,
    bloomThreshold: 0.96,
    bloomIntensity: 0.3,
    wet: 0,
  }),
  evening: values({
    sky: "#3d3242",
    fog: "#7f6458",
    fogDensity: 0.00058,
    hemiSky: "#d8a88c",
    hemiGround: "#2a2a3e",
    hemi: 1.45,
    sun: "#ffb27a",
    sunIntensity: 1.9,
    sunX: -760,
    sunY: 150,
    sunZ: 260,
    ground: "#221f25",
    facade: 1,
    facadeTint: "#686063",
    facadeMix: 0.32,
    vignette: 0.36,
    road: 1.25,
    windows: 0.7,
    lamps: 0.8,
    pools: 0.6,
    bloomThreshold: 0.64,
    bloomIntensity: 0.7,
    wet: 0,
  }),
  night: values({
    sky: "#0a0f1a",
    fog: "#111b2c",
    fogDensity: 0.00066,
    hemiSky: "#a7c6f5",
    hemiGround: "#343149",
    hemi: 2.15,
    sun: "#b1ccff",
    sunIntensity: 1.12,
    sunX: 540,
    sunY: 450,
    sunZ: -420,
    ground: "#0c121b",
    facade: 1,
    facadeTint: "#252d3c",
    facadeMix: 0,
    vignette: 0.5,
    road: 1,
    windows: 1,
    lamps: 1,
    pools: 1,
    bloomThreshold: 0.54,
    bloomIntensity: 0.8,
    wet: 0,
  }),
  rain: values({
    sky: "#0c121c",
    fog: "#1c2533",
    fogDensity: 0.0011,
    hemiSky: "#8ea6c4",
    hemiGround: "#2c3040",
    hemi: 2,
    sun: "#9fb6d8",
    sunIntensity: 0.8,
    sunX: 540,
    sunY: 450,
    sunZ: -420,
    ground: "#0b1018",
    facade: 0.95,
    facadeTint: "#252d3c",
    facadeMix: 0,
    vignette: 0.55,
    road: 0.8,
    windows: 0.9,
    lamps: 1,
    pools: 1.25,
    bloomThreshold: 0.5,
    bloomIntensity: 0.9,
    wet: 1,
  }),
};

const colorKeys = ["sky", "fog", "hemiSky", "hemiGround", "sun", "ground", "facadeTint"] as const;
const numberKeys = [
  "fogDensity",
  "hemi",
  "sunIntensity",
  "sunX",
  "sunY",
  "sunZ",
  "facade",
  "facadeMix",
  "vignette",
  "road",
  "windows",
  "lamps",
  "pools",
  "bloomThreshold",
  "bloomIntensity",
  "wet",
] as const;

function copy(target: MoodValues, source: MoodValues) {
  for (const key of colorKeys) target[key].copy(source[key]);
  for (const key of numberKeys) target[key] = source[key];
}

/** The blended values the scene reads every frame. Mutated in place; never reallocated. */
export const currentMood: MoodValues = values({
  sky: "#000",
  fog: "#000",
  hemiSky: "#000",
  hemiGround: "#000",
  sun: "#000",
  ground: "#000",
  facadeTint: "#000",
  facadeMix: 0,
  vignette: 0,
  fogDensity: 0,
  hemi: 0,
  sunIntensity: 0,
  sunX: 0,
  sunY: 0,
  sunZ: 0,
  facade: 0,
  road: 0,
  windows: 0,
  lamps: 0,
  pools: 0,
  bloomThreshold: 0,
  bloomIntensity: 0,
  wet: 0,
});
copy(currentMood, targets.night);

export function moodTarget(mood: Mood, rain: boolean): MoodValues {
  return rain ? targets.rain : targets[mood];
}

export function snapMood(target: MoodValues) {
  copy(currentMood, target);
}

/** Eases every value towards the target; `weight` is the fraction to cover this frame. */
export function blendMood(target: MoodValues, weight: number) {
  for (const key of colorKeys) currentMood[key].lerp(target[key], weight);
  for (const key of numberKeys) currentMood[key] += (target[key] - currentMood[key]) * weight;
}

/** Shader uniforms shared by the district materials. */
export const moodUniforms = {
  windows: { value: 1 },
  facadeTint: { value: new Color("#252d3c") },
  facadeMix: { value: 0 },
  pools: { value: 1 },
  wet: { value: 0 },
};
