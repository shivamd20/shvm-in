import { describe, it, expect, vi, beforeEach } from "vitest";
import { createActor } from "xstate";
import { sessionMachine } from "../server/session-machine";

describe("sessionMachine", () => {
  let sessionState: { get(): string; setStreaming(): void; setClosed(): void };
  let ringBuffer: { push(chunk: ArrayBuffer): void; takeAll(): ArrayBuffer[] };
  let echoEngine: { push(chunk: ArrayBuffer): void; flush(): void };
  let cleanup: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionState = {
      get: vi.fn(() => "connected"),
      setStreaming: vi.fn(),
      setClosed: vi.fn(),
    };
    const buffers: ArrayBuffer[] = [];
    ringBuffer = {
      push: vi.fn((chunk: ArrayBuffer) => buffers.push(chunk)),
      takeAll: vi.fn(() => buffers.splice(0, buffers.length)),
    };
    echoEngine = {
      push: vi.fn(),
      flush: vi.fn(),
    };
    cleanup = vi.fn();
  });

  it("starts in connected", () => {
    const actor = createActor(sessionMachine, {
      input: { sessionState, ringBuffer, echoEngine, cleanup },
    });
    actor.start();
    expect(actor.getSnapshot().value).toBe("connected");
  });

  it("transitions to streaming on BINARY and pushes to ring/echo", () => {
    const actor = createActor(sessionMachine, {
      input: { sessionState, ringBuffer, echoEngine, cleanup },
    });
    actor.start();
    const chunk = new ArrayBuffer(4);
    actor.send({ type: "BINARY", chunk });
    expect(actor.getSnapshot().value).toBe("streaming");
    expect(sessionState.setStreaming).toHaveBeenCalled();
    expect(ringBuffer.push).toHaveBeenCalledWith(chunk);
  });

  it("transitions to closed on CLOSE and runs cleanup", () => {
    const actor = createActor(sessionMachine, {
      input: { sessionState, ringBuffer, echoEngine, cleanup },
    });
    actor.start();
    actor.send({ type: "CLOSE" });
    expect(actor.getSnapshot().value).toBe("closed");
    expect(actor.getSnapshot().status).toBe("done");
    expect(cleanup).toHaveBeenCalled();
  });

  it("transitions to closed on ERROR and runs cleanup", () => {
    const actor = createActor(sessionMachine, {
      input: { sessionState, ringBuffer, echoEngine, cleanup },
    });
    actor.start();
    actor.send({ type: "ERROR", error: new Error("test") });
    expect(actor.getSnapshot().value).toBe("closed");
    expect(cleanup).toHaveBeenCalled();
  });
});
