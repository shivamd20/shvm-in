import {
  Mic,
  MicOff,
  Volume2,
  Loader2,
  Radio,
  WifiOff,
  AlertCircle,
  Terminal,
  Minimize2,
  Square,
  Settings,
  X,
  Save,
} from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";
import { VoiceDebugSidebar } from "../components/VoiceDebugSidebar";
import type { VaniViewProps } from "../types";
import { LLM_MODELS, STT_MODELS, TTS_MODELS, TTS_MODEL_VOICES } from "@shvm/vani-client/shared";
import type { VoiceConfig } from "@shvm/vani-client/shared";

export function FullScreenMode({
  status,
  transcript,
  history,
  error,
  connect,
  cancel,
  vadLoading,
  onTogglePip,
  config,
  setConfig,
  feedback,
  isMuted,
  toggleMute,
}: VaniViewProps) {
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const [localConfig, setLocalConfig] = useState<VoiceConfig>(config || {});

  useEffect(() => {
    if (config) setLocalConfig(config);
  }, [config]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [transcript]);

  const availableVoices = useMemo(() => {
    const model = localConfig.tts?.model || TTS_MODELS[0];
    return TTS_MODEL_VOICES[model] || [];
  }, [localConfig.tts?.model]);

  useEffect(() => {
    if (localConfig.tts?.speaker && !availableVoices.includes(localConfig.tts.speaker as any)) {
      setLocalConfig({
        ...localConfig,
        tts: { ...localConfig.tts, speaker: availableVoices[0] as any },
      });
    }
  }, [availableVoices, localConfig]);

  const handleSaveConfig = () => {
    setConfig?.(localConfig);
    setIsSettingsOpen(false);
  };

  const isListening = status === "listening";
  const isThinking = status === "processing";
  const isSpeaking = status === "speaking";
  const isConnecting = status === "connecting";
  const isDisconnected = status === "disconnected";
  const isError = status === "error";

  return (
    <div className="fixed inset-0 min-h-screen bg-black text-zinc-100 flex flex-col items-center justify-center p-4 selection:bg-accent/20 overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vh] h-[60vh] blur-[120px] rounded-full opacity-20 transition-all duration-700
          ${isListening
              ? "bg-green-500 scale-125"
              : isThinking
                ? "bg-yellow-500 scale-110"
                : isSpeaking
                  ? "bg-blue-600 scale-125"
                  : isError
                    ? "bg-red-600 scale-110"
                    : isDisconnected
                      ? "bg-zinc-800 scale-90"
                      : "bg-zinc-800 scale-100"
            }`}
        />
      </div>

      <div className="absolute top-4 right-4 z-50 flex gap-2">
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="p-2 rounded-full hover:bg-zinc-900 text-zinc-500 hover:text-zinc-300 transition-colors"
          title="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
        {toggleMute && (
          <button
            onClick={toggleMute}
            className={`p-2 rounded-full hover:bg-zinc-900 transition-colors ${isMuted ? "text-red-500 hover:text-red-400" : "text-zinc-500 hover:text-zinc-300"
              }`}
            title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
        )}
        {onTogglePip && (
          <button
            onClick={onTogglePip}
            className="p-2 rounded-full hover:bg-zinc-900 text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Enter Picture-in-Picture Mode"
          >
            <Minimize2 className="w-5 h-5" />
          </button>
        )}
      </div>

      {isSettingsOpen && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-white">Voice Settings</h2>
              <button onClick={() => setIsSettingsOpen(false)} className="text-zinc-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-zinc-500 mb-1 uppercase">LLM Model</label>
                <select
                  value={localConfig.llmModel || LLM_MODELS[0]}
                  onChange={(e) => setLocalConfig({ ...localConfig, llmModel: e.target.value as any })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none appearance-none"
                >
                  {LLM_MODELS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-500 mb-1 uppercase">STT Model</label>
                <select
                  value={localConfig.sttModel || STT_MODELS[0]}
                  onChange={(e) => setLocalConfig({ ...localConfig, sttModel: e.target.value as any })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none appearance-none"
                >
                  {STT_MODELS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-500 mb-1 uppercase">TTS Model</label>
                <select
                  value={localConfig.tts?.model || TTS_MODELS[0]}
                  onChange={(e) =>
                    setLocalConfig({ ...localConfig, tts: { ...localConfig.tts, model: e.target.value as any } })
                  }
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none appearance-none"
                >
                  {TTS_MODELS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-500 mb-1 uppercase">Voice</label>
                <select
                  value={localConfig.tts?.speaker || (availableVoices[0] as any)}
                  onChange={(e) =>
                    setLocalConfig({ ...localConfig, tts: { ...localConfig.tts, speaker: e.target.value as any } })
                  }
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none appearance-none"
                >
                  {availableVoices.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-2 text-sm font-mono text-zinc-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveConfig}
                className="px-4 py-2 text-sm font-mono bg-blue-600 hover:bg-blue-500 text-white rounded flex items-center gap-2 transition-colors"
              >
                <Save className="w-4 h-4" /> Save
              </button>
            </div>
          </div>
        </div>
      )}

      {feedback && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[70]">
          <div className="text-yellow-400 text-sm font-mono bg-yellow-900/20 px-3 py-1 rounded border border-yellow-900/50 animate-in fade-in slide-in-from-top-2 max-w-xs text-center break-words">
            {feedback}
          </div>
        </div>
      )}

      {isError && error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[70]">
          <div className="text-red-400 text-sm font-mono bg-red-900/20 px-3 py-1 rounded border border-red-900/50 animate-in fade-in slide-in-from-top-2 max-w-xs text-center break-words">
            {error}
          </div>
        </div>
      )}

      <div className="relative z-10 flex flex-col items-center gap-6">
        <div className="text-center">
          <h1 className="text-3xl md:text-4xl font-display font-semibold tracking-tight">
            {isListening
              ? "Listening"
              : isThinking
                ? "Processing"
                : isSpeaking
                  ? "Speaking"
                  : isConnecting
                    ? "Connecting"
                    : isError
                      ? "Error"
                      : isDisconnected
                        ? "Ready"
                        : "Ready"}
          </h1>

          <div className="mt-3 flex justify-center">
            <div
              className={`h-1.5 rounded-full transition-all duration-500 ${isListening
                ? "w-16 bg-green-500"
                : isThinking
                  ? "w-16 bg-yellow-500 animate-pulse"
                  : isSpeaking
                    ? "w-24 bg-blue-500"
                    : isConnecting
                      ? "w-8 bg-zinc-500 animate-pulse"
                      : isError
                        ? "w-16 bg-red-500 conversation-shake"
                        : "w-2 bg-zinc-700"
                }`}
            />
          </div>
        </div>

        <button
          disabled={isConnecting || isError || isDisconnected}
          onClick={() => (isThinking || isSpeaking) && cancel()}
          className={`group relative w-48 h-48 rounded-full flex items-center justify-center border-4 transition-all duration-300 outline-none
            ${isListening
              ? "border-green-500/50 bg-green-500/10 scale-105 shadow-[0_0_40px_rgba(34,197,94,0.3)]"
              : isThinking
                ? "border-yellow-500/50 bg-yellow-500/10 shadow-[0_0_40px_rgba(234,179,8,0.3)] animate-pulse cursor-pointer hover:border-red-500/50 hover:bg-red-500/10"
                : isSpeaking
                  ? "border-blue-500/50 bg-blue-500/10 shadow-[0_0_40px_rgba(59,130,246,0.3)] cursor-pointer hover:border-red-500/50 hover:bg-red-500/10"
                  : isError
                    ? "border-red-500/50 bg-red-500/10 hover:border-red-400 cursor-not-allowed"
                    : isDisconnected
                      ? "border-zinc-800/50 bg-black/50 cursor-not-allowed"
                      : "border-zinc-800 bg-zinc-900 hover:border-zinc-700 hover:bg-zinc-800"
            }`}
        >
          {isListening ? (
            <Radio className="w-16 h-16 text-green-500 animate-pulse" />
          ) : isThinking ? (
            <Loader2 className="w-16 h-16 text-yellow-500 animate-spin group-hover:hidden" />
          ) : isSpeaking ? (
            <Volume2 className="w-16 h-16 text-blue-500 animate-bounce group-hover:hidden" />
          ) : isError ? (
            <AlertCircle className="w-16 h-16 text-red-500" />
          ) : isDisconnected ? (
            <WifiOff className="w-16 h-16 text-zinc-600" />
          ) : (
            <Mic className="w-16 h-16 text-zinc-500" />
          )}
          {(isThinking || isSpeaking) && (
            <Square className="w-16 h-16 text-red-500 absolute hidden group-hover:block fill-current" />
          )}
        </button>

        {(isError || isDisconnected) ? (
          <button
            onClick={() => connect()}
            className="text-zinc-400 hover:text-white text-sm font-mono border border-zinc-700 px-4 py-2 rounded hover:bg-zinc-800 transition-colors"
          >
            {isError ? "Retry Connection" : "Start Voice Session"}
          </button>
        ) : isThinking || isSpeaking ? (
          <button
            onClick={cancel}
            className="text-zinc-400 hover:text-red-400 text-sm font-mono border border-zinc-700 px-4 py-2 rounded hover:bg-zinc-800 transition-colors flex items-center gap-2"
          >
            <Square className="w-3 h-3 fill-current" /> Stop
          </button>
        ) : (
          <p className="text-zinc-500 text-sm font-mono text-center h-6">
            {vadLoading ? "Loading voice activity detection…" : "Just start talking"}
          </p>
        )}

        <div className="w-full min-h-[150px] max-h-[30vh] overflow-y-auto space-y-4 mask-gradient-b flex flex-col pb-4 px-2 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
          {transcript &&
            transcript.map((msg: any) => (
              <div
                key={msg.id}
                className={`flex flex-col space-y-1 animate-in slide-in-from-bottom-2 fade-in duration-300 ${msg.role === "user" ? "items-end" : "items-start"
                  }`}
              >
                <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">{msg.role}</span>
                <div
                  className={`px-4 py-2 rounded-2xl max-w-[90%] text-sm leading-relaxed shadow-lg break-words
                ${msg.role === "user"
                      ? "bg-zinc-800/80 text-zinc-200 rounded-tr-sm border border-zinc-700/50"
                      : "bg-blue-900/20 text-blue-100 border border-blue-500/20 rounded-tl-sm backdrop-blur-sm"
                    }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
          <div ref={transcriptEndRef} />
        </div>
      </div>

      <button
        onClick={() => setIsDebugOpen(!isDebugOpen)}
        className={`fixed bottom-4 right-4 p-2 rounded-full transition-all duration-300 z-50
                    ${isDebugOpen ? "bg-zinc-800 text-white shadow-xl" : "bg-transparent text-zinc-700 hover:text-zinc-400 hover:bg-zinc-900"}`}
      >
        <Terminal className="w-5 h-5" />
      </button>

      {isDebugOpen && (
        <div className="fixed inset-y-0 right-0 z-40">
          <VoiceDebugSidebar isOpen={isDebugOpen} onClose={() => setIsDebugOpen(false)} events={history} />
        </div>
      )}
    </div>
  );
}
