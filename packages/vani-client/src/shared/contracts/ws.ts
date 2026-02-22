import type { SessionStatus, VoiceConfig } from "../types/voice";

export type ClientToServerJson =
  | { type: "start"; config?: VoiceConfig }
  | { type: "stop" }
  | { type: "reset" }
  | { type: "text.message"; content: string }
  | { type: "tool.execute.response"; callId: string; result: any }
  | { type: "tool.execute.error"; callId: string; error: string };

export type LegacyClientToServerJson = { type: "text"; value: string };
export type AnyClientToServerJson = ClientToServerJson | LegacyClientToServerJson;

export type ServerToClientJson =
  | { type: "state"; value: SessionStatus }
  | { type: "transcript.final"; text: string }
  | { type: "assistant.message"; message: { role: "assistant"; content: string } }
  | { type: "assistant.partial"; text: string }
  | { type: "feedback"; message: string }
  | { type: "error"; reason: string }
  | { type: "tool.call.start"; toolName: string }
  | { type: "tool.call.end"; toolName: string }
  | { type: "tool.execute.request"; toolName: string; callId: string; parameters: any };
