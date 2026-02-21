import type { DebugEvent } from "@shvm/vani-client/headless";
import type { ClientMessage, VoiceConfig, VoiceStatus } from "@shvm/vani-client/shared";

export interface VaniProps {
  onError?: (error: string) => void;
  onMessage?: (msg: { role: "user" | "assistant"; content: string }) => void;
  initialTranscript?: ClientMessage[];
  defaultMode?: "full" | "pip";
  mode?: "full" | "pip";
  onModeChange?: (mode: "full" | "pip") => void;
  initialConfig?: VoiceConfig;
  /**
   * Base server URL for websocket URL construction.
   *
   * Default: `https://shvm.in`
   */
  serverUrl?: string;
}

export interface VaniViewProps {
  status: VoiceStatus;
  transcript: ClientMessage[];
  history: DebugEvent[];
  error: string | null;
  connect: () => void;
  cancel: () => void;
  vadLoading: boolean;
  onTogglePip?: () => void;
  config?: VoiceConfig;
  setConfig?: (config: VoiceConfig) => void;
  feedback?: string | null;
}

