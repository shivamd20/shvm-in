# `@shvm/vani-client`

Minimal, opinionated **headless voice agent client** for the web:

- A React hook (`useVoiceSession`) that manages:
  - mic voice activity detection (VAD)
  - websocket lifecycle
  - audio streaming (client → server)
  - transcript + state machine state
  - server → client events (partial/final transcript, feedback, errors)
- A small **shared contract** module (types + websocket message schema) to keep client/server in lockstep.

This package also ships an optional UI layer at `@shvm/vani-client/ui` (used by the site). For now it intentionally relies on the host app’s Tailwind/CSS setup (no isolated CSS shipped yet).

---

## Installation

```bash
npm i @shvm/vani-client
```

Peer dependency:
- `react` (this package targets modern React; currently developed against React 19)

---

## Quick start (headless)

```tsx
import { useVoiceSession } from "@shvm/vani-client/headless";

export function VoiceWidget() {
  const voice = useVoiceSession({
    serverUrl: "https://your-app.com",
    onMessage: (m) => console.log(m.role, m.content),
    onError: (e) => console.error(e),
  });

  return (
    <div>
      <div>Status: {voice.status}</div>
      <button onClick={voice.connect} disabled={voice.status !== "disconnected" && voice.status !== "error"}>
        Connect
      </button>
      <button onClick={voice.cancel} disabled={voice.status !== "processing" && voice.status !== "speaking"}>
        Cancel
      </button>
      <ul>
        {voice.transcript.map((m) => (
          <li key={m.id}>
            <b>{m.role}:</b> {m.content}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

If you omit `serverUrl`, the hook defaults to the current origin and connects to `ws(s)://<host>/ws/<sessionId>`.

---

## Server URL configuration

`useVoiceSession()` can build the websocket URL in 3 ways (in priority order):

### 1) `getWebSocketUrl(sessionId)` (full override)

```ts
useVoiceSession({
  getWebSocketUrl: (sessionId) => `wss://voice.example.com/ws/${sessionId}`,
});
```

### 2) `serverUrl` + `wsPath(sessionId)`

```ts
useVoiceSession({
  serverUrl: "https://example.com",
  wsPath: (sessionId) => `/ws/${sessionId}`,
});
```

- `serverUrl` may be `https://…`, `http://…`, `wss://…`, or `ws://…`
- `https` → `wss`, `http` → `ws`
- Default `wsPath` is `/ws/${sessionId}`

### 3) Default (current window location)

If neither override is provided:

- `wss://<host>/ws/<sessionId>` when on `https:`
- `ws://<host>/ws/<sessionId>` when on `http:`

---

## Client/server contract (websocket)

This package exports the contract types from `@shvm/vani-client/shared`.

### Client → server JSON

```ts
import type { ClientToServerJson } from "@shvm/vani-client/shared";
```

Events:
- `{ type: "start"; config?: VoiceConfig }`
- `{ type: "stop" }`
- `{ type: "reset" }`
- `{ type: "text.message"; content: string }`

Audio is sent as **binary websocket messages** (the client currently sends WAV bytes for VAD end-of-speech).

### Server → client JSON

```ts
import type { ServerToClientJson } from "@shvm/vani-client/shared";
```

Events:
- `{ type: "state"; value: SessionStatus }`
- `{ type: "transcript.final"; text: string }`
- `{ type: "assistant.message"; message: { role: "assistant"; content: string } }`
- `{ type: "assistant.partial"; text: string }`
- `{ type: "feedback"; message: string }`
- `{ type: "error"; reason: string }`

---

## Voice model configuration

The client sends a `VoiceConfig` as part of `{ type: "start" }`.

```ts
import type { VoiceConfig } from "@shvm/vani-client/shared";
```

The server is responsible for implementing STT/LLM/TTS using the config, and streaming back:
- transcript text
- assistant text (partial or final)
- assistant audio (binary websocket frames)

---

## How to run a server

This package is intentionally server-agnostic.

You need a websocket endpoint that:
1. Accepts JSON control messages (start/stop/reset/text)
2. Accepts binary audio frames
3. Emits state + transcript + assistant messages
4. Emits assistant audio as binary frames

### Cloudflare Durable Object (reference)

This repo includes a working reference server implementation under:
- `src/vani/server/runtime/machine.ts`
- `src/vani/server/handlers/VoiceSessionDO.ts`

It exposes:
- `GET /ws/:sessionId` websocket upgrade → DO stub fetch

---

## What this package is (and is not)

**Is**
- A pragmatic, minimal headless voice client for a “voice chat” style agent
- Opinionated around websocket streaming and a small state machine
- Designed to keep a clean seam between UI and logic

**Is not**
- A full UI kit (yet)
- A general telephony/IVR SDK
- A full speech pipeline framework (you bring your server models)

---

## Roadmap

- Isolate UI styling (scoped + packaged CSS) and/or split UI into a separate package
- Improve config surface for:
  - custom session ID strategy
  - custom audio encoding/container
  - optional token-level partials
- Add a non-React adapter (pure JS client) if needed

---

## License

MIT (see repository license).
