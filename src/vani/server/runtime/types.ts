import type { ServerMessage, SessionStatus, VoiceConfig, ServerToClientJson } from "@shvm/vani-client/shared";

export interface ServerContext {
    status: SessionStatus;
    messages: ServerMessage[];
    audioBuffer: Uint8Array[];
    env: any; // Cloudflare Env
    storage: any; // Durable Object Storage
    broadcast: (msg: ServerToClientJson) => void;
    sendBinary: (data: ArrayBuffer) => void;
    config: VoiceConfig;
}

export type ServerEvent =
    | { type: "START"; config?: VoiceConfig }
    | { type: "STOP" }
    | { type: "AUDIO_CHUNK"; data: ArrayBuffer }
    | { type: "TEXT_MESSAGE"; content: string }
    | { type: "TRANSCRIPT_READY"; text: string }
    | { type: "LLM_PARTIAL"; text: string }
    | { type: "TOOL_CALL_START"; toolName: string }
    | { type: "TOOL_CALL_END"; toolName: string }
    | { type: "TTS_AUDIO"; data: ArrayBuffer }
    | { type: "llm.complete"; output: string }
    | { type: "error.platform.stt"; data: unknown }
    | { type: "error.platform.llm"; data: unknown }
    | { type: "RESET" };
