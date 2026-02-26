/**
 * Vani 2 client-facing types (Phase 1).
 * No React/VAD; used by test client and future UI.
 */

import type { SessionState } from "../protocol";

export type { SessionState };

export interface Vani2ClientConfig {
  /** Echo delay in ms (server-side; 0 for latency measurement). */
  echoDelayMs?: number;
  /** Chunk size in bytes for fixed-size frames. */
  chunkSize?: number;
}

export interface Vani2ConnectionState {
  state: SessionState;
  error: string | null;
}
