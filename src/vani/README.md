# 🎙️ Vani: Cloudflare Worker Voice Runtime

**Vani** (Sanskrit for "Voice") is a high-performance, low-latency voice interaction framework built on Cloudflare Workers and Durable Objects. It enables real-time, stateful voice conversations with AI, featuring robust session persistence and a strict backend-owned truth model.

---

## 🌟 Vision
The vision for Vani is to make voice interaction as reliable and manageable as text chat. By shifting the complexity of state management, audio processing, and AI orchestration to the **Edge (Cloudflare Workers)**, Vani provides:
- **Instant Recovery:** Reconnect to a session and resume exactly where you left off.
- **Multimodal Consistency:** Seamlessly switch between text and voice without losing context.
- **Privacy & Persistence:** History and state are stored in a distributed SQLite database within the Durable Object.
- **Low Latency:** Using Cloudflare's global network and Worker AI for real-time STT, LLM, and TTS.

---

## 🏗️ High-Level Design (HLD)

Vani follows a centralized architecture where the **Durable Object (DO)** acts as the brain of the conversation.

### Architecture Overview
```mermaid
graph TD
    Client[React/Client] <-->|WebSocket| Worker[Cloudflare Worker Router]
    Worker <-->|Fetch/Bind| DO[VoiceSession Durable Object]
    
    subgraph "Durable Object Runtime"
        DO -->|Persist| SQLite[(Local SQLite Storage)]
        DO -->|Orchestrate| Pipeline[Audio Pipeline]
        
        subgraph Pipeline
            STT[@cf/openai/whisper-tiny-en]
            LLM[@cf/meta/llama-3.1-8b-instruct]
            TTS[@cf/myshell-ai/melotts]
        end
    end
```

### Core Components
1.  **Durable Object (`VoiceSessionDO`)**: The source of truth. Each conversation is a unique DO instance. It handles WebSocket lifecycle, buffers audio, runs the AI pipeline, and manages the message history.
2.  **React Hook (`useVoiceSession`)**: A robust client-side state machine that manages the microphone, audio playback queue, and UI-specific session state.
3.  **SQLite Storage**: Built-in persistence for messages and session metadata, ensuring zero-loss conversations.
4.  **Worker AI Integration**: Leverages Cloudflare's serverless AI models for Speech-to-Text, Language Modeling, and Text-to-Speech.

---

## 🔄 Every Single State Transition

Vani uses two synchronized state machines: one on the **Server** (Authoritative) and one on the **Client** (Reactive).

### 1. Server-Side Transitions (`VoiceSessionDO`)
| From | To | Trigger | Action |
| :--- | :--- | :--- | :--- |
| `idle` | `listening` | JSON `{ "type": "start" }` | Resets audio buffer, opens intake. |
| `listening` | `thinking` | JSON `{ "type": "stop" }` or Binary EOF | Concatenates audio, starts STT (Whisper). |
| `thinking` | `speaking` | LLM starts yielding tokens | Begins streaming tokens and sentence-based TTS chunks. |
| `thinking` | `listening` | STT Error / No Speech | Broadcasts error and reverts for user retry. |
| `speaking` | `listening` | LLM Finished & TTS Flushed | Appends assistant message to history. |
| `*` | `error` | Any unhandled exception | Broadcasts error details to client. |

### 2. Client-Side Transitions (`useVoiceSession`)
| From | To | Trigger | Action |
| :--- | :--- | :--- | :--- |
| `disconnected` | `connecting` | `connect()` call | Opens WebSocket connection. |
| `connecting` | `idle` | `onopen` event | Initializes AudioContext and Mic permissions. |
| `idle` | `listening` | VAD `onSpeechStart` | Sends `start` to server, begins the turn. |
| `listening` | `processing` | VAD `onSpeechEnd` | Sends `stop` and final audio buffer to server. |
| `processing` | `speaking` | Binary packet received | Queues audio chunks and starts playback. |
| `speaking` | `idle` | Audio playback queue empty | Reverts to idle (ready for next turn). |
| `*` | `error` | Socket Close / Server Error | Displays error and provides recovery hooks. |

---

## 📡 Protocol Specification

Vani uses a dual-channel WebSocket protocol (JSON and Binary).

### 📤 Client → Server (Commands)
-   **Start Turn:** `{ "type": "start" }` — User began speaking.
-   **Audio Chunk:** `[Binary Payload]` — Raw `audio/webm` or PCM data.
-   **Stop Turn:** `{ "type": "stop" }` — User finished speaking.
-   **Manual Message:** `{ "type": "text.message", "content": "..." }` — Bypass STT.

### 📥 Server → Client (Events)
-   **Status Sync:** `{ "type": "state", "value": "thinking" }` — Authoritative state change.
-   **Transcript:** `{ "type": "transcript.final", "text": "..." }` — User's speech converted to text.
-   **Partial Text:** `{ "type": "assistant.partial", "text": "..." }` — LLM tokens for streaming display.
-   **Final Message:** `{ "type": "assistant.message", "message": {...} }` — Full assistant response.
-   **Audio Output:** `[Binary Payload]` — Streamed TTS audio chunks (WAV/PCM).

---

## 🛠️ Implementation Details

### Pipeline Execution Flow
1.  **Buffering:** Audio is accumulated in the DO memory during the `listening` phase.
2.  **STT (Whisper):** On `stop`, the buffer is sent to Whisper. Tiny-en is used for sub-second latency.
3.  **LLM (Llama):** The transcript is appended to the SQLite-backed history and sent to Llama 3.1.
4.  **TTS (MeloTTS):** LLM tokens are buffered into sentences. Each sentence is piped to MeloTTS in parallel with the LLM generation for "speech-streaming."
5.  **Playback:** The client uses an `AudioContext` buffer queue to play back chunks with zero cross-fade artifacts.

### Persistence Strategy
-   **Messages Table:** Stores IDs, roles, and content.
-   **Automatic Recovery:** On WebSocket reconnection, the DO broadcasts the *latest authoritative state* and (optionally) the last few messages, allowing the UI to reconstruct the conversation instantly.

---

## 🚀 Getting Started

```bash
# Vani directory structure
/src/vani
├── server/
│   └── VoiceSessionDO.ts  # The Heart (Durable Object)
└── react/
    ├── useVoiceSession.ts # The Pulse (React Hook)
    └── VoiceDebugSidebar.tsx # The Observer
```

To integrate Vani:
1.  Add `VoiceSessionDO` to your `wrangler.toml` migrations.
2.  Bind the DO to your Worker.
3.  Use the `useVoiceSession` hook in your UI components to access `status` and `transcript`. Recording is now handled automatically via client-side VAD.

---

## 🔮 Future Roadmap
-   **Barge-in Support:** Allow user interruption during the `speaking` phase.
-   **R2 Audio Storage:** Persist full audio recordings for session playback.
-   **VAD-at-Edge:** Move Voice Activity Detection to the server to handle automated turn-taking without client-side PTT.
-   **Multi-Model Switcher:** Hot-swap models (Whisper vs. Grok vs. Claude) via session metadata.

---
*Built with ❤️ by the Antigravity team for shvm-in.*
