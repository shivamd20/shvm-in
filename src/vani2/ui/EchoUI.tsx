import { useState } from "react";
import { Captions, Mic, MicOff, Circle } from "lucide-react";
import { useVani2Transcription } from "./useVani2Transcription";

const FLUX_EVENT_LABELS: Record<string, { label: string; color: string }> = {
  StartOfTurn: { label: "Turn started", color: "bg-emerald-500/20 text-emerald-400 border-emerald-600/50" },
  Update: { label: "Listening", color: "bg-sky-500/20 text-sky-400 border-sky-600/50" },
  EagerEndOfTurn: { label: "Eager EOT", color: "bg-amber-500/20 text-amber-400 border-amber-600/50" },
  TurnResumed: { label: "Turn resumed", color: "bg-violet-500/20 text-violet-400 border-violet-600/50" },
  EndOfTurn: { label: "Turn ended", color: "bg-rose-500/20 text-rose-400 border-rose-600/50" },
};

export function EchoUI() {
  const [serverUrl, setServerUrl] = useState(
    typeof window !== "undefined" ? window.location.origin : ""
  );
  const [showOptions, setShowOptions] = useState(false);

  const {
    status,
    error,
    connect,
    disconnect,
    liveTranscript,
    transcriptHistory,
    lastEvent,
    fluxState,
  } = useVani2Transcription(serverUrl);

  const isTranscribing = status === "connected";
  const isConnecting = status === "connecting";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-semibold tracking-tight font-mono text-zinc-200 flex items-center gap-2">
            <Captions className="w-5 h-5 text-amber-500" />
            Flux transcription
          </h1>
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
            onClick={connect}
            disabled={isConnecting}
            className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-zinc-950 font-mono text-sm font-medium disabled:opacity-50 transition-colors mb-6 flex items-center justify-center gap-2"
          >
            <Mic className="w-5 h-5" />
            Start transcription
          </button>
        )}

        {isConnecting && (
          <div className="mb-4 py-3 rounded-xl bg-zinc-800/50 border border-zinc-700 flex items-center justify-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-sm font-mono text-zinc-400">Connecting…</span>
          </div>
        )}

        {isTranscribing && (
          <>
            <div className="mb-4 flex items-center justify-between gap-2 py-2 px-3 rounded-xl bg-zinc-800/50 border border-zinc-700">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-mono text-zinc-400">Live</span>
              </div>
              <button
                type="button"
                onClick={disconnect}
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

        {error && (
          <p className="text-xs font-mono text-amber-400 mb-4 px-3 py-2 rounded-lg bg-amber-950/30 border border-amber-900/50">
            {error}
          </p>
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
