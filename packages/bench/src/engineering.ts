export function rendererName(value: string): string {
  return /^ANGLE \([^,]+,\s*(.*?)\s*\(0x[\da-f]+\)/i.exec(value)?.[1] ?? value;
}
