import { useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { useVani2Echo } from "./useVani2Echo";
import { Waveform } from "./Waveform";

const COLOR_IN = "34 197 94";
const COLOR_OUT = "59 130 246";

export function EchoUI() {
  const [serverUrl, setServerUrl] = useState(
    typeof window !== "undefined" ? window.location.origin : ""
  );
  const [showOptions, setShowOptions] = useState(false);

  const {
    status,
    error,
    isMuted,
    toggleMute,
    connect,
    incomingSamplesRef,
    outgoingSamplesRef,
  } = useVani2Echo(serverUrl);

  const isConnected = status === "connected";
  const isConnecting = status === "connecting";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-semibold tracking-tight font-mono text-zinc-200">
            Vani 2 Echo
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
          </div>
        )}

        {!isConnected && !isConnecting && (
          <button
            type="button"
            onClick={connect}
            disabled={isConnecting}
            className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-sm font-mono text-zinc-200 disabled:opacity-50 transition-colors mb-6"
          >
            {isConnecting ? "Connecting…" : "Connect"}
          </button>
        )}

        {isConnected && (
          <div className="flex items-center gap-2 mb-4 py-1.5 px-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-mono text-zinc-400">Connected</span>
          </div>
        )}

        {error && (
          <p className="text-xs font-mono text-red-400 mb-4 px-2 py-1.5 rounded-lg bg-red-950/30 border border-red-900/50">
            {error}
          </p>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-zinc-500 uppercase tracking-wider mb-1.5">
              In
            </label>
            <div className="h-12 w-full rounded-lg overflow-hidden bg-zinc-950/80 border border-zinc-800">
              <Waveform
                active={isConnected}
                samplesRef={incomingSamplesRef}
                color={COLOR_IN}
                className="w-full h-full block"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-mono text-zinc-500 uppercase tracking-wider mb-1.5">
              Out
            </label>
            <div className="h-12 w-full rounded-lg overflow-hidden bg-zinc-950/80 border border-zinc-800">
              <Waveform
                active={isConnected}
                samplesRef={outgoingSamplesRef}
                color={COLOR_OUT}
                className="w-full h-full block"
              />
            </div>
          </div>
        </div>

        {isConnected && (
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={toggleMute}
              className={`p-3 rounded-full border transition-colors ${
                isMuted
                  ? "bg-red-950/30 border-red-900/50 text-red-400 hover:bg-red-950/50"
                  : "bg-zinc-800/50 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              }`}
              title={isMuted ? "Unmute" : "Mute"}
              aria-label={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? (
                <MicOff className="w-5 h-5" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
