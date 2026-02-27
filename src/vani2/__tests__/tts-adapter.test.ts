import { describe, it, expect, vi, beforeEach } from "vitest";
import { runAura2 } from "../server/tts-adapter";

describe("tts-adapter runAura2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null for empty text", async () => {
    const env = { AI: { run: vi.fn() } };
    expect(await runAura2(env as any, { text: "" })).toBeNull();
    expect(await runAura2(env as any, { text: "   " })).toBeNull();
    expect(env.AI.run).not.toHaveBeenCalled();
  });

  it("returns ArrayBuffer when AI.run returns Response with arrayBuffer", async () => {
    const ab = new ArrayBuffer(4);
    const env = {
      AI: {
        run: vi.fn().mockResolvedValue({
          arrayBuffer: () => Promise.resolve(ab),
        }),
      },
    };
    const result = await runAura2(env as any, { text: "Hello" });
    expect(result).toBe(ab);
  });

  it("returns ArrayBuffer when AI.run returns { audio: base64 }", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const base64 = btoa(String.fromCharCode(...bytes));
    const env = {
      AI: {
        run: vi.fn().mockResolvedValue({ audio: base64 }),
      },
    };
    const result = await runAura2(env as any, { text: "Hi" });
    expect(result).not.toBeNull();
    expect(new Uint8Array(result!)).toEqual(bytes);
  });

  it("returns null and does not throw when AI.run throws", async () => {
    const env = {
      AI: {
        run: vi.fn().mockRejectedValue(new Error("TTS failed")),
      },
    };
    const result = await runAura2(env as any, { text: "Hi" });
    expect(result).toBeNull();
  });

  it("returns null when AI.run returns unexpected shape", async () => {
    const env = {
      AI: {
        run: vi.fn().mockResolvedValue({ unknown: true }),
      },
    };
    const result = await runAura2(env as any, { text: "Hi" });
    expect(result).toBeNull();
  });
});
