/**
 * Vani 2 public API.
 *
 * Minimal surface: useVani(systemPrompt, options) for a headless voice session.
 * One session = one Durable Object; create via POST /v2/sessions or pass sessionId to join.
 */

export { useVani, type UseVaniOptions, type UseVaniResult } from "./ui/useVani";
export type {
  VaniConfig,
  VaniSession,
  VaniStatus,
  VaniActions,
  Vani2ClientConfig,
  Vani2ConnectionState,
  SessionState,
} from "./client/types";
