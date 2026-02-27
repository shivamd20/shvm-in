import { describe, it, expect } from "vitest";
import {
  encodeChunkWithTimestamp,
  decodeTimestamp,
  payloadAfterTimestamp,
  encodeAudioFrame,
  decodeAudioFrame,
  FRAME_HEADER_BYTES,
  parseClientJson,
  serializeServerJson,
  type ServerToClientJson,
} from "../protocol";

describe("protocol", () => {
  describe("encodeChunkWithTimestamp / decodeTimestamp / payloadAfterTimestamp", () => {
    it("round-trips timestamp and payload", () => {
      const payload = new Uint8Array([1, 2, 3]);
      const clientTimeMs = 1234567890;
      const buf = encodeChunkWithTimestamp(payload, clientTimeMs);
      expect(buf.byteLength).toBe(8 + 3);
      expect(decodeTimestamp(buf)).toBe(clientTimeMs);
      expect(Array.from(payloadAfterTimestamp(buf))).toEqual([1, 2, 3]);
    });

    it("returns null for buffer smaller than 8 bytes", () => {
      expect(decodeTimestamp(new ArrayBuffer(4))).toBeNull();
      expect(decodeTimestamp(new ArrayBuffer(0))).toBeNull();
    });

    it("payloadAfterTimestamp returns empty for small buffer", () => {
      const buf = new ArrayBuffer(8);
      expect(payloadAfterTimestamp(buf).length).toBe(0);
    });
  });

  describe("parseClientJson", () => {
    it("parses control.mute true", () => {
      expect(parseClientJson('{"type":"control.mute","value":true}')).toEqual({
        type: "control.mute",
        value: true,
      });
    });

    it("parses control.mute false", () => {
      expect(parseClientJson('{"type":"control.mute","value":false}')).toEqual({
        type: "control.mute",
        value: false,
      });
    });

    it("returns null for invalid JSON", () => {
      expect(parseClientJson("not json")).toBeNull();
    });

    it("returns null for wrong type", () => {
      expect(parseClientJson('{"type":"other"}')).toBeNull();
    });

    it("returns null when value is not boolean", () => {
      expect(parseClientJson('{"type":"control.mute","value":1}')).toBeNull();
    });
  });

  describe("encodeAudioFrame / decodeAudioFrame", () => {
    it("round-trips timestamp and payload", () => {
      const payload = new Uint8Array([1, 2, 3, 4, 5]);
      const ts = 1234567890;
      const buf = encodeAudioFrame(ts, payload);
      expect(buf.byteLength).toBe(FRAME_HEADER_BYTES + 5);
      const decoded = decodeAudioFrame(buf);
      expect(decoded).not.toBeNull();
      expect(decoded!.timestamp).toBe(ts);
      expect(Array.from(decoded!.payload)).toEqual([1, 2, 3, 4, 5]);
    });

    it("returns null for buffer smaller than header", () => {
      expect(decodeAudioFrame(new ArrayBuffer(4))).toBeNull();
      expect(decodeAudioFrame(new ArrayBuffer(0))).toBeNull();
    });

    it("returns null when payload length exceeds buffer", () => {
      const buf = new ArrayBuffer(FRAME_HEADER_BYTES + 2);
      const view = new DataView(buf);
      view.setUint32(0, 0, false);
      view.setUint16(4, 100, false); // claims 100 bytes payload
      expect(decodeAudioFrame(buf)).toBeNull();
    });
  });

  describe("serializeServerJson", () => {
    it("serializes state", () => {
      const msg: ServerToClientJson = { type: "state", value: "streaming" };
      expect(serializeServerJson(msg)).toBe('{"type":"state","value":"streaming"}');
    });

    it("serializes error", () => {
      const msg: ServerToClientJson = { type: "error", reason: "bad" };
      expect(serializeServerJson(msg)).toBe('{"type":"error","reason":"bad"}');
    });
  });
});
