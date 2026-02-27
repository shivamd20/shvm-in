import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { useVani } from "@/vani2/ui/useVani";
import { HomeAudioViz, type HomeVizStatus } from "@/components/HomeAudioViz";
import { HOMEPAGE_SYSTEM_PROMPT } from "@/lib/homePrompt";
import profileData from "@/data/profile.json";

const HINT_DISMISS_KEY = "vani-home-hint-dismissed";
const TRANSCRIPT_STRIP_HEIGHT = "5rem";

function deriveVizStatus(
  status: string,
  serverStatus: "thinking" | "synthesizing" | null,
  isPlaying: boolean,
  liveTranscript: string
): HomeVizStatus {
  if (status === "error") return "error";
  if (status === "connecting") return "connecting";
  if (status === "idle") return "idle";
  if (serverStatus === "thinking") return "thinking";
  if (serverStatus === "synthesizing" || isPlaying) return "assistant_speaking";
  if (liveTranscript.trim().length > 0) return "listening";
  return "idle";
}

function useVaniDebug(
  status: string,
  serverStatus: "thinking" | "synthesizing" | null,
  isPlaying: boolean,
  liveTranscript: string,
  llmText: string,
  llmCompleteText: string | null
) {
  const prev = useRef({ status, serverStatus, isPlaying, liveTranscript, llmText, llmCompleteText });
  useEffect(() => {
    const now = { status, serverStatus, isPlaying, liveTranscript, llmText, llmCompleteText };
    if (
      now.status !== prev.current.status ||
      now.serverStatus !== prev.current.serverStatus ||
      now.isPlaying !== prev.current.isPlaying
    ) {
      console.debug("[Vani Home] status", {
        status: now.status,
        serverStatus: now.serverStatus,
        isPlaying: now.isPlaying,
      });
      prev.current = now;
    }
  }, [status, serverStatus, isPlaying]);
  useEffect(() => {
    if (liveTranscript !== prev.current.liveTranscript && liveTranscript.trim()) {
      console.debug("[Vani Home] liveTranscript (user)", liveTranscript);
      prev.current.liveTranscript = liveTranscript;
    }
  }, [liveTranscript]);
  useEffect(() => {
    if (llmText !== prev.current.llmText && llmText) {
      console.debug("[Vani Home] llmText (assistant streaming)", llmText.slice(-80));
      prev.current.llmText = llmText;
    }
  }, [llmText]);
  useEffect(() => {
    if (llmCompleteText !== prev.current.llmCompleteText && llmCompleteText) {
      console.debug("[Vani Home] llmCompleteText (assistant final)", llmCompleteText);
      prev.current.llmCompleteText = llmCompleteText;
    }
  }, [llmCompleteText]);
}

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const {
    status,
    error,
    serverStatus,
    isPlaying,
    llmText,
    llmCompleteText,
    liveTranscript,
    start,
    stop,
  } = useVani(HOMEPAGE_SYSTEM_PROMPT, {
    serverBaseUrl: typeof window !== "undefined" ? window.location.origin : undefined,
  });

  const vizStatus = deriveVizStatus(status, serverStatus, isPlaying, liveTranscript);
  useVaniDebug(status, serverStatus, isPlaying, liveTranscript, llmText, llmCompleteText);

  const [hintDismissed, setHintDismissed] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem(HINT_DISMISS_KEY) === "1" : false
  );
  const [voiceViewActive, setVoiceViewActive] = useState(false);
  const transcriptStripRef = useRef<HTMLDivElement>(null);

  const dismissHint = useCallback(() => {
    setHintDismissed(true);
    if (typeof window !== "undefined") localStorage.setItem(HINT_DISMISS_KEY, "1");
  }, []);

  const isActive = status === "connected";
  const showVoiceView = voiceViewActive || status === "connecting" || isActive;

  const handleStart = useCallback(() => {
    setVoiceViewActive(true);
    start();
  }, [start]);

  const handleToggle = useCallback(() => {
    if (isActive) {
      stop();
    } else {
      setVoiceViewActive(true);
      start();
    }
  }, [isActive, start, stop]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        if (showVoiceView) handleToggle();
        else handleStart();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showVoiceView, handleToggle, handleStart]);

  const assistantText = llmText || llmCompleteText || "";
  useEffect(() => {
    const el = transcriptStripRef.current;
    if (el && assistantText) el.scrollTop = el.scrollHeight;
  }, [assistantText]);

  return (
    <div className="h-dvh max-h-dvh w-full overflow-hidden bg-black text-zinc-100 selection:bg-accent/20 selection:text-white flex flex-col">
      {/* Header: always visible */}
      <header className="flex-shrink-0 pt-4 pb-3 sm:pt-6 sm:pb-4 px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-display font-medium tracking-tight text-white/95">
              SHVM<span className="text-accent">.</span>IN
            </h1>
            <p className="mt-1 sm:mt-1.5 text-xs sm:text-sm font-mono text-zinc-500 tracking-wide">
              AI + distributed systems. Talk to my digital twin.
            </p>
          </div>
          <nav className="flex flex-wrap items-center gap-3 sm:gap-6">
            <Link to="/blogs" className="text-xs font-mono text-zinc-500 hover:text-accent transition-colors uppercase tracking-wider">
              Blog
            </Link>
            <Link to="/mcp-playground" className="text-xs font-mono text-zinc-500 hover:text-accent transition-colors uppercase tracking-wider">
              MCP
            </Link>
            <a href={profileData.github} target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-zinc-500 hover:text-accent transition-colors uppercase tracking-wider">
              GitHub
            </a>
            <a href={profileData.linkedin} target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-zinc-500 hover:text-accent transition-colors uppercase tracking-wider">
              LinkedIn
            </a>
          </nav>
        </div>
      </header>

      {/* Main: landing or voice view */}
      <main className="flex-1 min-h-0 flex flex-col items-center justify-center px-4">
        {!showVoiceView ? (
          /* Landing: content + single CTA */
          <div className="flex flex-col items-center text-center gap-6 sm:gap-8">
            <p className="text-sm sm:text-base font-mono text-zinc-500 max-w-sm">
              Click Talk to start a voice conversation.
            </p>
            <button
              type="button"
              onClick={handleStart}
              className="inline-flex items-center justify-center gap-2 rounded-full min-w-[140px] sm:min-w-[160px] min-h-[44px] px-6 py-3 text-sm font-mono text-white bg-accent border border-accent/40 hover:bg-accent/90 transition-colors focus:outline-none focus:ring-2 focus:ring-accent/50"
              aria-label="Start conversation"
            >
              <Mic className="w-5 h-5" aria-hidden />
              Talk
            </button>
            {!hintDismissed && (
              <p className="text-[11px] font-mono text-zinc-600 flex items-center gap-2">
                Allow mic when prompted
                <button type="button" onClick={dismissHint} className="text-zinc-500 hover:text-zinc-400 underline">
                  Dismiss
                </button>
              </p>
            )}
          </div>
        ) : (
          /* Voice view: viz + Stop + fixed transcript strip */
          <>
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center w-full gap-4 sm:gap-6">
              <HomeAudioViz status={vizStatus} className="flex-shrink-0" />

              <div className="flex flex-col items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleToggle}
                  className="inline-flex items-center justify-center gap-2 rounded-full min-w-[140px] sm:min-w-[160px] min-h-[44px] px-5 sm:px-6 py-2.5 sm:py-3 text-sm font-mono text-white bg-accent border border-accent/40 hover:bg-accent/90 transition-colors focus:outline-none focus:ring-2 focus:ring-accent/50"
                  aria-label={isActive ? "Stop conversation" : "Start conversation"}
                >
                  {isActive ? (
                    <>
                      <Square className="w-4 h-4" aria-hidden />
                      Stop
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4" aria-hidden />
                      Talk
                    </>
                  )}
                </button>
                <p className="text-[10px] sm:text-[11px] font-mono text-zinc-600">
                  <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500">Space</kbd> to start or stop
                </p>
              </div>

              {error && (
                <div className="w-full max-w-md rounded-lg border border-red-500/30 bg-red-950/20 px-4 py-3 text-left flex-shrink-0">
                  <p className="text-sm font-mono text-red-400">{error}</p>
                  <button type="button" onClick={() => start()} className="mt-2 text-xs font-mono text-accent hover:underline">
                    Retry
                  </button>
                </div>
              )}
            </div>

            {/* Fixed-height transcript strip — no layout shift */}
            <div
              ref={transcriptStripRef}
              className="flex-shrink-0 w-full max-w-md overflow-y-auto overflow-x-hidden border-t border-zinc-800/80 bg-zinc-950/50 px-3 py-2"
              style={{ minHeight: TRANSCRIPT_STRIP_HEIGHT, maxHeight: TRANSCRIPT_STRIP_HEIGHT }}
              aria-live="polite"
            >
              <div className="flex flex-col gap-1 text-xs font-mono text-zinc-400 min-h-0">
                {liveTranscript.trim() && (
                  <p className="text-left truncate" title={liveTranscript}>
                    <span className="text-zinc-500">You:</span> {liveTranscript}
                  </p>
                )}
                {assistantText && (
                  <p className="text-left break-words whitespace-pre-wrap" title={assistantText}>
                    <span className="text-zinc-500">Shivam:</span> {assistantText}
                  </p>
                )}
                {!liveTranscript.trim() && !assistantText && (
                  <p className="text-zinc-600">Transcript will appear here.</p>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
