import { DurableObject } from "cloudflare:workers";
import { RingBuffer } from "./ring-buffer";
import { EchoEngine } from "./echo-engine";
import { SessionState } from "./session-state";
import { parseClientJson, serializeServerJson, type SessionState as SessionStateType } from "../protocol";

const RING_BUFFER_CAPACITY = 256;
const DEFAULT_ECHO_DELAY_MS = 0;

export class Vani2SessionDO extends DurableObject {
  private ws: WebSocket | null = null;
  private sessionState: SessionState | null = null;
  private ringBuffer: RingBuffer | null = null;
  private echoEngine: EchoEngine | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
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

    const stateMsg = serializeServerJson({
      type: "state",
      value: this.sessionState.get() as SessionStateType,
    });
    server.send(stateMsg);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (this.sessionState?.isClosed() || !this.ringBuffer || !this.echoEngine) return;

    if (typeof message === "string") {
      const parsed = parseClientJson(message);
      if (parsed?.type === "control.mute") {
        // Phase 1: optional no-op or future mute handling
      }
      return;
    }

    this.sessionState.setStreaming();
    this.ringBuffer.push(message);
    const chunks = this.ringBuffer.takeAll();
    for (const chunk of chunks) this.echoEngine.push(chunk);
  }

  async webSocketClose(ws: WebSocket, _code: number, _reason: string, _wasClean: boolean): Promise<void> {
    this.cleanup();
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
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
