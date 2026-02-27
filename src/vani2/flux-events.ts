/**
 * Typed Flux (@cf/deepgram/flux) WebSocket event payloads.
 * Flux provides VAD and turn detection natively; we expose these event types to the app.
 */

export type FluxEventType =
  | "Update"
  | "StartOfTurn"
  | "EagerEndOfTurn"
  | "TurnResumed"
  | "EndOfTurn";

export interface FluxWord {
  word: string;
  confidence: number;
}

export interface FluxEventPayload {
  request_id?: string;
  sequence_id?: number;
  event?: FluxEventType;
  turn_index?: number;
  audio_window_start?: number;
  audio_window_end?: number;
  transcript?: string;
  words?: FluxWord[];
  end_of_turn_confidence?: number;
}

/**
 * Parse a Flux WebSocket message (JSON string) into a typed payload.
 * Returns null if the payload is not valid JSON or missing event type.
 */
export function parseFluxEvent(data: string): FluxEventPayload | null {
  try {
    const obj = JSON.parse(data) as FluxEventPayload;
    if (obj && typeof obj === "object") return obj;
    return null;
  } catch {
    return null;
  }
}

/**
 * Type guard: payload has a known Flux event type.
 */
export function isFluxEventPayload(
  p: FluxEventPayload | null
): p is FluxEventPayload & { event: FluxEventType } {
  return (
    p != null &&
    typeof p.event === "string" &&
    ["Update", "StartOfTurn", "EagerEndOfTurn", "TurnResumed", "EndOfTurn"].includes(p.event)
  );
}
