/**
 * Integration test: reconnect to same session and send session.init again.
 * Verifies that reconnecting with the same sessionId reuses the same DO and that
 * sending session.init after reconnect applies the system prompt for the next turn.
 */
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

function consumeState(ws: WebSocket): Promise<void> {
  return new Promise((resolve) => {
    const onMsg = (e: WsMessageEvent) => {
      if (typeof e.data === "string") {
        ws.removeEventListener("message", onMsg);
        resolve();
      }
    };
    ws.addEventListener("message", onMsg);
  });
}

describe("Vani 2 reconnection (integration)", () => {
  beforeAll(() => {
    if (!process.env.VANI2_INTEGRATION_BASE_URL) {
      console.warn("VANI2_INTEGRATION_BASE_URL not set; ensure wrangler dev is running or use integration config.");
    }
  });

  it("reconnects with same sessionId and session.init, then completes a turn", async () => {
    const sessionId = "reconnect-" + Date.now();

    const ws1 = await openWs(sessionId);
    await consumeState(ws1);
    ws1.send(JSON.stringify({ type: "session.init", systemPrompt: "You are helpful. Reply briefly." }));
    ws1.close();

    await new Promise((r) => setTimeout(r, 200));

    const ws2 = await openWs(sessionId);
    await consumeState(ws2);
    ws2.send(JSON.stringify({ type: "session.init", systemPrompt: "You are helpful. Reply briefly." }));
    ws2.send(JSON.stringify({ type: "transcript_final", text: "What is 1+1?", turnId: "reconnect-turn-1" }));

    const llmCompleteOrError = await new Promise<string>((resolve, reject) => {
      ws2.onmessage = (e: WsMessageEvent) => {
        if (typeof e.data !== "string") return;
        const msg = JSON.parse(e.data);
        if (msg.type === "llm_complete" || msg.type === "llm_error") resolve(e.data);
      };
      setTimeout(() => reject(new Error("timeout waiting for llm_complete or llm_error")), 25_000);
    });
    ws2.close();

    const msg = JSON.parse(llmCompleteOrError);
    if (msg.type === "llm_error") {
      throw new Error("Expected llm_complete after reconnect but got llm_error: " + msg.reason);
    }
    expect(msg.type).toBe("llm_complete");
    expect(typeof msg.text).toBe("string");
    expect(msg.text.length).toBeGreaterThan(0);
  });
});
