import { describe, it, expect } from "vitest";
import { SessionState } from "../server/session-state";

describe("SessionState", () => {
  it("starts connected", () => {
    const s = new SessionState();
    expect(s.get()).toBe("connected");
    expect(s.isClosed()).toBe(false);
  });

  it("transitions to streaming", () => {
    const s = new SessionState();
    s.setStreaming();
    expect(s.get()).toBe("streaming");
  });

  it("transitions to closed", () => {
    const s = new SessionState();
    s.setClosed();
    expect(s.get()).toBe("closed");
    expect(s.isClosed()).toBe(true);
  });

  it("setStreaming after closed does not change", () => {
    const s = new SessionState();
    s.setClosed();
    s.setStreaming();
    expect(s.get()).toBe("closed");
  });

  it("setConnected sets connected", () => {
    const s = new SessionState();
    s.setStreaming();
    s.setConnected();
    expect(s.get()).toBe("connected");
  });
});
