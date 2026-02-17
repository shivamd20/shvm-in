import { describe, expect, it } from "vitest";
import { buildVoiceWebSocketUrl } from "../utils/webSocketUrl";

describe("buildVoiceWebSocketUrl", () => {
  it("defaults to https://shvm.in (wss) when serverUrl is omitted", () => {
    expect(buildVoiceWebSocketUrl({ sessionId: "abc" })).toBe("wss://shvm.in/ws/abc");
  });

  it("uses ws for http serverUrl", () => {
    expect(buildVoiceWebSocketUrl({ sessionId: "abc", serverUrl: "http://localhost:8787" })).toBe(
      "ws://localhost:8787/ws/abc",
    );
  });

  it("keeps wss for wss serverUrl", () => {
    expect(buildVoiceWebSocketUrl({ sessionId: "abc", serverUrl: "wss://example.com" })).toBe(
      "wss://example.com/ws/abc",
    );
  });

  it("allows overriding full websocket url", () => {
    expect(
      buildVoiceWebSocketUrl({
        sessionId: "abc",
        getWebSocketUrlOverride: (id) => `wss://override.example/ws/${id}?x=1`,
      }),
    ).toBe("wss://override.example/ws/abc?x=1");
  });
});

