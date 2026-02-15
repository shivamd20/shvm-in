# Vani - Voice Assistant for the Web

**Vani** is a drop-in React component library for adding intelligent, conversational voice interfaces to your web application. It handles the complexities of Voice Activity Detection (VAD), WebSocket communication, audio streaming, and state management, providing a beautiful, production-ready UI out of the box.

## Features

- **🗣️ Natural Conversation**: Interruptible, turn-based voice interaction powered by server-side LLMs.
- **⚡ Low Latency**: Optimistic UI updates and streaming audio for a snappy feel.
- **🎨 Two Modes**:
  - **Full Screen**: Immersive, dedicated voice interface with visualizers and transcripts.
  - **Pip (Picture-in-Picture)**: Compact, floating widget that follows the user across the app.
- **🛠️ Debugging**: Built-in debug console to visualize state transitions and audio events.
- **🔌 Easy Integration**: Just drop `<Vani />` into your layout or page.

## Installation

(Assuming internal project for now)

```bash
# Ensure dependencies are installed
yarn add lucide-react @tanstack/react-router
```

## Usage

Import the `Vani` component and use it in your application.

```tsx
import { Vani } from 'src/vani';

function App() {
  return (
    <Vani 
      defaultMode="pip" 
      onError={(err) => console.error("Voice Error:", err)}
    />
  );
}
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `defaultMode` | `'full' \| 'pip'` | `'full'` | Initial display mode. |
| `mode` | `'full' \| 'pip'` | `undefined` | Controlled mode stat. |
| `onModeChange` | `(mode) => void` | `undefined` | Callback when user toggles mode. |
| `onError` | `(error: string) => void` | `undefined` | Handler for connection or runtime errors. |

## Modes

### Full Screen Mode
A dedicated, immersive view perfect for focused conversations or mobile layouts. Includes:
- Large, animated microphone/status orb.
- Real-time transcripts.
- Background ambient effects based on state (Listening, Thinking, Speaking).

### Pip Mode
A unobtrusive floating widget (bottom-right) that keeps the assistant accessible while browsing.
- **Minimized**: A small, pulsing orb indicating status.
- **Expanded**: A card showing recent transcript and status details.
- **Docked**: Can be toggled back to full screen at any time.

## Intent & Vision

**Vani** was built to bridge the gap between chat interfaces and true voice assistants. The vision is to create an interface that feels "alive"—not just a command line with a microphone, but a presence that listens, thinks, and responds with nuance.

Key design principles:
1.  **Transparency**: The user should always know if the AI is listening, thinking, or speaking.
2.  **Fluidity**: Animations and transitions should mask network latency.
3.  **Resilience**: The UI should gracefully handle errors, interruptions, and network drops.

## Cost & Architecture

The Vani client is free (open source), but the backend services it connects to incur costs:

- **VAD (Voice Activity Detection)**: Runs **locally** in the browser using WASM (via `@ricky0123/vad-web`). **Cost: $0**.
- **STT (Speech-to-Text)**: Server-side transcription (e.g., Deepgram, Whisper). Costs typically range from **$0.0043 to $0.006 per minute**.
- **LLM (Language Model)**: The intelligence (e.g., GPT-4o, Claude 3.5 Sonnet). Costs vary by model usage (input/output tokens).
- **TTS (Text-to-Speech)**: Server-side synthesis (e.g., ElevenLabs, OpenAI). Costs range from **$15 to $100 per million characters** depending on quality.

**Estimated Cost per 10-minute session:** ~$0.05 - $0.20 depending on model choices.
