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

# Phase 2 — Streaming STT Pipeline

## Goal

Introduce external streaming dependency and async orchestration pressure.

## Scope

### Add

* Streaming STT adapter
* Transcript event emitter
* Partial + final transcript events

### State Machine Expansion

States:

* listening
* transcribing
* idle

Transitions must be explicit events:

* AUDIO_FRAME
* TRANSCRIPT_PARTIAL
* TRANSCRIPT_FINAL
* ERROR

## Deliverables

* stt-adapter.ts
* transcript-aggregator.ts
* updated state-machine.ts

## Validation

* Partial transcript <300ms
* Final transcript reliable
* No cross-session transcript bleed
* 100 concurrent sessions stable

## Exit Criteria

STT does not block event loop.
Memory remains stable.

---

# Phase 3 — LLM Streaming Orchestrator

## Goal

Add reasoning without voice output.

## Scope

### Add

* LLM streaming adapter
* Tool call interface (single tool only)
* Deterministic event routing

### Flow

STT_FINAL → LLM_STREAM → TOKEN_STREAM → WS_TEXT

No TTS yet.

### Constraints

* One active LLM stream per session
* Cancellation token enforced
* Tool calls idempotent

## Deliverables

* llm-adapter.ts
* tool-executor.ts
* cancellation.ts
* updated state-machine.ts

## Validation

* First token <200ms
* No duplicate tool calls
* Multi turn consistency
* Streaming does not block inbound audio

## Exit Criteria

Reasoning layer stable under load.

---

# Phase 4 — Streaming TTS + Barge In

## Goal

Full duplex conversational agent with interruption handling.

## Scope

### Add

* Streaming TTS adapter
* Audio chunk streaming to client
* Interrupt detection
* Hard cancellation of:

  * LLM
  * TTS

### State Additions

* speaking
* interrupted
* cancelling

Explicit cancellation events required.

## Deliverables

* tts-adapter.ts
* interrupt-controller.ts
* audio-output-buffer.ts
* updated state-machine.ts

## Validation

* Assistant stops <200ms after user speech
* No overlapping audio
* 50 rapid interruptions stable
* CPU stable under load

## Exit Criteria

Deterministic interruption handling.

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

* STT auto reconnect
* LLM retry with idempotency
* TTS fallback

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
