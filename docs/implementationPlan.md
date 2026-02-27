# Vani2 — High-Level Implementation Summary

See **[VaniV2.md](./VaniV2.md)** for full architecture and design.

## Goals

* Ultra-thin client (mic → WebSocket → audio back).
* WebSocket → Durable Object per session.
* XState inside DO for session lifecycle (connected / streaming / closed).
* Server owns all intelligence; horizontal scalability.

## Pipeline (Current)

```
Client (mic, 16 kHz linear16)
  → /v2/flux/:id (Flux STT + VAD)
  → Flux events (Update, StartOfTurn, EagerEndOfTurn, TurnResumed, EndOfTurn)
  → Session DO: turn-final transcript → LLM (Workers AI) → TTS (Aura-2)
  → Audio stream → Client playback
```

## Phases (Summary)

1. **Transport** — DO, WebSocket, echo, backpressure.
2. **Flux STT+VAD** — Client AudioWorklet → Flux; turn events; transcription UI.
3. **LLM** — Workers AI streaming; transcript_final → token stream.
4. **TTS + barge-in** — Aura-2 adapter; audio to client; interrupt on Flux turn.
5. **Scale & observability** — Metrics, retries, load target.

## Provider Stack

| Stage   | Provider   | Model / API                    |
| ------- | ---------- | ------------------------------ |
| STT+VAD | Workers AI | @cf/deepgram/flux              |
| LLM     | Workers AI | Fastest chat (streaming)       |
| TTS     | Workers AI | @cf/deepgram/aura-2-en         |

## Non-Goals (Until After Phase 5)

* Prompt optimization, multi-tool chaining, memory store, multi-region.
