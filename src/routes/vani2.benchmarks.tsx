import { createFileRoute, Link } from "@tanstack/react-router";
import { useSyncExternalStore, useMemo, useState } from "react";
import { benchmarkStore } from "../vani2/ui/benchmark-store";
import type { TurnMetrics } from "../vani2/protocol";

export const Route = createFileRoute("/vani2/benchmarks")({
  component: Vani2BenchmarksRoute,
});

function useBenchmarkSnapshot() {
  return useSyncExternalStore(
    (cb) => benchmarkStore.subscribe(cb),
    () => benchmarkStore.getSnapshot(),
    () => benchmarkStore.getSnapshot()
  );
}

function formatMs(ms: number | undefined): string {
  if (ms == null) return "—";
  return `${Math.round(ms)} ms`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
}

function TurnWaterfall({ turn, totalMs }: { turn: TurnMetrics; totalMs: number }) {
  const ttftMs = turn.ttftMs ?? 0;
  const ttfaMs = turn.ttfaMs ?? 0;
  const durationMs = turn.durationMs ?? 0;
  const seg1 = Math.max(0, ttftMs);
  const seg2 = Math.max(0, ttfaMs - ttftMs);
  const seg3 = Math.max(0, durationMs - ttfaMs);
  const total = totalMs > 0 ? totalMs : Math.max(seg1 + seg2 + seg3, 1);
  const p1 = (seg1 / total) * 100;
  const p2 = (seg2 / total) * 100;
  const p3 = (seg3 / total) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
        <span>Transcript → LLM first token: {formatMs(turn.ttftMs)}</span>
        <span>LLM → TTS first chunk: {formatMs(turn.llmToTtsMs)}</span>
        <span>TTS first → end: {formatMs(turn.ttfaMs != null && turn.durationMs != null ? turn.durationMs - turn.ttfaMs : undefined)}</span>
      </div>
      <div className="flex h-8 w-full overflow-hidden rounded bg-zinc-900" title={`Total: ${formatMs(turn.durationMs)}`}>
        <div
          className="bg-amber-500/80 shrink-0 transition-[width]"
          style={{ width: `${p1}%` }}
          title={`Wait for LLM: ${formatMs(turn.ttftMs)}`}
        />
        <div
          className="bg-sky-500/80 shrink-0 transition-[width]"
          style={{ width: `${p2}%` }}
          title={`LLM → TTS: ${formatMs(turn.llmToTtsMs)}`}
        />
        <div
          className="bg-emerald-500/80 shrink-0 transition-[width]"
          style={{ width: `${p3}%` }}
          title={`TTS to end: ${formatMs(turn.ttfaMs != null && turn.durationMs != null ? turn.durationMs - turn.ttfaMs : undefined)}`}
        />
      </div>
    </div>
  );
}

function Vani2BenchmarksRoute() {
  const sessions = useBenchmarkSnapshot();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedTurnIndex, setSelectedTurnIndex] = useState<number | null>(null);

  const currentSession = useMemo(() => {
    const id = selectedSessionId ?? sessions[sessions.length - 1]?.sessionId ?? null;
    return sessions.find((s) => s.sessionId === id) ?? null;
  }, [sessions, selectedSessionId]);

  const selectedTurn = useMemo(() => {
    if (!currentSession) return null;
    const idx = selectedTurnIndex ?? currentSession.turns[currentSession.turns.length - 1]?.turnIndex ?? null;
    return currentSession.turns.find((t) => t.turnIndex === idx) ?? currentSession.turns[currentSession.turns.length - 1] ?? null;
  }, [currentSession, selectedTurnIndex]);

  const totalMsForWaterfall = useMemo(() => {
    if (!selectedTurn || selectedTurn.durationMs == null) return 0;
    return selectedTurn.durationMs;
  }, [selectedTurn]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold font-mono text-zinc-200">Vani2 Benchmarks</h1>
          <Link
            to="/vani2"
            className="text-sm font-mono text-amber-500 hover:text-amber-400"
          >
            ← Back to voice session
          </Link>
        </div>

        {sessions.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center text-zinc-500">
            <p>No benchmark data yet.</p>
            <p className="mt-2 text-sm">Start a voice session on <Link to="/vani2" className="text-amber-500 hover:underline">/vani2</Link> and speak to see live metrics here.</p>
          </div>
        ) : (
          <>
            {sessions.length > 1 && (
              <div>
                <label className="block text-xs font-mono text-zinc-500 uppercase tracking-wider mb-1.5">Session</label>
                <select
                  value={selectedSessionId ?? currentSession?.sessionId ?? ""}
                  onChange={(e) => {
                    setSelectedSessionId(e.target.value || null);
                    setSelectedTurnIndex(null);
                  }}
                  className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono text-zinc-200"
                >
                  {sessions.map((s) => (
                    <option key={s.sessionId} value={s.sessionId}>
                      {s.sessionId}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
              <h2 className="px-4 py-3 text-sm font-mono font-medium text-zinc-300 border-b border-zinc-800">
                Turn-by-turn
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-500">
                      <th className="px-4 py-2 font-mono">Turn #</th>
                      <th className="px-4 py-2 font-mono">TTFT</th>
                      <th className="px-4 py-2 font-mono">TTFA</th>
                      <th className="px-4 py-2 font-mono">LLM→TTS</th>
                      <th className="px-4 py-2 font-mono">Duration</th>
                      <th className="px-4 py-2 font-mono">Interrupted</th>
                      <th className="px-4 py-2 font-mono">Start (ts)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentSession?.turns.map((turn) => (
                      <tr
                        key={turn.turnIndex}
                        className={`border-b border-zinc-800/80 hover:bg-zinc-800/50 cursor-pointer ${selectedTurn?.turnIndex === turn.turnIndex ? "bg-zinc-800/70" : ""}`}
                        onClick={() => setSelectedTurnIndex(turn.turnIndex)}
                      >
                        <td className="px-4 py-2 font-mono">{turn.turnIndex}</td>
                        <td className="px-4 py-2 font-mono">{formatMs(turn.ttftMs)}</td>
                        <td className="px-4 py-2 font-mono">{formatMs(turn.ttfaMs)}</td>
                        <td className="px-4 py-2 font-mono">{formatMs(turn.llmToTtsMs)}</td>
                        <td className="px-4 py-2 font-mono">{formatMs(turn.durationMs)}</td>
                        <td className="px-4 py-2 font-mono">{turn.interrupted ? "Y" : "N"}</td>
                        <td className="px-4 py-2 font-mono text-zinc-500">{formatTime(turn.turnStartTs)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedTurn && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                <h2 className="text-sm font-mono font-medium text-zinc-300 mb-3">
                  Waterfall — Turn {selectedTurn.turnIndex}
                </h2>
                <TurnWaterfall turn={selectedTurn} totalMs={totalMsForWaterfall} />
              </div>
            )}

            {currentSession && currentSession.turns.length > 0 && !selectedTurn && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                <h2 className="text-sm font-mono font-medium text-zinc-300 mb-3">
                  Waterfall — Latest turn
                </h2>
                <TurnWaterfall
                  turn={currentSession.turns[currentSession.turns.length - 1]!}
                  totalMs={currentSession.turns[currentSession.turns.length - 1]!.durationMs ?? 0}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
