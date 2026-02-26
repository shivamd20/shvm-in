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

/** Binary from client: opaque audio chunk. First 8 bytes may be client timestamp (big-endian) for RTT. */
export type AudioChunk = ArrayBuffer;

/** Binary from server: echo frame. Same layout as chunk for RTT measurement. */
export type AudioFrame = ArrayBuffer;

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
