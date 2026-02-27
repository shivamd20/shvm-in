import { useState, useRef, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Captions, Mic, MicOff, Circle, MessageSquare } from "lucide-react";
import { useVani2Transcription } from "./useVani2Transcription";
import { useVani2Session } from "./useVani2Session";

const FLUX_EVENT_LABELS: Record<string, { label: string; color: string }> = {
  StartOfTurn: { label: "Turn started", color: "bg-emerald-500/20 text-emerald-400 border-emerald-600/50" },
  Update: { label: "Listening", color: "bg-sky-500/20 text-sky-400 border-sky-600/50" },
  EagerEndOfTurn: { label: "Eager EOT", color: "bg-amber-500/20 text-amber-400 border-amber-600/50" },
  TurnResumed: { label: "Turn resumed", color: "bg-violet-500/20 text-violet-400 border-violet-600/50" },
  EndOfTurn: { label: "Turn ended", color: "bg-rose-500/20 text-rose-400 border-rose-600/50" },
};

function useSessionId(): string {
  const [id] = useState(
    () => (typeof window !== "undefined" ? `v2-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` : "v2")
  );
  return id;
}

export function EchoUI() {
  const [serverUrl, setServerUrl] = useState(
    typeof window !== "undefined" ? window.location.origin : ""
  );
  const [showOptions, setShowOptions] = useState(false);
  const sessionId = useSessionId();

  const {
    status,
    error,
    connect: connectTranscription,
    disconnect: disconnectTranscription,
    liveTranscript,
    transcriptHistory,
    lastEvent,
    fluxState,
  } = useVani2Transcription(serverUrl, sessionId);

  const {
    status: sessionStatus,
    error: sessionError,
    serverStatus,
    connect: connectSession,
    disconnect: disconnectSession,
    sendTranscriptFinal,
    sendInterrupt,
    llmText,
    llmError,
    assistantHistory,
    isPlaying,
  } = useVani2Session(serverUrl, sessionId);

  const lastSentTranscriptRef = useRef<string | null>(null);
  const turnIdRef = useRef(0);

  useEffect(() => {
    if (lastEvent?.type === "StartOfTurn" || lastEvent?.type === "TurnResumed") {
      turnIdRef.current += 1;
    }
  }, [lastEvent?.type]);

  useEffect(() => {
    if (lastEvent?.type !== "EndOfTurn" || !lastEvent.payload.transcript) return;
    const t = lastEvent.payload.transcript.trim();
    if (!t || t === lastSentTranscriptRef.current) return;
    lastSentTranscriptRef.current = t;
    sendTranscriptFinal(t, String(turnIdRef.current));
  }, [lastEvent, sendTranscriptFinal]);

  useEffect(() => {
    if (lastEvent?.type !== "StartOfTurn" && lastEvent?.type !== "TurnResumed") return;
    if (llmText || isPlaying) sendInterrupt();
  }, [lastEvent?.type, lastEvent?.payload, llmText, isPlaying, sendInterrupt]);

  const start = () => {
    connectSession();
    connectTranscription();
  };

  const stop = () => {
    disconnectTranscription();
    disconnectSession();
    lastSentTranscriptRef.current = null;
  };

  const isTranscribing = status === "connected";
  const isFluxConnecting = status === "connecting";
  const isSessionConnecting = sessionStatus === "connecting";
  const isConnecting = isFluxConnecting || isSessionConnecting;
  const isSessionConnected = sessionStatus === "connected";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-semibold tracking-tight font-mono text-zinc-200 flex items-center gap-2">
            <Captions className="w-5 h-5 text-amber-500" />
            Flux transcription
          </h1>
          <div className="flex items-center gap-3">
            <Link
              to="/vani2/benchmarks"
              className="text-xs font-mono text-amber-500/80 hover:text-amber-400"
            >
              Benchmarks
            </Link>
            {showOptions ? (
              <button
                type="button"
                onClick={() => setShowOptions(false)}
                className="text-xs font-mono text-zinc-500 hover:text-zinc-300"
              >
                Hide options
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowOptions(true)}
                className="text-xs font-mono text-zinc-500 hover:text-zinc-300"
              >
                Options
              </button>
            )}
          </div>
        </div>

        {showOptions && (
          <div className="mb-4">
            <label className="block text-xs font-mono text-zinc-500 uppercase tracking-wider mb-1.5">
              Server
            </label>
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder={typeof window !== "undefined" ? window.location.origin : ""}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
              spellCheck={false}
              autoComplete="off"
            />
            <p className="mt-1.5 text-[11px] font-mono text-zinc-500">
              With <code className="text-zinc-400">vite dev</code> the Worker runs in the same process.
            </p>
          </div>
        )}

        {!isTranscribing && !isConnecting && (
          <button
            type="button"
            onClick={start}
            disabled={isConnecting}
            className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-zinc-950 font-mono text-sm font-medium disabled:opacity-50 transition-colors mb-6 flex items-center justify-center gap-2"
          >
            <Mic className="w-5 h-5" />
            Start (Flux + LLM)
          </button>
        )}

        {isConnecting && (
          <div className="mb-4 py-3 rounded-xl bg-zinc-800/50 border border-zinc-700 flex flex-col items-center justify-center gap-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-sm font-mono text-zinc-400">Connecting…</span>
            </div>
            <div className="flex gap-4 text-[11px] font-mono text-zinc-500">
              {isFluxConnecting && <span>Flux (STT)</span>}
              {isSessionConnecting && <span>Session (LLM/TTS)</span>}
            </div>
          </div>
        )}

        {isTranscribing && (
          <>
            <div className="mb-4 flex items-center justify-between gap-2 py-2 px-3 rounded-xl bg-zinc-800/50 border border-zinc-700">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-mono text-zinc-400">Flux</span>
                </div>
                {isSessionConnected && (
                  <div className="flex items-center gap-1.5 text-zinc-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                    <span className="text-xs font-mono">Session</span>
                  </div>
                )}
                {serverStatus === "thinking" && (
                  <div className="flex items-center gap-1.5 text-sky-400/90">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
                    <span className="text-xs font-mono">Thinking…</span>
                  </div>
                )}
                {serverStatus === "synthesizing" && (
                  <div className="flex items-center gap-1.5 text-violet-400/90">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
                    <span className="text-xs font-mono">Synthesizing…</span>
                  </div>
                )}
                {isPlaying && (
                  <div className="flex items-center gap-1.5 text-amber-500/90">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-xs font-mono">Playing</span>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={stop}
                className="flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-red-950/40 border border-red-800/50 text-red-400 hover:bg-red-950/60 text-xs font-mono"
              >
                <MicOff className="w-3.5 h-3.5" />
                Stop
              </button>
            </div>

            {/* Flux state: event + turn + EOT confidence */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {fluxState.event && (
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-mono ${
                    FLUX_EVENT_LABELS[fluxState.event]?.color ?? "bg-zinc-700/30 text-zinc-400 border-zinc-600"
                  }`}
                >
                  <Circle className="w-1.5 h-1.5 fill-current" />
                  {FLUX_EVENT_LABELS[fluxState.event]?.label ?? fluxState.event}
                </span>
              )}
              {fluxState.turnIndex !== undefined && (
                <span className="px-2.5 py-1 rounded-md border border-zinc-600 bg-zinc-800/50 text-xs font-mono text-zinc-500">
                  Turn #{fluxState.turnIndex}
                </span>
              )}
              {fluxState.endOfTurnConf !== undefined && (
                <span className="px-2.5 py-1 rounded-md border border-zinc-600 bg-zinc-800/50 text-xs font-mono text-zinc-500">
                  EOT conf: {(fluxState.endOfTurnConf * 100).toFixed(0)}%
                </span>
              )}
            </div>
          </>
        )}

        {(error || sessionError) && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-amber-950/30 border border-amber-900/50" role="alert">
            <p className="text-xs font-mono text-amber-400 font-medium">Connection error</p>
            <p className="text-xs font-mono text-amber-300/90 mt-1">{error || sessionError}</p>
            <p className="text-[10px] font-mono text-zinc-500 mt-1.5">Check the browser console for details.</p>
          </div>
        )}

        {llmError && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-red-950/30 border border-red-900/50" role="alert">
            <p className="text-xs font-mono text-red-400 font-medium">LLM error</p>
            <p className="text-xs font-mono text-red-300/90 mt-1">{llmError}</p>
            <p className="text-[10px] font-mono text-zinc-500 mt-1.5">Check the browser console for details.</p>
          </div>
        )}

        {(llmText || assistantHistory.length > 0) && (
          <div className="mb-4">
            <label className="block text-xs font-mono text-zinc-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              Assistant
            </label>
            <div className="max-h-48 w-full rounded-xl bg-zinc-950/80 border border-zinc-800 overflow-y-auto flex flex-col">
              {llmText && (
                <div className="px-3 py-2.5 text-sm font-mono text-sky-400/95 whitespace-pre-wrap break-words border-b border-zinc-800 shrink-0">
                  {llmText}
                  <span className="animate-pulse">▌</span>
                </div>
              )}
              <div className="flex flex-col min-h-0">
                {assistantHistory.map((text, i) => (
                  <div
                    key={i}
                    className="px-3 py-2.5 text-sm font-mono text-zinc-300 whitespace-pre-wrap break-words border-b border-zinc-800/50 last:border-b-0"
                  >
                    {text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Live + history */}
        {(isTranscribing || transcriptHistory.length > 0) && (
          <div className="mb-4">
            <label className="block text-xs font-mono text-zinc-500 uppercase tracking-wider mb-1.5">
              Transcripts
            </label>
            <div className="max-h-64 w-full rounded-xl bg-zinc-950/80 border border-zinc-800 overflow-y-auto flex flex-col">
              {(liveTranscript || (lastEvent && isTranscribing ? `[${lastEvent.type}]` : "")) && (
                <div className="px-3 py-2.5 text-sm font-mono text-amber-400/95 whitespace-pre-wrap break-words border-b border-zinc-800 shrink-0">
                  {liveTranscript || (lastEvent ? `[${lastEvent.type}]` : "—")}
                </div>
              )}
              <div className="flex flex-col min-h-0">
                {transcriptHistory.map((text, i) => (
                  <div
                    key={i}
                    className="px-3 py-2.5 text-sm font-mono text-zinc-300 whitespace-pre-wrap break-words border-b border-zinc-800/50 last:border-b-0"
                  >
                    {text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
