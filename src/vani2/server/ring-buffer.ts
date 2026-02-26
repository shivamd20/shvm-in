/**
 * Fixed-capacity ring buffer for inbound audio chunks.
 * When full, drops oldest (no unbounded growth).
 */

export class RingBuffer {
  private readonly capacity: number;
  private readonly buffers: ArrayBuffer[] = [];
  private size = 0;

  constructor(capacity: number) {
    if (capacity < 1) throw new Error("RingBuffer capacity must be >= 1");
    this.capacity = capacity;
  }

  /** Push a chunk; if full, drop oldest. */
  push(chunk: ArrayBuffer): void {
    if (this.buffers.length >= this.capacity) {
      const dropped = this.buffers.shift();
      if (dropped) this.size -= dropped.byteLength;
    }
    this.buffers.push(chunk);
    this.size += chunk.byteLength;
  }

  /** Take all chunks in order and clear the buffer. */
  takeAll(): ArrayBuffer[] {
    const out = [...this.buffers];
    this.buffers.length = 0;
    this.size = 0;
    return out;
  }

  /** Number of chunks currently stored. */
  get length(): number {
    return this.buffers.length;
  }

  /** Total bytes stored. */
  get byteLength(): number {
    return this.size;
  }

  getCapacity(): number {
    return this.capacity;
  }
}
