/**
 * Conversation history helpers for Vani2.
 * Used to record partial assistant responses when the user interrupts.
 */
import type { LlmMessage } from "./llm-adapter";

/** Minimum partial length to record on interrupt (avoid recording a couple of tokens). */
export const MIN_PARTIAL_LENGTH = 5;

const INTERRUPTED_MARKER = "\n[Interrupted by user.]";

/**
 * Appends an assistant message with the given partial text and interrupt marker.
 * Only appends if partialText (trimmed) has length >= MIN_PARTIAL_LENGTH.
 * Returns a new array; does not mutate the input.
 */
export function appendInterruptedAssistantMessage(
  messages: LlmMessage[],
  partialText: string
): LlmMessage[] {
  const trimmed = partialText.trim();
  if (trimmed.length < MIN_PARTIAL_LENGTH) return messages;
  return [
    ...messages,
    { role: "assistant", content: trimmed + INTERRUPTED_MARKER },
  ];
}
