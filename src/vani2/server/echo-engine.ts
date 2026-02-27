/**
 * Echo engine: consumes chunks, applies configurable delay, emits in order.
 */

export type EchoEmit = (chunk: ArrayBuffer) => void;

export interface EchoEngineOptions {
  delayMs: number;
  emit: EchoEmit;
  /** For testing: inject scheduler (setTimeout). */
  schedule?: (fn: () => void, ms: number) => void | ReturnType<typeof setTimeout>;
}

export class EchoEngine {
  private readonly delayMs: number;
  private readonly emit: EchoEmit;
  private readonly schedule: (fn: () => void, ms: number) => void | ReturnType<typeof setTimeout>;
  private pending: Array<{ chunk: ArrayBuffer; at: number }> = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: EchoEngineOptions) {
    this.delayMs = Math.max(0, options.delayMs);
    this.emit = options.emit;
    this.schedule = options.schedule ?? ((fn, ms) => setTimeout(fn, ms));
  }

  /** Enqueue a chunk to be echoed after delayMs. */
  push(chunk: ArrayBuffer): void {
    const at = Date.now() + this.delayMs;
    this.pending.push({ chunk, at });
    this.flushWhenReady();
  }

  private flushWhenReady(): void {
    if (this.pending.length === 0) return;
    const now = Date.now();
    const ready: ArrayBuffer[] = [];
    let stillPending: typeof this.pending = [];
    for (const { chunk, at } of this.pending) {
      if (at <= now) ready.push(chunk);
      else stillPending.push({ chunk, at });
    }
    this.pending = stillPending;
    for (const c of ready) this.emit(c);
    if (this.pending.length > 0 && !this.timer) {
      const next = this.pending[0].at - Date.now();
      const id = this.schedule(() => {
        this.timer = null;
        this.flushWhenReady();
      }, Math.max(0, next));
      if (id !== undefined) this.timer = id as ReturnType<typeof setTimeout>;
    }
  }

  /** Flush any remaining chunks immediately (e.g. on close). */
  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    for (const { chunk } of this.pending) this.emit(chunk);
    this.pending = [];
  }
}
