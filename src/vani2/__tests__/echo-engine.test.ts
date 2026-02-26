import { describe, it, expect, vi, beforeEach } from "vitest";
import { EchoEngine } from "../server/echo-engine";

describe("EchoEngine", () => {
  let emitted: ArrayBuffer[];
  let schedule: (fn: () => void, ms: number) => void;
  let now: number;

  beforeEach(() => {
    emitted = [];
    now = 1000;
    vi.useFakeTimers();
    schedule = (fn, ms) => {
      return setTimeout(() => {
        now += ms;
        fn();
      }, ms) as unknown as ReturnType<typeof setTimeout>;
    };
  });

  it("emits immediately when delayMs is 0", () => {
    const engine = new EchoEngine({
      delayMs: 0,
      emit: (c) => emitted.push(c),
      schedule,
    });
    engine.push(new Uint8Array([1]).buffer);
    engine.push(new Uint8Array([2]).buffer);
    expect(emitted.length).toBe(2);
    expect(new Uint8Array(emitted[0])[0]).toBe(1);
    expect(new Uint8Array(emitted[1])[0]).toBe(2);
  });

  it("emits in order after delay", () => {
    const engine = new EchoEngine({
      delayMs: 10,
      emit: (c) => emitted.push(c),
      schedule,
    });
    engine.push(new Uint8Array([1]).buffer);
    engine.push(new Uint8Array([2]).buffer);
    expect(emitted.length).toBe(0);
    vi.advanceTimersByTime(10);
    expect(emitted.length).toBe(2);
    expect(new Uint8Array(emitted[0])[0]).toBe(1);
    expect(new Uint8Array(emitted[1])[0]).toBe(2);
  });

  it("flush emits all pending immediately", () => {
    const engine = new EchoEngine({
      delayMs: 100,
      emit: (c) => emitted.push(c),
      schedule,
    });
    engine.push(new Uint8Array([1]).buffer);
    engine.flush();
    expect(emitted.length).toBe(1);
    expect(new Uint8Array(emitted[0])[0]).toBe(1);
  });
});
