declare const __CHOWK_SIM_VERSION__: string;
declare const __CHOWK_POLICY_HASH__: string | null;
declare const __CHOWK_BRIEFING__: {
  headline: string;
  measurementMinutes: number;
  delay: { controller: string; mean: number; ciLow: number; ciHigh: number; seedCount: number }[];
} | null;
