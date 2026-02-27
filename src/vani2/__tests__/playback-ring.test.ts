import { describe, it, expect } from "vitest";
import {
  createPlaybackRing,
  pushFrame,
  takeFrame,
  bufferedMs,
  enforceCap,
} from "../ui/playback-ring";

describe("playback-ring", () => {
  it("starts empty", () => {
    const ring = createPlaybackRing();
    expect(ring.frames.length).toBe(0);
    expect(bufferedMs(ring)).toBe(0);
    expect(takeFrame(ring)).toBeNull();
  });

  it("push and take in order", () => {
    const ring = createPlaybackRing();
    const a = new ArrayBuffer(10);
    const b = new ArrayBuffer(20);
    pushFrame(ring, a);
    pushFrame(ring, b);
    expect(bufferedMs(ring)).toBe(40);
    expect(takeFrame(ring)).toBe(a);
    expect(takeFrame(ring)).toBe(b);
    expect(takeFrame(ring)).toBeNull();
  });

  it("drops oldest when full (max 10 frames = 200ms)", () => {
    const ring = createPlaybackRing();
    for (let i = 0; i < 15; i++) {
      pushFrame(ring, new ArrayBuffer(1));
    }
    expect(ring.frames.length).toBe(10);
    expect(bufferedMs(ring)).toBe(200);
  });

  it("enforceCap drops excess", () => {
    const ring = createPlaybackRing();
    ring.maxFrames = 3;
    for (let i = 0; i < 5; i++) {
      ring.frames.push(new ArrayBuffer(1));
    }
    enforceCap(ring);
    expect(ring.frames.length).toBe(3);
  });
});
