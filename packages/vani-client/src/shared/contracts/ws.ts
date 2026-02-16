import type { SessionStatus, VoiceConfig } from "../types/voice";

export type ClientToServerJson =
  | { type: "start"; config?: VoiceConfig }
  | { type: "stop" }
  | { type: "reset" }
  | { type: "text.message"; content: string };

export type LegacyClientToServerJson = { type: "text"; value: string };
export type AnyClientToServerJson = ClientToServerJson | LegacyClientToServerJson;

export type ServerToClientJson =
  | { type: "state"; value: SessionStatus }
  | { type: "transcript.final"; text: string }
  | { type: "assistant.message"; message: { role: "assistant"; content: string } }
  | { type: "assistant.partial"; text: string }
  | { type: "feedback"; message: string }
  | { type: "error"; reason: string };
