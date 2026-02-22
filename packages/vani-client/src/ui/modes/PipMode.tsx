import { useState } from "react";
import { Maximize2, X, Mic, MicOff, Volume2, Radio, Loader2, AlertCircle, WifiOff } from "lucide-react";
import type { VaniViewProps } from "../types";

export function PipMode({ status, transcript, error, connect, cancel, onTogglePip, isMuted, toggleMute }: VaniViewProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const isListening = status === "listening";
  const isThinking = status === "processing";
  const isSpeaking = status === "speaking";
  const isDisconnected = status === "disconnected";
  const isError = status === "error";

  const getStatusColor = () => {
    if (isListening) return "bg-green-500";
    if (isThinking) return "bg-yellow-500";
    if (isSpeaking) return "bg-blue-500";
    if (isError) return "bg-red-500";
    if (isDisconnected) return "bg-zinc-500";
    return "bg-zinc-700";
  };

  const getStatusIcon = () => {
    if (isListening) return <Radio className="w-4 h-4 text-white animate-pulse" />;
    if (isThinking) return <Loader2 className="w-4 h-4 text-white animate-spin" />;
    if (isSpeaking) return <Volume2 className="w-4 h-4 text-white animate-bounce" />;
    if (isError) return <AlertCircle className="w-4 h-4 text-white" />;
    if (isDisconnected) return <WifiOff className="w-4 h-4 text-white" />;
    return <Mic className="w-4 h-4 text-white" />;
  };

  if (!isExpanded) {
    return (
      <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
        <button
          onClick={() => setIsExpanded(true)}
          className={`h-12 w-12 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 active:scale-95 ${getStatusColor()}`}
          title="Click to expand"
        >
          {getStatusIcon()}
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-300">
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-950/50 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${getStatusColor()} ${isListening || isSpeaking ? "animate-pulse" : ""}`} />
          <span className="text-xs font-mono text-zinc-400 font-medium truncate max-w-[120px]">
            {isListening ? "Listening" : isThinking ? "Processing" : isSpeaking ? "Speaking" : "Idle"}
            {isMuted && <span className="text-red-400 ml-1">(Muted)</span>}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          {toggleMute && (
            <button
              onClick={toggleMute}
              className={`p-1.5 hover:bg-zinc-800 rounded transition-colors ${isMuted ? "text-red-500 hover:text-red-400" : "text-zinc-500 hover:text-zinc-300"
                }`}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            </button>
          )}
          {onTogglePip && (
            <button
              onClick={onTogglePip}
              className="p-1.5 hover:bg-zinc-800 rounded text-zinc-500 hover:text-zinc-300 transition-colors"
              title="Maximize to Full Screen"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => setIsExpanded(false)}
            className="p-1.5 hover:bg-zinc-800 rounded text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Minimize"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-4 min-h-[120px]">
        <div className="flex justify-center py-2">
          <button
            onClick={() => {
              if (isDisconnected || isError) connect();
              else if (isThinking || isSpeaking) cancel();
            }}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300
                            ${isListening ? "bg-green-500/20 shadow-[0_0_20px_rgba(34,197,94,0.3)]" : isSpeaking ? "bg-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:bg-red-500/20 hover:text-red-500 cursor-pointer" : "bg-zinc-800"}`}
            title={isThinking || isSpeaking ? "Stop" : isError && error ? error : undefined}
          >
            {getStatusIcon()}
          </button>
        </div>

        <div className="flex-1 space-y-2 max-h-[150px] overflow-y-auto noscrollbar mask-gradient-b">
          {!transcript || transcript.length === 0 ? (
            <div className="text-center text-zinc-600 text-xs py-2 italic">
              {isDisconnected ? "Disconnected" : "Conversation will appear here..."}
            </div>
          ) : (
            transcript.slice(-2).map((msg: any) => (
              <div key={msg.id} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div
                  className={`px-2 py-1.5 rounded-lg max-w-[90%] text-xs leading-relaxed
                                    ${msg.role === "user" ? "bg-zinc-800 text-zinc-300" : "bg-blue-900/10 text-blue-100 border border-blue-500/10"}`}
                >
                  {msg.content}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

