/**
 * Simple session state: connected | streaming | closed.
 */

export type SessionStateValue = "connected" | "streaming" | "closed";

export class SessionState {
  private value: SessionStateValue = "connected";

  get(): SessionStateValue {
    return this.value;
  }

  setConnected(): void {
    this.value = "connected";
  }

  setStreaming(): void {
    if (this.value !== "closed") this.value = "streaming";
  }

  setClosed(): void {
    this.value = "closed";
  }

  isClosed(): boolean {
    return this.value === "closed";
  }
}
