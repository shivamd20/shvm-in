import { describe, it, expect, beforeAll } from "vitest";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import WebSocket from "ws";
import { decodeTimestamp, encodeChunkWithTimestamp } from "../../protocol";

type WsMessageEvent = Parameters<NonNullable<WebSocket["onmessage"]>>[0];

const BASE = process.env.VANI2_INTEGRATION_BASE_URL || "http://localhost:8787";
const WS_URL = BASE.replace(/^http/, "ws") + "/v2/ws/";
const BENCHMARKS_PATH = join(process.cwd(), "docs", "vani2-benchmarks.md");
const ITERATIONS = 100;
const P99_THRESHOLD_MS = 500;

function openWs(sessionId: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL + sessionId);
    ws.onopen = () => resolve(ws);
    ws.onerror = () => reject(new Error("WebSocket error"));
  });
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, i)];
}

describe("Vani 2 latency (integration)", () => {
  beforeAll(() => {
    if (!process.env.VANI2_INTEGRATION_BASE_URL) {
      console.warn("VANI2_INTEGRATION_BASE_URL not set; ensure wrangler dev is running.");
    }
  });

  it("measures echo RTT and writes benchmarks doc", async () => {
    const sessionId = "latency-" + Date.now();
    const ws = await openWs(sessionId);
    const rtts: number[] = [];
    let resolveFirst: () => void;
    const firstReady = new Promise<void>((r) => { resolveFirst = r; });

    ws.onmessage = (e: WsMessageEvent) => {
      const data = e.data;
      if (typeof data === "string") {
        resolveFirst!();
        return;
      }
      const ab: ArrayBuffer =
        data instanceof ArrayBuffer
          ? data
          : (data as Buffer).buffer.slice(
              (data as Buffer).byteOffset,
              (data as Buffer).byteOffset + (data as Buffer).byteLength
            ) as ArrayBuffer;
      const clientTs = decodeTimestamp(ab);
      if (clientTs != null) rtts.push(Date.now() - clientTs);
    };

    await firstReady;

    const payload = new Uint8Array(32);
    for (let i = 0; i < ITERATIONS; i++) {
      const buf = encodeChunkWithTimestamp(payload, Date.now());
      ws.send(buf);
      await new Promise((r) => setTimeout(r, 5));
    }

    await new Promise<void>((resolve) => {
      const check = () => {
        if (rtts.length >= ITERATIONS) return resolve();
        setTimeout(check, 10);
      };
      setTimeout(() => check(), 2000);
    });

    ws.close();

    expect(rtts.length).toBeGreaterThanOrEqual(Math.floor(ITERATIONS * 0.9));
    const sorted = [...rtts].sort((a, b) => a - b);
    const p50 = percentile(sorted, 50);
    const p95 = percentile(sorted, 95);
    const p99 = percentile(sorted, 99);

    if (sorted.length >= 50) {
      expect(p99).toBeLessThanOrEqual(P99_THRESHOLD_MS);
    }

    const section = `
## Echo RTT (Phase 1)

- **Date**: ${new Date().toISOString()}
- **Environment**: Node ${process.version}, \`wrangler dev\` (local)
- **Methodology**: Client sends chunk with 8-byte timestamp, server echoes; RTT = receive time - timestamp. ${ITERATIONS} iterations, 5ms spacing.
- **Results**:
  - P50: ${p50.toFixed(2)} ms
  - P95: ${p95.toFixed(2)} ms
  - P99: ${p99.toFixed(2)} ms
`;

    const exists = existsSync(BENCHMARKS_PATH);
    const content = exists
      ? readFileSync(BENCHMARKS_PATH, "utf-8") + "\n" + section
      : "# Vani 2 Benchmarks\n" + section;
    writeFileSync(BENCHMARKS_PATH, content.trimEnd() + "\n");
  }, 30_000);
});
