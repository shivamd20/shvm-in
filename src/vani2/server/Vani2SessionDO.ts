import { DurableObject } from "cloudflare:workers";
import { createActor, type ActorRefFrom } from "xstate";
import { RingBuffer } from "./ring-buffer";
import { EchoEngine } from "./echo-engine";
import { SessionState } from "./session-state";
import { sessionMachine } from "./session-machine";
import {
  parseClientJson,
  serializeServerJson,
  type SessionState as SessionStateType,
  type BenchmarkEvent,
  type ClientToServerJson,
} from "../protocol";
import { streamLlmResponse, type LlmMessage } from "./llm-adapter";
import { runAura2 } from "./tts-adapter";
import {
  appendInterruptedAssistantMessage,
  MIN_PARTIAL_LENGTH,
} from "./conversation-history";

/** Async queue so processor can block on next message and be woken by webSocketMessage. */
class AsyncQueue<T> {
  private buffer: T[] = [];
  private waiting: ((value: T) => void) | null = null;
  push(item: T): void {
    if (this.waiting) {
      this.waiting(item);
      this.waiting = null;
    } else {
      this.buffer.push(item);
    }
  }
  async get(): Promise<T> {
    if (this.buffer.length > 0) return this.buffer.shift()!;
    return new Promise((resolve) => {
      this.waiting = resolve;
    });
  }
}

const RING_BUFFER_CAPACITY = 256;
const DEFAULT_ECHO_DELAY_MS = 0;
const SENTENCE_END = /[.!?]\s+|\n/g;
/** Timeout for first LLM token (idea 7). */
const LLM_FIRST_TOKEN_TIMEOUT_MS = 10_000;
/** Timeout for first TTS chunk (idea 7). */
const TTS_FIRST_CHUNK_TIMEOUT_MS = 10_000;

export class Vani2SessionDO extends DurableObject {
  private ws: WebSocket | null = null;
  private sessionState: SessionState | null = null;
  private ringBuffer: RingBuffer | null = null;
  private echoEngine: EchoEngine | null = null;
  private sessionActor: ActorRefFrom<typeof sessionMachine> | null = null;
  private messages: LlmMessage[] = [];
  private llmStreaming = false;
  private aborted = false;
  private turnIndex = 0;
  /** Last processed turnId for idempotency (idea 9). */
  private lastProcessedTurnId: string | null = null;
  private messageQueue: AsyncQueue<ClientToServerJson> | null = null;
  private speculativeActive = false;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  private sendJson(msg: {
    type: string;
    text?: string;
    value?: SessionStateType | "thinking" | "synthesizing";
    reason?: string;
    turnId?: string;
  }): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(serializeServerJson(msg as any));
    } catch (e) {
      console.error("[Vani2SessionDO] sendJson failed", e instanceof Error ? e.stack : e);
      this.cleanup();
    }
  }

  private sendStatus(value: "thinking" | "synthesizing"): void {
    this.sendJson({ type: "status", value });
  }

  /** Run TTS with timeout for first chunk (idea 7). */
  private async runAura2WithTimeout(ms: number, text: string): Promise<ArrayBuffer | null> {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("TTS first chunk timeout")), ms)
    );
    return Promise.race([runAura2(this.env as any, { text }), timeoutPromise]);
  }

  /** Fire-and-forget; does not block the pipeline. */
  private sendBenchmarkEvent(event: BenchmarkEvent): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(serializeServerJson(event));
      } catch {
        // ignore; do not cleanup on benchmark send failure
      }
    }
  }

  private sendBinary(audio: ArrayBuffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(audio);
    } catch (e) {
      console.error("[Vani2SessionDO] sendBinary failed", e instanceof Error ? e.stack : e);
      this.cleanup();
    }
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    this.cleaned = false;

    const echoDelayMs = DEFAULT_ECHO_DELAY_MS;
    this.sessionState = new SessionState();
    this.ringBuffer = new RingBuffer(RING_BUFFER_CAPACITY);
    this.echoEngine = new EchoEngine({
      delayMs: echoDelayMs,
      emit: (chunk: ArrayBuffer) => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          try {
            this.ws.send(chunk);
          } catch (e) {
            this.cleanup();
          }
        }
      },
    });
    this.ws = server;

    this.sessionActor = createActor(sessionMachine, {
      input: {
        sessionState: this.sessionState,
        ringBuffer: this.ringBuffer,
        echoEngine: this.echoEngine,
        cleanup: () => this.cleanup(),
      },
    });
    this.sessionActor.start();

    this.messageQueue = new AsyncQueue<ClientToServerJson>();
    void this.runProcessorLoop();

    this.sendJson({ type: "state", value: this.sessionState.get() as SessionStateType });

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(_ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (this.sessionState?.isClosed()) return;

    if (typeof message === "string") {
      const parsed = parseClientJson(message);
      if (!parsed) {
        this.sendJson({ type: "error", reason: "Invalid or unknown message" });
        return;
      }
      this.messageQueue?.push(parsed);
      return;
    }

    this.sessionActor?.send({ type: "BINARY", chunk: message as ArrayBuffer });
  }

  /** Single async loop: process queue; on transcript_speculative run speculative stream and race with queue. */
  private async runProcessorLoop(): Promise<void> {
    const queue = this.messageQueue;
    if (!queue) return;
    while (!this.sessionState?.isClosed() && this.messageQueue) {
      const msg = await queue.get();
      if (msg.type === "control.mute") continue;
      if (msg.type === "control.interrupt") {
        if (this.llmStreaming) {
          this.sendBenchmarkEvent({
            type: "benchmark.turn_interrupted",
            ts: Date.now(),
            turnIndex: this.turnIndex,
          });
        }
        this.aborted = true;
        continue;
      }
      if (msg.type === "transcript_speculative") {
        const text = msg.text.trim();
        if (!text || this.llmStreaming || this.speculativeActive) continue;
        await this.runSpeculative(text, queue);
        continue;
      }
      if (msg.type === "transcript_final") {
        if (!msg.text.trim()) {
          this.sendJson({ type: "error", reason: "transcript_final requires non-empty text" });
          continue;
        }
        if (msg.turnId != null && msg.turnId === this.lastProcessedTurnId) {
          this.sendJson({ type: "error", reason: "Duplicate turnId; turn already processed" });
          continue;
        }
        if (this.llmStreaming) {
          this.sendJson({ type: "error", reason: "Turn already in progress; send control.interrupt first" });
          continue;
        }
        await this.runNormalTurn(msg);
      }
    }
  }

  /** Speculative run: stream LLM on speculative text, buffer tokens; race with queue; on transcript_final commit or discard. */
  private async runSpeculative(speculativeText: string, queue: AsyncQueue<ClientToServerJson>): Promise<void> {
    this.speculativeActive = true;
    this.aborted = false;
    const speculativeMessages: LlmMessage[] = [...this.messages, { role: "user", content: speculativeText }];
    const stream = streamLlmResponse({ binding: this.env.AI, messages: speculativeMessages });
    const iter = stream[Symbol.asyncIterator]();
    const buffer: string[] = [];
    let pendingFinal: Extract<ClientToServerJson, { type: "transcript_final" }> | null = null;

    try {
      while (true) {
        const nextPromise = iter.next();
        const racePromise = queue.get().then((m) => ({ msg: m } as const));
        const result = await Promise.race([nextPromise.then((r) => ({ iterResult: r } as const)), racePromise]);

        if ("msg" in result) {
          const m = result.msg;
          if (m.type === "control.interrupt") {
            this.aborted = true;
            break;
          }
          if (m.type === "transcript_final") {
            pendingFinal = m;
            break;
          }
          if (m.type === "control.mute") continue;
          if (m.type === "transcript_speculative") continue;
          continue;
        }

        const { iterResult } = result;
        if (iterResult.done) break;
        if (this.aborted) break;
        buffer.push(iterResult.value);
      }
    } finally {
      this.speculativeActive = false;
    }

    if (!pendingFinal) {
      while (!this.sessionState?.isClosed()) {
        const m = await queue.get();
        if (m.type === "transcript_final") {
          pendingFinal = m;
          break;
        }
        if (m.type === "control.interrupt") this.aborted = true;
      }
    }

    if (!pendingFinal) return;

    const finalText = pendingFinal.text.trim();
    const turnId = pendingFinal.turnId ?? undefined;
    const canCommit =
      speculativeText.length > 0 &&
      (finalText === speculativeText || finalText.startsWith(speculativeText));

    if (canCommit && buffer.length > 0 && !this.aborted) {
      this.lastProcessedTurnId = pendingFinal.turnId ?? null;
      this.llmStreaming = true;
      this.turnIndex += 1;
      const tTurnStart = Date.now();
      this.sendBenchmarkEvent({
        type: "benchmark.turn_start",
        ts: tTurnStart,
        turnIndex: this.turnIndex,
        transcriptLength: finalText.length,
      });
      this.messages.push({ role: "user", content: finalText });
      let fullText = "";
      let sentenceBuffer = "";
      let ttsFirstSent = false;
      let llmFirstSent = false;
      this.sendStatus("thinking");
      try {
        for (const delta of buffer) {
          if (!llmFirstSent) {
            llmFirstSent = true;
            this.sendBenchmarkEvent({
              type: "benchmark.llm_first_token",
              ts: Date.now(),
              turnIndex: this.turnIndex,
            });
          }
          fullText += delta;
          this.sendJson({ type: "llm_partial", text: delta, ...(turnId ? { turnId } : {}) });
          sentenceBuffer += delta;
          let match: RegExpExecArray | null;
          while ((match = SENTENCE_END.exec(sentenceBuffer)) !== null) {
            const end = match.index + match[0].length;
            const sentence = sentenceBuffer.slice(0, end).trim();
            sentenceBuffer = sentenceBuffer.slice(end);
            if (sentence && !this.aborted) {
              if (!ttsFirstSent) {
                ttsFirstSent = true;
                this.sendStatus("synthesizing");
                this.sendBenchmarkEvent({
                  type: "benchmark.tts_first_chunk",
                  ts: Date.now(),
                  turnIndex: this.turnIndex,
                });
                const audio = await this.runAura2WithTimeout(TTS_FIRST_CHUNK_TIMEOUT_MS, sentence);
                if (audio && !this.aborted) this.sendBinary(audio);
              } else {
                const audio = await runAura2(this.env as any, { text: sentence });
                if (audio && !this.aborted) this.sendBinary(audio);
              }
            }
          }
          SENTENCE_END.lastIndex = 0;
        }
        if (sentenceBuffer.trim() && !this.aborted) {
          if (!ttsFirstSent) {
            ttsFirstSent = true;
            this.sendStatus("synthesizing");
            this.sendBenchmarkEvent({ type: "benchmark.tts_first_chunk", ts: Date.now(), turnIndex: this.turnIndex });
          }
          const text = sentenceBuffer.trim();
          const audio = ttsFirstSent
            ? await runAura2(this.env as any, { text })
            : await this.runAura2WithTimeout(TTS_FIRST_CHUNK_TIMEOUT_MS, text);
          if (audio && !this.aborted) this.sendBinary(audio);
        }
        if (!this.aborted) {
          this.sendBenchmarkEvent({ type: "benchmark.turn_end", ts: Date.now(), turnIndex: this.turnIndex });
          this.messages.push({ role: "assistant", content: fullText });
          this.sendJson({ type: "llm_complete", text: fullText, ...(turnId ? { turnId } : {}) });
        }
      } catch (e) {
        const reason = e instanceof Error ? e.message : String(e);
        this.sendJson({ type: "llm_error", reason, ...(turnId ? { turnId } : {}) });
      } finally {
        if (this.aborted && fullText.trim().length >= MIN_PARTIAL_LENGTH) {
          this.messages = appendInterruptedAssistantMessage(this.messages, fullText.trim());
        }
        this.llmStreaming = false;
      }
    } else {
      await this.runNormalTurn(pendingFinal);
    }
  }

  /** Run a full turn from transcript_final (no speculative). */
  private async runNormalTurn(parsed: Extract<ClientToServerJson, { type: "transcript_final" }>): Promise<void> {
    const turnId = parsed.turnId ?? undefined;
    this.lastProcessedTurnId = parsed.turnId ?? null;
    this.llmStreaming = true;
    this.aborted = false;
    this.turnIndex += 1;

    const tTurnStart = Date.now();
    this.sendBenchmarkEvent({
      type: "benchmark.turn_start",
      ts: tTurnStart,
      turnIndex: this.turnIndex,
      transcriptLength: parsed.text.length,
    });
    this.messages.push({ role: "user", content: parsed.text });
    let sentenceBuffer = "";
    let fullText = "";
    let ttsFirstSent = false;
    this.sendStatus("thinking");
    try {
      const stream = streamLlmResponse({
        binding: this.env.AI,
        messages: this.messages,
      });
      const iter = stream[Symbol.asyncIterator]();
      const firstTokenPromise = iter.next();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("LLM first token timeout")), LLM_FIRST_TOKEN_TIMEOUT_MS)
      );
      let firstResult: IteratorResult<string, string>;
      try {
        firstResult = await Promise.race([firstTokenPromise, timeoutPromise]);
      } catch (e) {
        const reason = e instanceof Error ? e.message : String(e);
        this.sendJson({ type: "llm_error", reason, ...(turnId ? { turnId } : {}) });
        return;
      }
      if (firstResult.done) return;
      let delta = firstResult.value;
      if (this.aborted) return;
      this.sendBenchmarkEvent({
        type: "benchmark.llm_first_token",
        ts: Date.now(),
        turnIndex: this.turnIndex,
      });
      fullText += delta;
      this.sendJson({ type: "llm_partial", text: delta, ...(turnId ? { turnId } : {}) });
      sentenceBuffer += delta;
      for await (const d of stream) {
        if (this.aborted) break;
        delta = d;
        fullText += delta;
        this.sendJson({ type: "llm_partial", text: delta, ...(turnId ? { turnId } : {}) });
        sentenceBuffer += delta;
        let match: RegExpExecArray | null;
        while ((match = SENTENCE_END.exec(sentenceBuffer)) !== null) {
          const end = match.index + match[0].length;
          const sentence = sentenceBuffer.slice(0, end).trim();
          sentenceBuffer = sentenceBuffer.slice(end);
          if (sentence && !this.aborted) {
            if (!ttsFirstSent) {
              ttsFirstSent = true;
              this.sendStatus("synthesizing");
              this.sendBenchmarkEvent({
                type: "benchmark.tts_first_chunk",
                ts: Date.now(),
                turnIndex: this.turnIndex,
              });
              const audio = await this.runAura2WithTimeout(TTS_FIRST_CHUNK_TIMEOUT_MS, sentence);
              if (audio && !this.aborted) this.sendBinary(audio);
            } else {
              const audio = await runAura2(this.env as any, { text: sentence });
              if (audio && !this.aborted) this.sendBinary(audio);
            }
          }
        }
        SENTENCE_END.lastIndex = 0;
      }
      if (sentenceBuffer.trim() && !this.aborted) {
        if (!ttsFirstSent) {
          ttsFirstSent = true;
          this.sendStatus("synthesizing");
          this.sendBenchmarkEvent({
            type: "benchmark.tts_first_chunk",
            ts: Date.now(),
            turnIndex: this.turnIndex,
          });
        }
        const text = sentenceBuffer.trim();
        const audio = ttsFirstSent
          ? await runAura2(this.env as any, { text })
          : await this.runAura2WithTimeout(TTS_FIRST_CHUNK_TIMEOUT_MS, text);
        if (audio && !this.aborted) this.sendBinary(audio);
      }
      if (!this.aborted) {
        this.sendBenchmarkEvent({
          type: "benchmark.turn_end",
          ts: Date.now(),
          turnIndex: this.turnIndex,
        });
        this.messages.push({ role: "assistant", content: fullText });
        this.sendJson({ type: "llm_complete", text: fullText, ...(turnId ? { turnId } : {}) });
      }
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      console.error("[Vani2SessionDO] turn pipeline error", e instanceof Error ? e.stack : e);
      this.sendJson({ type: "llm_error", reason, ...(turnId ? { turnId } : {}) });
    } finally {
      if (this.aborted && fullText.trim().length >= MIN_PARTIAL_LENGTH) {
        this.messages = appendInterruptedAssistantMessage(this.messages, fullText.trim());
      }
      this.llmStreaming = false;
    }
  }

  async webSocketClose(_ws: WebSocket, _code: number, _reason: string, _wasClean: boolean): Promise<void> {
    this.sessionActor?.send({ type: "CLOSE" });
  }

  async webSocketError(_ws: WebSocket, _error: unknown): Promise<void> {
    console.error("[Vani2SessionDO] WebSocket error", _error instanceof Error ? _error.stack : _error);
    this.sessionActor?.send({ type: "ERROR", error: _error });
  }

  private cleaned = false;

  private cleanup(): void {
    if (this.cleaned) return;
    this.cleaned = true;
    this.sessionState?.setClosed();
    this.messageQueue = null;
    try {
      this.echoEngine?.flush();
    } catch (e) {
      console.error("[Vani2SessionDO] cleanup: echo flush error", e instanceof Error ? e.stack : e);
    }
    this.echoEngine = null;
    this.ringBuffer = null;
    this.ws = null;
    this.sessionActor = null;
  }
}
