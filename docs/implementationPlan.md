# Voice AI – 5 Shot Implementation Plan (Cursor-Executable)

This plan is structured so Cursor can build incrementally.
Each phase is:

* End to end runnable
* Measurable
* Self validating
* Risk front loaded
* Minimal surface area per phase

Architecture assumptions:

* Ultra thin client (mic → ws → audio back)
* WebSocket → Durable Object
* XState inside DO
* Server owns all intelligence
* Horizontal scalability required

---

# End-to-End Plan

Full pipeline (target state):

```
Client (mic, 16 kHz linear16, ~8.2 KB chunks)
    → Worker: /v2/flux/:id (Flux = STT + VAD)
    → Flux events (Update, StartOfTurn, EagerEndOfTurn, TurnResumed, EndOfTurn)
    → Session DO: turn-final transcript → LLM (Workers AI, fastest chat)
    → LLM stream → Scheduler → TTS (Aura-2 @cf/deepgram/aura-2-en)
    → Audio stream (e.g. MPEG) → Client playback
```

**Provider stack:**

| Stage   | Provider     | Model / API |
| ------- | ------------ | ----------- |
| STT+VAD | Workers AI   | **@cf/deepgram/flux** — streaming, turn detection built-in |
| LLM     | Workers AI   | Fastest chat model (streaming, cancellable) |
| TTS     | Workers AI   | **@cf/deepgram/aura-2-en** — context-aware TTS; text → audio (e.g. MPEG stream) |

**Phases:**

| Phase | Focus | Key deliverables |
| ----- | ----- | ----------------- |
| 1     | Transport | DO, WebSocket, echo, backpressure |
| 2     | **Flux STT+VAD** | Client AudioWorklet → Flux; turn events; transcription-only UI |
| 3     | **LLM** | Workers AI streaming LLM; STT final → LLM → token stream |
| 4     | **TTS + barge-in** | Aura-2 adapter; audio to client; interrupt on Flux turn |
| 5     | Scale & observability | Metrics, retries, load target |

---

# Phase 1 — Deterministic Duplex Transport Core

## Goal

Prove streaming transport, ordering, lifecycle and backpressure without AI.

## Scope

### Client

* Capture PCM or Opus
* Send fixed size frames (e.g. 20ms)
* Play received frames
* Connect + mute only

### Server

* Durable Object per session
* WebSocket upgrade
* Ring buffer for inbound frames
* Echo engine (delay 500ms then replay)
* XState machine with states:

  * connected
  * streaming
  * closed

No STT. No LLM. No TTS.

## Deliverables

* ws-server.ts
* session.do.ts
* audio-buffer.ts
* state-machine.ts

## Validation Script

* 10 minute continuous duplex test
* 100 concurrent sessions load test
* Verify:

  * no frame reordering
  * no memory growth
  * <150ms additional RTT

## Exit Criteria

Transport layer deterministic and stable.

---

# Phase 2 — Flux STT + VAD (Transcription Pipeline)

## Goal

STT and turn detection in one pipeline using Flux; no separate VAD.

## Scope

### Flux as single STT+VAD

* Workers AI **@cf/deepgram/flux**; client connects via `/v2/flux/:sessionId`.
* Input: linear16 PCM, 16 kHz, **256 ms chunks** (4096 samples, ~8.2 KB); AudioWorklet capture; keep-alive when idle; backpressure 128 KB.
* Output: **Flux events** — Update (partial transcript), StartOfTurn, EagerEndOfTurn, TurnResumed, EndOfTurn (final turn transcript). Use these for both transcription and turn boundaries (no separate VAD actor).
* **Local dev:** With `vite dev`, the Worker runs in the same process (Cloudflare Vite plugin); same origin (e.g. localhost:3200).

### Client

* AudioWorklet (`flux-capture-worklet.js`) → 16 kHz, 4096-sample chunks → WebSocket to Flux.
* Transcription-only UI: start/stop, live transcript, history, Flux state badges (event type, turn index, end_of_turn_confidence).

### Server

* `stt-adapter.ts`: `getFluxWebSocketResponse(env)` for Worker route.
* Optional: session DO receives Flux events for downstream LLM (Phase 3).

### State Machine Expansion

States: listening, transcribing, idle. Transitions: AUDIO_FRAME, TRANSCRIPT_PARTIAL, TRANSCRIPT_FINAL (EndOfTurn), ERROR.

## Deliverables

* stt-adapter.ts (Flux)
* flux-capture-worklet.js + useVani2Transcription (AudioWorklet)
* Transcription UI with Flux state
* updated state-machine.ts (if DO used)

## Validation

* Partial transcript <300ms
* Turn boundaries (StartOfTurn, EndOfTurn) reliable
* No cross-session bleed
* 100 concurrent sessions stable

## Exit Criteria

Flux STT+VAD is the single source of transcript and turn detection. No separate VAD. Memory stable.

---

# Phase 3 — LLM Streaming (Workers AI)

## Goal

Add reasoning without voice output. Use Workers AI fastest chat model.

## Scope

### Add

* **LLM adapter**: Workers AI streaming chat (choose fastest available model for chat completion).
* Tool call interface (single tool only) if needed.
* Deterministic event routing: Flux EndOfTurn (or chosen turn-final) → LLM prompt → token stream.

### Flow

Flux EndOfTurn (or EagerEndOfTurn + timeout) → transcript → LLM_STREAM → TOKEN_STREAM → WS_TEXT or buffer for TTS.

No TTS yet.

### Constraints

* One active LLM stream per session
* Cancellation token enforced for barge-in (Phase 4)
* Tool calls idempotent

## Deliverables

* llm-adapter.ts (Workers AI)
* tool-executor.ts (optional)
* cancellation.ts
* updated state-machine.ts

## Validation

* First token <200ms
* No duplicate tool calls
* Multi turn consistency
* Streaming does not block inbound audio / Flux

## Exit Criteria

Reasoning layer stable under load. Ready to feed TTS.

---

# Phase 4 — TTS (Aura-2) + Barge-In

## Goal

Full duplex conversational agent: Aura-2 TTS and interruption handling.

## Scope

### TTS: @cf/deepgram/aura-2-en

* **Model**: Workers AI **@cf/deepgram/aura-2-en** — context-aware TTS (natural pacing, expressiveness).
* **Input**: `text` (required), optional `speaker` (default luna), `encoding`, `container`, `sample_rate`, `bit_rate` per API.
* **Output**: ReadableStream of audio (e.g. MPEG). Use streaming or batch per Workers AI binding.
* Adapter: accept speakable text from Scheduler; call Workers AI; stream or chunk audio to client.

### Barge-in

* Interrupt detection: Flux **StartOfTurn** or **TurnResumed** during playback → interrupt.
* Hard cancellation: LLM stream, TTS stream.
* State: speaking, interrupted, cancelling. Fade/stop downstream audio.

### Client

* Receive audio frames (e.g. MPEG chunks); decode and play (or use pre-decoded format). No overlap with next assistant turn.

## Deliverables

* tts-adapter.ts (Aura-2)
* interrupt-controller.ts (Flux turn events → cancel LLM/TTS)
* audio-output-buffer.ts
* updated state-machine.ts

## Validation

* Assistant stops <200ms after user speech (Flux turn)
* No overlapping audio
* 50 rapid interruptions stable
* CPU stable under load

## Exit Criteria

Deterministic interruption handling. End-to-end: mic → Flux → LLM → Aura-2 → speaker.

---

# Phase 5 — Scale, Isolation, Observability

## Goal

Production readiness.

## Scope

### Isolation

* Per session Durable Object
* Session TTL cleanup

### Observability

* Structured tracing per session
* Latency histograms
* Memory metrics
* Tool execution timing

### Resilience

* Flux (STT) auto reconnect + keep-alive
* LLM retry with idempotency
* TTS (Aura-2) fallback

## Load Target

* 1k concurrent sessions
* P95 <800ms end to end
* P99 <1.5s

## Deliverables

* metrics.ts
* tracing.ts
* retry-policy.ts
* load-test scripts

## Exit Criteria

Stable horizontal scale with no cross-session contamination.

---

# Folder Structure Cursor Should Create

/src
/client
/server
/durable
/state
/adapters
stt
llm
tts
/tools
/metrics
/utils

---

# Non Goals (Until After Phase 5)

* Prompt optimization
* Multi tool chaining
* Memory embedding store
* Fancy UX
* Multi region replication

---

# Execution Discipline

Cursor must:

* Build one phase fully before next
* Write load test per phase
* Add memory assertion checks
* Avoid adding new features mid phase
* Keep state machine explicit and event driven

---

If needed next:

* I can provide exact XState machine schema
* Or Durable Object lifecycle design
* Or latency budget breakdown per stage
