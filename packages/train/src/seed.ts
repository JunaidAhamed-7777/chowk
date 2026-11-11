export type SeedSplit = "training" | "validation";

export const TRAINING_SEED_COUNT = 100_000;
export const VALIDATION_SEEDS = Array.from({ length: 20 }, (_, index) => 500_000 + index);

export function requireTrainingSeed(seed: number, split: SeedSplit): void {
  if (
    !Number.isSafeInteger(seed) ||
    (split === "training"
      ? seed < 0 || seed >= TRAINING_SEED_COUNT
      : !VALIDATION_SEEDS.includes(seed))
  ) {
    throw new RangeError(`Seed ${seed} is outside the ${split} split`);
  }
}
