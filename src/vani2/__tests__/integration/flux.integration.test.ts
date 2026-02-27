/**
 * Integration test: connect to /v2/flux/:sessionId, send synthetic 16 kHz PCM.
 * Verifies the Flux route returns a WebSocket; optionally asserts at least one Flux event.
 * Requires Workers AI binding (env.AI); may skip or pass without event if Flux needs real speech.
 */
import { describe, it, expect, beforeAll } from "vitest";
import WebSocket from "ws";
import { parseFluxEvent } from "../../flux-events";

const BASE = process.env.VANI2_INTEGRATION_BASE_URL || "http://localhost:8787";
const FLUX_WS_URL = BASE.replace(/^http/, "ws") + "/v2/flux/";

/** Match client: 256 ms @ 16 kHz = 4096 samples = 8192 bytes (~8.2 KB like Deepgram official). */
const FLUX_CHUNK_SAMPLES = 4096;
const FLUX_CHUNK_BYTES = FLUX_CHUNK_SAMPLES * 2;

function openFluxWs(sessionId: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(FLUX_WS_URL + sessionId);
    ws.onopen = () => resolve(ws);
    ws.onerror = () => reject(new Error("Flux WebSocket error"));
  });
}

/** Synthetic 16 kHz PCM chunk (4096 samples int16, little-endian). */
function syntheticPcmChunk(): Buffer {
  const buf = Buffer.alloc(FLUX_CHUNK_BYTES);
  for (let i = 0; i < FLUX_CHUNK_SAMPLES; i++) {
    buf.writeInt16LE(Math.floor(Math.random() * 1000 - 500), i * 2);
  }
  return buf;
}

describe("Vani 2 Flux (integration)", () => {
  beforeAll(() => {
    if (!process.env.VANI2_INTEGRATION_BASE_URL) {
      console.warn("VANI2_INTEGRATION_BASE_URL not set; ensure wrangler dev is running.");
    }
  });

  it("connects to Flux WebSocket and can send PCM", async () => {
    const sessionId = "flux-" + Date.now();
    const ws = await openFluxWs(sessionId);
    let receivedEvent = false;
    const validEvents = ["Update", "StartOfTurn", "EagerEndOfTurn", "TurnResumed", "EndOfTurn"];

    const done = new Promise<void>((resolve) => {
      const timeout = setTimeout(() => resolve(), 5000);
      ws.on("message", (data: Buffer | string) => {
        if (typeof data !== "string") return;
        const payload = parseFluxEvent(data);
        if (payload && typeof payload.event === "string" && validEvents.includes(payload.event)) {
          receivedEvent = true;
          clearTimeout(timeout);
          resolve();
        }
      });
    });

    for (let i = 0; i < 8; i++) {
      ws.send(syntheticPcmChunk());
    }
    await done;
    expect(receivedEvent).toBe(true);
    ws.close();
    expect(ws.readyState).toBe(WebSocket.CLOSING);
  });
});
