import { describe, it, expect } from "vitest";
import {
  appendInterruptedAssistantMessage,
  MIN_PARTIAL_LENGTH,
} from "../server/conversation-history";
import type { LlmMessage } from "../server/llm-adapter";

describe("conversation-history", () => {
  const baseMessages: LlmMessage[] = [
    { role: "user", content: "Hello" },
    { role: "assistant", content: "Hi there." },
  ];

  it("appends assistant message with partial + marker when length >= MIN_PARTIAL_LENGTH", () => {
    const partial = "The weather today is";
    const result = appendInterruptedAssistantMessage(baseMessages, partial);
    expect(result).toHaveLength(3);
    expect(result[2]).toEqual({
      role: "assistant",
      content: "The weather today is\n[Interrupted by user.]",
    });
  });

  it("does not append when partial is empty", () => {
    const result = appendInterruptedAssistantMessage(baseMessages, "");
    expect(result).toBe(baseMessages);
    expect(result).toHaveLength(2);
  });

  it("does not append when partial is too short (length < MIN)", () => {
    const short = "Hi"; // length 2 < MIN_PARTIAL_LENGTH (5)
    const result = appendInterruptedAssistantMessage(baseMessages, short);
    expect(result).toBe(baseMessages);
    expect(result).toHaveLength(2);
  });

  it("does not append when partial is only whitespace", () => {
    const result = appendInterruptedAssistantMessage(baseMessages, "   ");
    expect(result).toBe(baseMessages);
  });

  it("appends when partial length equals MIN_PARTIAL_LENGTH", () => {
    const exact = "Hello"; // length 5
    const result = appendInterruptedAssistantMessage(baseMessages, exact);
    expect(result).toHaveLength(3);
    expect(result[2].content.endsWith("[Interrupted by user.]")).toBe(true);
  });

  it("returns new array and does not mutate input", () => {
    const partial = "Some partial response";
    const result = appendInterruptedAssistantMessage(baseMessages, partial);
    expect(result).not.toBe(baseMessages);
    expect(result).toHaveLength(3);
    expect(baseMessages).toHaveLength(2);
  });

  it("content ends with interrupt marker", () => {
    const partial = "A longer partial response here.";
    const result = appendInterruptedAssistantMessage(baseMessages, partial);
    expect(result[2].content.endsWith("\n[Interrupted by user.]")).toBe(true);
  });

  it("MIN_PARTIAL_LENGTH is exported and is a positive number", () => {
    expect(MIN_PARTIAL_LENGTH).toBe(5);
  });
});
