import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@shvm/vani-client/headless", () => {
  return {
    useVoiceSession: () => ({
      status: "disconnected",
      serverStatus: "idle",
      transcript: [],
      history: [],
      error: null,
      isPlaying: false,
      vadLoading: false,
      connect: vi.fn(),
      cancel: vi.fn(),
    }),
  };
});

describe("<Vani /> (ui integration)", () => {
  it("wraps in .vani-root and renders using headless state", async () => {
    const { Vani } = await import("@shvm/vani-client/ui");
    render(<Vani defaultMode="full" />);
    expect(document.querySelector(".vani-root")).toBeTruthy();
    expect(screen.getByText("Ready")).toBeTruthy();
  });
});

