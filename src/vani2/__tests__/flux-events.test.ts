import { describe, it, expect } from "vitest";
import { parseFluxEvent, isFluxEventPayload, type FluxEventPayload } from "../flux-events";

describe("flux-events", () => {
  describe("parseFluxEvent", () => {
    it("parses Update event with transcript", () => {
      const json = JSON.stringify({
        request_id: "abc-123",
        sequence_id: 1,
        event: "Update",
        turn_index: 0,
        transcript: "Hello world",
        audio_window_start: 0.1,
        audio_window_end: 0.5,
      });
      const payload = parseFluxEvent(json);
      expect(payload).not.toBeNull();
      expect(payload!.event).toBe("Update");
      expect(payload!.transcript).toBe("Hello world");
      expect(payload!.turn_index).toBe(0);
    });

    it("parses EndOfTurn event", () => {
      const json = JSON.stringify({
        event: "EndOfTurn",
        turn_index: 0,
        transcript: "Final text",
        end_of_turn_confidence: 0.9,
      });
      const payload = parseFluxEvent(json);
      expect(payload).not.toBeNull();
      expect(payload!.event).toBe("EndOfTurn");
      expect(payload!.transcript).toBe("Final text");
    });

    it("parses StartOfTurn, EagerEndOfTurn, TurnResumed", () => {
      for (const event of ["StartOfTurn", "EagerEndOfTurn", "TurnResumed"]) {
        const json = JSON.stringify({ event, turn_index: 0 });
        const payload = parseFluxEvent(json);
        expect(payload).not.toBeNull();
        expect(payload!.event).toBe(event);
      }
    });

    it("returns null for invalid JSON", () => {
      expect(parseFluxEvent("not json")).toBeNull();
      expect(parseFluxEvent("")).toBeNull();
    });

    it("returns object for JSON without event (raw payload)", () => {
      const json = JSON.stringify({ request_id: "x" });
      const payload = parseFluxEvent(json);
      expect(payload).not.toBeNull();
      expect(payload!.request_id).toBe("x");
      expect(payload!.event).toBeUndefined();
    });
  });

  describe("isFluxEventPayload", () => {
    it("returns true for payload with known event type", () => {
      expect(isFluxEventPayload({ event: "Update" } as FluxEventPayload)).toBe(true);
      expect(isFluxEventPayload({ event: "EndOfTurn" } as FluxEventPayload)).toBe(true);
      expect(isFluxEventPayload({ event: "StartOfTurn" } as FluxEventPayload)).toBe(true);
      expect(isFluxEventPayload({ event: "EagerEndOfTurn" } as FluxEventPayload)).toBe(true);
      expect(isFluxEventPayload({ event: "TurnResumed" } as FluxEventPayload)).toBe(true);
    });

    it("returns false for null or payload without event", () => {
      expect(isFluxEventPayload(null)).toBe(false);
      expect(isFluxEventPayload({} as FluxEventPayload)).toBe(false);
      expect(isFluxEventPayload({ event: "Unknown" } as FluxEventPayload)).toBe(false);
    });
  });
});
