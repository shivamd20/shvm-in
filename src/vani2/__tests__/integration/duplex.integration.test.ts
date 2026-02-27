import { describe, it, expect, beforeAll } from "vitest";
import WebSocket from "ws";

type WsMessageEvent = Parameters<NonNullable<WebSocket["onmessage"]>>[0];

const BASE = process.env.VANI2_INTEGRATION_BASE_URL || "http://localhost:8787";
const WS_URL = BASE.replace(/^http/, "ws") + "/v2/ws/";

function openWs(sessionId: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL + sessionId);
    ws.onopen = () => resolve(ws);
    ws.onerror = (_e) => reject(new Error("WebSocket error"));
  });
}

describe("Vani 2 duplex (integration)", () => {
  beforeAll(() => {
    if (!process.env.VANI2_INTEGRATION_BASE_URL) {
      console.warn("VANI2_INTEGRATION_BASE_URL not set; ensure wrangler dev is running or use integration config.");
    }
  });

  it("connects and receives state message", async () => {
    const sessionId = "duplex-" + Date.now();
    const ws = await openWs(sessionId);
    const first = await new Promise<string>((resolve, reject) => {
      ws.onmessage = (e: WsMessageEvent) => {
      if (typeof e.data === "string") resolve(e.data);
    };
      ws.onerror = () => reject(new Error("WS error"));
      setTimeout(() => reject(new Error("timeout")), 5000);
    });
    ws.close();
    const msg = JSON.parse(first);
    expect(msg.type).toBe("state");
    expect(["connected", "streaming", "closed"]).toContain(msg.value);
  });

  it("echoes binary chunks in order", async () => {
    const sessionId = "echo-" + Date.now();
    const ws = await openWs(sessionId);
    const received: (ArrayBuffer | Buffer)[] = [];
    ws.onmessage = (e: WsMessageEvent) => {
      if (typeof e.data !== "string") received.push(e.data as ArrayBuffer | Buffer);
    };

    // Consume initial state JSON
    await new Promise<void>((resolve) => {
      const onMsg = (e: WsMessageEvent) => {
        if (typeof e.data === "string") {
          ws.removeEventListener("message", onMsg);
          resolve();
        }
      };
      ws.addEventListener("message", onMsg);
    });

    const count = 10;
    const chunkSize = 64;
    for (let i = 0; i < count; i++) {
      const buf = new Uint8Array(chunkSize);
      for (let j = 0; j < chunkSize; j++) buf[j] = i;
      ws.send(buf.buffer);
    }

    await new Promise<void>((resolve) => {
      const check = () => {
        if (received.length >= count) resolve();
        else setTimeout(check, 50);
      };
      setTimeout(() => {
        if (received.length >= count) resolve();
        else check();
      }, 100);
    });

    ws.close();

    expect(received.length).toBe(count);
    for (let i = 0; i < count; i++) {
      const r = received[i];
      const arr = r instanceof ArrayBuffer ? new Uint8Array(r) : new Uint8Array(r.buffer, r.byteOffset, r.byteLength);
      expect(arr.length).toBe(chunkSize);
      expect(arr[0]).toBe(i);
    }
  });

  it("sends error for invalid JSON message", async () => {
    const sessionId = "err-" + Date.now();
    const ws = await openWs(sessionId);
    const first = await new Promise<string>((resolve) => {
      ws.onmessage = (e: WsMessageEvent) => {
        if (typeof e.data === "string") resolve(e.data);
      };
    });
    // consume initial state
    const stateMsg = JSON.parse(first);
    expect(stateMsg.type).toBe("state");

    const next = await new Promise<string>((resolve, reject) => {
      ws.onmessage = (e: WsMessageEvent) => {
        if (typeof e.data === "string") resolve(e.data);
      };
      ws.send("not json");
      setTimeout(() => reject(new Error("timeout")), 3000);
    });
    ws.close();
    const errMsg = JSON.parse(next);
    expect(errMsg.type).toBe("error");
    expect(typeof errMsg.reason).toBe("string");
  });

  it("sends error for empty transcript_final", async () => {
    const sessionId = "empty-tf-" + Date.now();
    const ws = await openWs(sessionId);
    await new Promise<string>((resolve) => {
      ws.onmessage = (e: WsMessageEvent) => {
        if (typeof e.data === "string") resolve(e.data);
      };
    });
    const next = await new Promise<string>((resolve, reject) => {
      ws.onmessage = (e: WsMessageEvent) => {
        if (typeof e.data === "string") resolve(e.data);
      };
      ws.send(JSON.stringify({ type: "transcript_final", text: "" }));
      setTimeout(() => reject(new Error("timeout")), 3000);
    });
    ws.close();
    const errMsg = JSON.parse(next);
    expect(errMsg.type).toBe("error");
    expect(errMsg.reason).toContain("non-empty");
  });
});
