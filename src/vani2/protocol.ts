/**
 * Vani 2 minimal wire protocol.
 * Client → Server: binary = audio.chunk; JSON = control.mute
 * Server → Client: binary = audio.frame; JSON = optional state
 */

/** Client → Server JSON */
export type ClientToServerJson = { type: "control.mute"; value: boolean };

/** Server → Client JSON */
export type ServerToClientJson =
  | { type: "state"; value: SessionState }
  | { type: "error"; reason: string };

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
    const obj = JSON.parse(data) as { type?: string; value?: boolean };
    if (obj.type === "control.mute" && typeof obj.value === "boolean") {
      return { type: "control.mute", value: obj.value };
    }
    return null;
  } catch {
    return null;
  }
}

export function serializeServerJson(msg: ServerToClientJson): string {
  return JSON.stringify(msg);
}
