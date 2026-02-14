# Cloudflare Worker Voice Runtime — Detailed Implementation Plan (Durable Object Edition)

This plan reflects the updated architecture:

* All voice processing happens on the backend (Cloudflare Worker + Durable Objects).
* Frontend only streams audio in and receives events/audio out.
* Each voice session = one Durable Object instance.
* Persistent websocket connection with reconnect support via session id.
* Messages, transcripts, and audio metadata stored in SQLite (Durable Objects SQLite storage).
* Fixed pipeline for v1:

  * VAD: `@cf/pipecat-ai/smart-turn-v2`
  * STT: `@cf/openai/whisper-tiny-en`
  * LLM: `@cf/meta/llama-4-scout-17b-16e-instruct`
  * TTS: `@cf/myshell-ai/melotts`
* User input disabled while assistant is speaking (no interruption in v1).

This document is designed so a coding agent can implement it without inventing missing architecture.

---

## 1. Core Design Principles (lock these)

### 1.1 Conversation-first architecture

Voice is an input/output modality only.

Canonical state:

```
messages[]
```

Voice turns produce user messages and assistant messages.

This enables:

* switching between voice and text seamlessly
* persistence and replay
* future library extraction

---

### 1.2 Backend-owned truth

The server controls:

* session state
* turn lifecycle
* speaking/listening permissions

Client is mostly a renderer and audio transport.

---

### 1.3 Event-driven internal architecture

Pipeline components communicate via internal events.

Do NOT directly call components in sequence.

This avoids tight coupling and future rewrites.

---

## 2. High-Level Architecture

```
Client
  ↕ WebSocket
Worker Router
  ↕ Durable Object (one per session)
Durable Object Runtime
  ├── Session State
  ├── Event Bus
  ├── Audio Pipeline
  │    ├── VAD
  │    ├── STT
  │    └── TTS
  ├── Conversation Engine
  ├── LLM Runtime
  └── SQLite Storage
```

---

## 3. Durable Object Session Model

### 3.1 Why Durable Objects

You need:

* stable websocket ownership
* single-threaded ordering guarantees
* reconnection by id
* local SQLite storage

DO gives all of this natively.

---

### 3.2 Session identity

Client creates or loads:

```
sessionId
```

Route pattern:

```
/ws/:sessionId
```

Worker router:

```ts
const id = env.VOICE_SESSIONS.idFromName(sessionId)
const stub = env.VOICE_SESSIONS.get(id)
return stub.fetch(request)
```

Reconnection:

* same sessionId
* DO restores state from SQLite
* websocket re-attached

---

## 4. Session Lifecycle

### 4.1 Connection start

1. Client opens websocket to DO.
2. DO accepts socket.
3. DO loads message history from SQLite.
4. State initialized.

Initial state:

```
idle
```

---

### 4.2 Turn loop (v1)

Strict turn-taking:

```
LISTENING
 → user speech
 → VAD end
 → STT final
 → THINKING (LLM)
 → SPEAKING (TTS)
 → LISTENING
```

Important:

* client cannot send audio while speaking/thinking
* server enforces this

---

## 5. State Machine (explicit)

```ts
type SessionStatus =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'error'
```

Rules:

* audio accepted only in `listening`
* text messages allowed anytime (optional)
* no barge-in in v1

State changes must always emit websocket events.

---

## 6. Data Model (SQLite)

### 6.1 Messages table

```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
```

---

### 6.2 Transcripts table

```sql
CREATE TABLE transcripts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  message_id TEXT,
  text TEXT NOT NULL,
  is_final INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
```

---

### 6.3 Audio table (SQLite-safe storage)

SQLite supports BLOB, and for v1 all audio should be stored directly in SQLite as BLOBs (no R2 yet).

```sql
CREATE TABLE audio_chunks (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  message_id TEXT,
  kind TEXT NOT NULL,
  r2_key TEXT,
  codec TEXT,
  duration_ms INTEGER,
  created_at INTEGER NOT NULL
);
```

Recommendation:

* store full turn audio, not every chunk.

---

## 7. WebSocket Protocol

### 7.1 Incoming (client → server)

```json
{ "type": "start" }
{ "type": "stop" }
{ "type": "text.message", "content": "hello" }
```

Binary frame:

```
audio chunk (PCM 24kHz mono)
```

If state != listening:

```json
{ "type": "error", "reason": "assistant_turn" }
```

---

### 7.2 Outgoing (server → client)

```json
{ "type": "state", "value": "listening" }
{ "type": "transcript.partial", "text": "hel" }
{ "type": "transcript.final", "text": "hello world" }
{ "type": "assistant.partial", "text": "Hi" }
{ "type": "assistant.message", "message": {...} }
```

Binary frames:

```
TTS audio chunks
```

---

## 8. Internal Event Bus

```ts
type VoiceEvent =
  | { type: 'audio.chunk'; data: ArrayBuffer }
  | { type: 'vad.start' }
  | { type: 'vad.end' }
  | { type: 'stt.partial'; text: string }
  | { type: 'stt.final'; text: string }
  | { type: 'llm.token'; token: string }
  | { type: 'llm.done'; message: Message }
  | { type: 'tts.chunk'; data: ArrayBuffer }
  | { type: 'state.change'; state: SessionStatus }
```

---

## 9. Pipeline Implementation Details

### 9.1 VAD (Smart Turn)

Example usage pattern inside Worker:

```ts
const vad = await env.AI.run('@cf/pipecat-ai/smart-turn-v2', {
  format: 'mp3'
})

const result = await vad(audioChunk, {
  sampleRate: 24000
})

// example shape
// { is_complete: true, probability: 0.87 }
```

Behavior:

* continuously evaluate chunks
* when `is_complete` true → finalize turn

---

### 9.2 STT (Whisper Tiny EN)

Example:

```ts
const sttResult = await env.AI.run('@cf/openai/whisper-tiny-en', {
  audio: audioBuffer
})

const text = sttResult.text
```

Guideline:

* accumulate turn audio in memory
* run STT once on VAD completion

This keeps architecture simple for v1.

---

### 9.3 LLM (Llama 4 Scout)

Example streaming call:

```ts
const stream = await env.AI.run(
  '@cf/meta/llama-4-scout-17b-16e-instruct',
  {
    messages,
    stream: true
  }
)

for await (const chunk of stream) {
  // emit assistant.partial
}
```

After completion:

* save assistant message
* transition state to speaking

---

### 9.4 TTS (MeloTTS)

Example:

```ts
const tts = await env.AI.run('@cf/myshell-ai/melotts', {
  text: assistantText,
  voice: 'en-US'
})

// output is audio bytes
```

Stream chunks to websocket as binary frames.

---

## 10. Turn Execution Flow (exact)

1. State → listening.
2. Receive audio chunks.
3. Run VAD continuously.
4. On VAD completion:

   * stop intake
   * finalize audio buffer
5. Run STT.
6. Save transcript.
7. Append user message.
8. State → thinking.
9. Stream LLM tokens to client.
10. Save assistant message.
11. State → speaking.
12. Generate TTS audio.
13. Stream TTS audio to client.
14. State → listening.

---

## 11. Conversation Engine (pure logic)

Responsibilities:

* message history
* invoking LLM
* storing messages
* emitting partial responses

No audio awareness.

---

## 12. Durable Object Class Outline

```ts
export class VoiceSessionDO {
  constructor(state, env) {}

  async fetch(request) {
    // websocket upgrade
  }

  handleWebSocketMessage(ws, msg) {}

  async handleAudioChunk(chunk) {}

  async executeTurn(audioBuffer) {}

  broadcast(event) {}
}
```

DO advantages:

* serialized execution
* no race conditions between turns

---

## 13. Reconnection Strategy

When client reconnects with same session id:

1. close old websocket if alive
2. attach new websocket
3. replay current state:

   * latest messages
   * current status

If mid-generation:

* continue if possible
* otherwise emit recoverable error and return to listening.

---

## 14. Storage Strategy (recommended)

### Persist:

* messages
* final transcripts
* turn-level audio references

### Do NOT persist:

* partial transcripts
* per-chunk data

---

## 15. Test UI (brief spec)

Purpose: validate backend behavior, not design UX.

Components:

1. Message timeline

   * user + assistant bubbles
   * transcript visibility

2. Status indicator

   * Listening
   * Thinking
   * Speaking

3. Mic button (toggle)

   * disabled while speaking/thinking

4. Live transcript area

   * partial text updates

5. Audio player pipeline

   * plays streamed TTS chunks

6. Session id display

   * reconnect button for testing DO recovery

This UI should expose every state change visually.

---

## 16. Milestones (updated)

### Milestone 1 — Durable Object websocket routing

* session id routing
* persistent connection
* reconnection logic

---

### Milestone 2 — VAD + STT turn detection

* audio buffering per turn
* transcript finalization

---

### Milestone 3 — LLM integration

* messages persisted
* token streaming

---

### Milestone 4 — TTS streaming

* assistant voice playback

---

### Milestone 5 — Full turn locking

* disable user audio during assistant turn
* UI status sync

---

### Milestone 6 — Persistence validation

* reconnect retains history
* replay state

---

## 17. Biggest Risks (updated)

### Risk 1 — Blocking DO event loop

Long inference calls can stall websocket handling.

Mitigation:

* keep turn execution async
* avoid synchronous processing loops.

---

### Risk 2 — Memory buildup from audio buffering

Always clear buffers after turn completion.

---

### Risk 3 — Ambiguous state transitions

Every change must emit:

```json
{ "type": "state", "value": "..." }
```

---

## 18. Final Litmus Test

Architecture is correct if:

* reconnecting with session id restores conversation instantly
* removing audio leaves a functional chat backend
* replacing a model modifies only one pipeline file
* UI can render entirely from websocket events

If true, you are ready to evolve this into a standalone library later.
