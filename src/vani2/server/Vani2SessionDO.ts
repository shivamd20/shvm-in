import { DurableObject } from "cloudflare:workers";
import { RingBuffer } from "./ring-buffer";
import { EchoEngine } from "./echo-engine";
import { SessionState } from "./session-state";
import { parseClientJson, serializeServerJson, type SessionState as SessionStateType } from "../protocol";
import { streamLlmResponse, type LlmMessage } from "./llm-adapter";
import { runAura2 } from "./tts-adapter";

const RING_BUFFER_CAPACITY = 256;
const DEFAULT_ECHO_DELAY_MS = 0;
const SENTENCE_END = /[.!?]\s+|\n/g;

export class Vani2SessionDO extends DurableObject {
  private ws: WebSocket | null = null;
  private sessionState: SessionState | null = null;
  private ringBuffer: RingBuffer | null = null;
  private echoEngine: EchoEngine | null = null;
  private messages: LlmMessage[] = [];
  private llmStreaming = false;
  private aborted = false;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  private sendJson(msg: { type: string; text?: string; value?: SessionStateType; reason?: string }): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(serializeServerJson(msg as any));
      } catch (e) {
        this.cleanup();
      }
    }
  }

  private sendBinary(audio: ArrayBuffer): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(audio);
      } catch (e) {
        this.cleanup();
      }
    }
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);

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

    this.sendJson({ type: "state", value: this.sessionState.get() as SessionStateType });

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(_ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (this.sessionState?.isClosed()) return;

    if (typeof message === "string") {
      const parsed = parseClientJson(message);
      if (!parsed) return;
      if (parsed.type === "control.mute") {
        return;
      }
      if (parsed.type === "control.interrupt") {
        this.aborted = true;
        return;
      }
      if (parsed.type === "transcript_final") {
        if (this.llmStreaming) return;
        this.llmStreaming = true;
        this.aborted = false;
        this.messages.push({ role: "user", content: parsed.text });
        let sentenceBuffer = "";
        let fullText = "";
        try {
          for await (const delta of streamLlmResponse({
            binding: this.env.AI,
            messages: this.messages,
          })) {
            if (this.aborted) break;
            fullText += delta;
            this.sendJson({ type: "llm_partial", text: delta });
            sentenceBuffer += delta;
            let match: RegExpExecArray | null;
            while ((match = SENTENCE_END.exec(sentenceBuffer)) !== null) {
              const end = match.index + match[0].length;
              const sentence = sentenceBuffer.slice(0, end).trim();
              sentenceBuffer = sentenceBuffer.slice(end);
              if (sentence && !this.aborted) {
                const audio = await runAura2(this.env as any, { text: sentence });
                if (audio && !this.aborted) this.sendBinary(audio);
              }
            }
            SENTENCE_END.lastIndex = 0;
          }
          if (sentenceBuffer.trim() && !this.aborted) {
            const audio = await runAura2(this.env as any, { text: sentenceBuffer.trim() });
            if (audio) this.sendBinary(audio);
          }
          if (!this.aborted) {
            this.messages.push({ role: "assistant", content: fullText });
            this.sendJson({ type: "llm_complete", text: fullText });
          }
        } catch (e) {
          const reason = e instanceof Error ? e.message : String(e);
          this.sendJson({ type: "llm_error", reason });
        } finally {
          this.llmStreaming = false;
        }
      }
      return;
    }

    if (!this.ringBuffer || !this.echoEngine) return;
    this.sessionState?.setStreaming();
    this.ringBuffer.push(message);
    const chunks = this.ringBuffer.takeAll();
    for (const chunk of chunks) this.echoEngine.push(chunk);
  }

  async webSocketClose(_ws: WebSocket, _code: number, _reason: string, _wasClean: boolean): Promise<void> {
    this.cleanup();
  }

  async webSocketError(_ws: WebSocket, _error: unknown): Promise<void> {
    this.cleanup();
  }

  private cleanup(): void {
    if (this.sessionState) this.sessionState.setClosed();
    this.echoEngine?.flush();
    this.echoEngine = null;
    this.ringBuffer = null;
    this.ws = null;
  }
}
