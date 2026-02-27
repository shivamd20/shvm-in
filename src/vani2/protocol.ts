/**
 * Vani 2 minimal wire protocol.
 * Client → Server: binary = audio.chunk; JSON = control.mute
 * Server → Client: binary = audio.frame; JSON = optional state
 */

/** Client → Server JSON */
export type ClientToServerJson =
  | { type: "session.init"; systemPrompt: string }
  | { type: "control.mute"; value: boolean }
  | { type: "control.interrupt" }
  | { type: "transcript_final"; text: string; turnId?: string };

/** Benchmark events (server → client); ts in ms, turnIndex per turn. */
export type BenchmarkEvent =
  | { type: "benchmark.turn_start"; ts: number; turnIndex: number; transcriptLength?: number }
  | { type: "benchmark.llm_first_token"; ts: number; turnIndex: number }
  | { type: "benchmark.tts_first_chunk"; ts: number; turnIndex: number }
  | { type: "benchmark.turn_end"; ts: number; turnIndex: number }
  | { type: "benchmark.turn_interrupted"; ts: number; turnIndex: number };

/** Server status for "still working" feedback (idea 7). */
export type ServerStatusValue = "thinking" | "synthesizing";

/** Server → Client JSON */
export type ServerToClientJson =
  | { type: "state"; value: SessionState }
  | { type: "error"; reason: string }
  | { type: "status"; value: ServerStatusValue }
  | { type: "llm_partial"; text: string; turnId?: string }
  | { type: "llm_complete"; text: string; turnId?: string }
  | { type: "llm_error"; reason: string; turnId?: string }
  | BenchmarkEvent;

export type SessionState = "connected" | "streaming" | "closed";

/** Binary from client: opaque audio chunk. Option 3 frame = [uint32 ts][uint16 len][payload]. */
export type AudioChunk = ArrayBuffer;

/** Binary from server: echo frame. Same layout as chunk. */
export type AudioFrame = ArrayBuffer;

/** Payload type: 0 = PCM Int16, 1 = Opus */
export const PAYLOAD_TYPE_PCM = 0;
export const PAYLOAD_TYPE_OPUS = 1;

/** Option 3 frame header: uint32 timestamp (ms) + uint16 payload length (bytes) + uint8 payload type. */
export const FRAME_HEADER_BYTES = 4 + 2 + 1; // 7

/**
 * Encode a binary audio frame: [uint32 timestamp ms][uint16 payload length][uint8 type][payload].
 */
export function encodeAudioFrame(
  timestampMs: number,
  payload: Uint8Array,
  payloadType: number = PAYLOAD_TYPE_PCM
): ArrayBuffer {
  const buf = new ArrayBuffer(FRAME_HEADER_BYTES + payload.byteLength);
  const view = new DataView(buf);
  view.setUint32(0, timestampMs >>> 0, false);
  view.setUint16(4, payload.byteLength, false);
  view.setUint8(6, payloadType >>> 0);
  new Uint8Array(buf).set(payload, FRAME_HEADER_BYTES);
  return buf;
}

/**
 * Decode a binary audio frame. Returns null if buffer too small.
 */
export function decodeAudioFrame(
  buffer: ArrayBuffer
): { timestamp: number; payload: Uint8Array; payloadType: number } | null {
  if (buffer.byteLength < FRAME_HEADER_BYTES) return null;
  const view = new DataView(buffer);
  const timestamp = view.getUint32(0, false);
  const len = view.getUint16(4, false);
  const payloadType = view.getUint8(6);
  if (buffer.byteLength < FRAME_HEADER_BYTES + len) return null;
  const payload = new Uint8Array(buffer.slice(FRAME_HEADER_BYTES, FRAME_HEADER_BYTES + len));
  return { timestamp, payload, payloadType };
}

const TIMESTAMP_BYTES = 8;

/**
 * Encode a chunk with client timestamp for RTT measurement.
 * Layout: [8 bytes big-endian timestamp][...payload]
 */
export function encodeChunkWithTimestamp(payload: Uint8Array, clientTimeMs: number): ArrayBuffer {
  const buf = new ArrayBuffer(TIMESTAMP_BYTES + payload.byteLength);
  const view = new DataView(buf);
  view.setBigUint64(0, BigInt(Math.round(clientTimeMs)), false);
  new Uint8Array(buf).set(payload, TIMESTAMP_BYTES);
  return buf;
}

/**
 * Decode timestamp from first 8 bytes (big-endian). Returns null if buffer too small.
 */
export function decodeTimestamp(buffer: ArrayBuffer): number | null {
  if (buffer.byteLength < TIMESTAMP_BYTES) return null;
  return Number(new DataView(buffer).getBigUint64(0, false));
}

/**
 * Slice payload after the 8-byte timestamp. Returns full buffer if no timestamp prefix.
 */
export function payloadAfterTimestamp(buffer: ArrayBuffer): Uint8Array {
  if (buffer.byteLength <= TIMESTAMP_BYTES) return new Uint8Array(0);
  return new Uint8Array(buffer.slice(TIMESTAMP_BYTES));
}

export function parseClientJson(data: string): ClientToServerJson | null {
  try {
    const obj = JSON.parse(data) as {
      type?: string;
      value?: boolean;
      text?: string;
      turnId?: string;
      systemPrompt?: string;
    };
    if (obj.type === "session.init" && typeof obj.systemPrompt === "string" && obj.systemPrompt.trim().length > 0) {
      return { type: "session.init", systemPrompt: obj.systemPrompt.trim() };
    }
    if (obj.type === "control.mute" && typeof obj.value === "boolean") {
      return { type: "control.mute", value: obj.value };
    }
    if (obj.type === "transcript_final" && typeof obj.text === "string") {
      return {
        type: "transcript_final",
        text: obj.text,
        ...(typeof obj.turnId === "string" ? { turnId: obj.turnId } : {}),
      };
    }
    if (obj.type === "control.interrupt") {
      return { type: "control.interrupt" };
    }
    return null;
  } catch {
    return null;
  }
}

export function serializeServerJson(msg: ServerToClientJson): string {
  return JSON.stringify(msg);
}

/** Client-side: per-turn metrics derived from benchmark events. */
export interface TurnMetrics {
  turnIndex: number;
  turnStartTs: number;
  llmFirstTs?: number;
  ttsFirstTs?: number;
  turnEndTs?: number;
  turnInterruptedTs?: number;
  interrupted: boolean;
  /** Derived: llm_first_token.ts - turn_start.ts */
  ttftMs?: number;
  /** Derived: tts_first_chunk.ts - turn_start.ts */
  ttfaMs?: number;
  /** Derived: tts_first_chunk.ts - llm_first_token.ts */
  llmToTtsMs?: number;
  /** Derived: turn_end or turn_interrupted - turn_start */
  durationMs?: number;
}

/** Type guard: message is a benchmark event from server. */
export function isBenchmarkEvent(msg: { type?: string }): msg is BenchmarkEvent {
  return typeof msg.type === "string" && msg.type.startsWith("benchmark.");
}
