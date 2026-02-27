/**
 * Client-side singleton store for Vani2 benchmark events.
 * Receives benchmark.* messages from the session WebSocket and exposes
 * per-session, per-turn metrics for the Benchmark UI (live updates).
 */
import type { BenchmarkEvent, TurnMetrics } from "../protocol";

export interface SessionMetrics {
  sessionId: string;
  turns: TurnMetrics[];
}

export type BenchmarkStoreSnapshot = SessionMetrics[];

type Listener = () => void;

function deriveTurnMetrics(turn: Partial<TurnMetrics>): TurnMetrics {
  const turnStartTs = turn.turnStartTs ?? 0;
  const llmFirstTs = turn.llmFirstTs;
  const ttsFirstTs = turn.ttsFirstTs;
  const turnEndTs = turn.turnEndTs;
  const turnInterruptedTs = turn.turnInterruptedTs;
  const interrupted = turn.interrupted ?? false;

  const ttftMs = llmFirstTs != null ? llmFirstTs - turnStartTs : undefined;
  const ttfaMs = ttsFirstTs != null ? ttsFirstTs - turnStartTs : undefined;
  const llmToTtsMs =
    llmFirstTs != null && ttsFirstTs != null ? ttsFirstTs - llmFirstTs : undefined;
  const endTs = turnEndTs ?? turnInterruptedTs;
  const durationMs = endTs != null ? endTs - turnStartTs : undefined;

  return {
    turnIndex: turn.turnIndex ?? 0,
    turnStartTs,
    llmFirstTs,
    ttsFirstTs,
    turnEndTs,
    turnInterruptedTs,
    interrupted,
    ttftMs,
    ttfaMs,
    llmToTtsMs,
    durationMs,
  };
}

class BenchmarkStoreClass {
  private sessions = new Map<string, Map<number, Partial<TurnMetrics>>>();
  private snapshot: BenchmarkStoreSnapshot = [];
  private listeners = new Set<Listener>();
  private maxSessions = 20;
  private maxTurnsPerSession = 50;

  private getOrCreateTurn(sessionId: string, turnIndex: number): Partial<TurnMetrics> {
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = new Map();
      this.sessions.set(sessionId, session);
    }
    let turn = session.get(turnIndex);
    if (!turn) {
      turn = { turnIndex, turnStartTs: 0, interrupted: false };
      session.set(turnIndex, turn);
    }
    return turn;
  }

  private buildSnapshot(): BenchmarkStoreSnapshot {
    const sessionIds = Array.from(this.sessions.keys()).slice(-this.maxSessions);
    return sessionIds.map((sessionId) => {
      const turnMap = this.sessions.get(sessionId)!;
      const turns = Array.from(turnMap.entries())
        .sort(([a], [b]) => a - b)
        .slice(-this.maxTurnsPerSession)
        .map(([, t]) => deriveTurnMetrics(t));
      return { sessionId, turns };
    });
  }

  private notify(): void {
    this.snapshot = this.buildSnapshot();
    this.listeners.forEach((fn) => fn());
  }

  push(sessionId: string, event: BenchmarkEvent): void {
    const { type, ts, turnIndex } = event;
    const turn = this.getOrCreateTurn(sessionId, turnIndex);

    switch (type) {
      case "benchmark.turn_start":
        turn.turnStartTs = ts;
        break;
      case "benchmark.llm_first_token":
        turn.llmFirstTs = ts;
        break;
      case "benchmark.tts_first_chunk":
        turn.ttsFirstTs = ts;
        break;
      case "benchmark.turn_end":
        turn.turnEndTs = ts;
        turn.interrupted = false;
        break;
      case "benchmark.turn_interrupted":
        turn.turnInterruptedTs = ts;
        turn.interrupted = true;
        break;
    }

    this.notify();
  }

  getSnapshot(): BenchmarkStoreSnapshot {
    return this.snapshot;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const benchmarkStore = new BenchmarkStoreClass();
