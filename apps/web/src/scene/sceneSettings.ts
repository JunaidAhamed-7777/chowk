export type Quality = "low" | "medium" | "high";
export type QualityMode = Quality | "auto";
export type PlaybackSpeed = 1 | 4 | 16;
export type CameraSelection = "aerial" | number;

export const qualityPresets = {
  low: { label: "Low", dpr: 1, vehicleLimit: 1200, bloomScale: 0.25 },
  medium: { label: "Medium", dpr: 1.5, vehicleLimit: 2000, bloomScale: 0.5 },
  high: { label: "High", dpr: 2, vehicleLimit: 3000, bloomScale: 1 },
} satisfies Record<
  Quality,
  { label: string; dpr: number; vehicleLimit: number; bloomScale: number }
>;

export const playingSpeeds = [1, 4, 16] as const;
