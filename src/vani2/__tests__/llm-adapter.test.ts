import { describe, it, expect, vi, beforeEach } from "vitest";
import { streamLlmResponse, type LlmMessage } from "../server/llm-adapter";

// Mock the chat stream to control what we yield
const mockStream = vi.fn();
vi.mock("@tanstack/ai", () => ({
  chat: vi.fn(() => mockStream()),
}));
vi.mock("@cloudflare/tanstack-ai", () => ({
  createWorkersAiChat: vi.fn(() => ({})),
}));

describe("llm-adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("yields deltas and returns full response", async () => {
    async function* gen() {
      yield { type: "TEXT_MESSAGE_CONTENT", delta: "Hello" };
      yield { type: "TEXT_MESSAGE_CONTENT", delta: " world" };
    }
    mockStream.mockReturnValue(gen());

    const messages: LlmMessage[] = [{ role: "user", content: "Hi" }];
    const chunks: string[] = [];
    for await (const delta of streamLlmResponse({ binding: {}, messages })) {
      chunks.push(delta);
    }
    expect(chunks).toEqual(["Hello", " world"]);
  });

  it("throws on RUN_ERROR chunk", async () => {
    async function* gen() {
      yield { type: "TEXT_MESSAGE_CONTENT", delta: "Hi" };
      yield { type: "RUN_ERROR", error: { message: "Model overloaded" } };
    }
    mockStream.mockReturnValue(gen());

    const messages: LlmMessage[] = [{ role: "user", content: "Hi" }];
    await expect(
      (async () => {
        for await (const _ of streamLlmResponse({ binding: {}, messages })) {
          // consume
        }
      })()
    ).rejects.toThrow("Model overloaded");
  });

  it("throws when RUN_ERROR has no message", async () => {
    async function* gen() {
      yield { type: "RUN_ERROR", error: {} };
    }
    mockStream.mockReturnValue(gen());

    const messages: LlmMessage[] = [{ role: "user", content: "Hi" }];
    await expect(
      (async () => {
        for await (const _ of streamLlmResponse({ binding: {}, messages })) {
          // consume
        }
      })()
    ).rejects.toThrow("LLM error");
  });

  it("handles empty messages (system filtered out)", async () => {
    async function* gen() {
      yield { type: "TEXT_MESSAGE_CONTENT", delta: "OK" };
    }
    mockStream.mockReturnValue(gen());

    const messages: LlmMessage[] = [];
    const chunks: string[] = [];
    for await (const delta of streamLlmResponse({ binding: {}, messages })) {
      chunks.push(delta);
    }
    expect(chunks).toEqual(["OK"]);
  });
});
