import type { LLMModelId, STTModelId, TTSModelId, TtsVoiceId } from "../constants/models";

export type ChatRole = "user" | "assistant" | "system";

export type VoiceStatus =
  | "disconnected"
  | "connecting"
  | "idle"
  | "listening"
  | "processing"
  | "speaking"
  | "error";

export type SessionStatus = "idle" | "listening" | "thinking" | "speaking" | "error";

export interface VoiceConfig {
  sttModel?: STTModelId;
  llmModel?: LLMModelId;
  tts?: {
    speaker?: TtsVoiceId;
    encoding?: "mp3" | "opus" | "aac" | "lossless";
    container?: "mp3" | "ogg" | "aac" | "wav";
    sample_rate?: 16000 | 24000 | 44100 | 48000;
    bit_rate?: number;
    model?: TTSModelId;
  };
}

export interface ClientMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: number;
}

export interface ServerMessage {
  id: string;
  role: ChatRole;
  content: string;
  created_at: number;
}
