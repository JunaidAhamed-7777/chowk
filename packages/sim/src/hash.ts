const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export class StateHash {
  private hash = FNV_OFFSET;

  addUint32(value: number): this {
    // Write explicit little-endian bytes so the host's byte order cannot affect the result.
    this.hash = Math.imul(this.hash ^ (value & 0xff), FNV_PRIME);
    this.hash = Math.imul(this.hash ^ ((value >>> 8) & 0xff), FNV_PRIME);
    this.hash = Math.imul(this.hash ^ ((value >>> 16) & 0xff), FNV_PRIME);
    this.hash = Math.imul(this.hash ^ (value >>> 24), FNV_PRIME);
    return this;
  }

  addMilli(value: number): this {
    return this.addUint32(Math.floor(value * 1_000 + 0.5));
  }

  digest(): number {
    return this.hash >>> 0;
  }
}
