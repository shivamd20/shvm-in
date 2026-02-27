/**
 * Vani 2 public API types.
 * Use these types when integrating the headless useVani hook.
 *
 * Edge cases:
 * - **Duplicate turnId**: The server rejects duplicate turn ids for transcript_final. Use a unique id per user turn
 *   (e.g. incrementing counter or UUID). The useVani hook uses a per-session counter internally.
 * - **Turn already in progress**: If you send a new transcript while the assistant is still responding, the server
 *   returns an error. The hook sends interrupt automatically when the user starts speaking (StartOfTurn/TurnResumed)
 *   while the assistant is speaking, so this is handled for you when using useVani.
 */

import type { SessionState } from "../protocol";

export type { SessionState };

/**
 * Configuration for the Vani hook.
 *
 * - **systemPrompt**: Instructs the assistant how to behave. Sent to the server on connect via `session.init`.
 *   If you reconnect to the same session, send the same system prompt again (the hook does this automatically).
 *
 * - **serverBaseUrl**: Origin of the Vani server (e.g. `https://api.example.com`). Defaults to `window.location.origin` in the browser.
 *
 * - **sessionId**: If provided, the client **joins** this existing session (one session = one Durable Object).
 *   If omitted, the hook creates a new session (generates an id or you can obtain one via `POST /v2/sessions`).
 *   Reconnecting with the same sessionId reuses the same DO and conversation history.
 *
 * @see https://developers.cloudflare.com/durable-objects/ - One session id maps to one DO instance by name.
 */
export interface VaniConfig {
  /** System prompt for the assistant. Required. Sent on connect and after reconnection. */
  systemPrompt: string;
  /** Server origin. Defaults to window.location.origin in the browser. */
  serverBaseUrl?: string;
  /** Existing session id to join. If omitted, a new session is created. */
  sessionId?: string;
}

/**
 * Read-only session info exposed by the hook.
 *
 * **One session = one Durable Object.** The same sessionId always resolves to the same DO instance.
 * Reconnecting with the same sessionId rejoins the same conversation (same message history and state).
 */
export interface VaniSession {
  /** Current session id. Use this to rejoin after a page reload or to share the session (e.g. for multi-tab or multi-device). */
  sessionId: string;
}

/**
 * Connection and lifecycle status of the Vani session.
 *
 * - **idle**: Not started; call start() to begin.
 * - **connecting**: Connecting to session WebSocket and/or transcription (Flux).
 * - **connected**: Ready; microphone is live and the assistant will respond to speech.
 * - **error**: A connection or server error occurred (check the `error` field).
 */
export type VaniStatus = "idle" | "connecting" | "connected" | "error";

/**
 * Actions exposed by the useVani hook. There is **no pause**; only start, mute, and stop.
 *
 * - **start()**: Starts the session: connects to the server, sends the system prompt, and starts listening.
 *   Safe to call when already connected (no-op). Requires microphone permission; the browser may prompt.
 *   On visibility change to visible, the hook resumes the AudioContext if it was suspended (e.g. after tab background).
 *
 * - **stop()**: Ends the session: disconnects transcription and session WebSocket. Safe to call when already idle (no-op).
 *
 * - **mute(muted)**: Mutes or unmutes the microphone. Does **not** pause playback or the assistant;
 *   it only stops sending audio. To stop the assistant from speaking, use interrupt (the hook sends interrupt
 *   automatically when the user starts speaking while the assistant is speaking).
 *
 * @see VaniConfig for systemPrompt and sessionId.
 */
export interface VaniActions {
  /** Start listening and talking. No-op if already connected. */
  start: () => void;
  /** Stop the session and disconnect. No-op if already idle. */
  stop: () => void;
  /** Mute (true) or unmute (false) the microphone. Does not pause; only stops sending audio. */
  mute: (muted: boolean) => void;
}

/**
 * Legacy client config (echo delay, chunk size). Kept for backward compatibility with low-level hooks.
 */
export interface Vani2ClientConfig {
  /** Echo delay in ms (server-side; 0 for latency measurement). */
  echoDelayMs?: number;
  /** Chunk size in bytes for fixed-size frames. */
  chunkSize?: number;
}

/**
 * Legacy connection state. Kept for backward compatibility.
 */
export interface Vani2ConnectionState {
  state: SessionState;
  error: string | null;
}
