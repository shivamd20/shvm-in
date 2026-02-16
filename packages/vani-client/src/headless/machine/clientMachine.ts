import { assign, fromCallback, setup } from "xstate";
import { createBlobUrl } from "../adapters/blobUrl";
import type { ClientMessage, SessionStatus, VoiceStatus } from "../../shared/types/voice";

export const socketActor = fromCallback(() => {
  return () => {};
});

export const audioActor = fromCallback(() => {
  return () => {};
});

export interface DebugEvent {
  id: string;
  type: "state_change" | "socket_event" | "audio_input" | "audio_output" | "transcript" | "llm_token" | "error";
  timestamp: number;
  details: unknown;
  blobUrl?: string;
}

export interface ClientContext {
  status: VoiceStatus;
  serverStatus: SessionStatus;
  transcript: ClientMessage[];
  history: DebugEvent[];
  error: string | null;
  isPlaying: boolean;
}

// --- Events ---

export type ClientEvent =
  | { type: "CONNECT" }
  | { type: "DISCONNECT" }
  | { type: "CONNECTED" }
  | { type: "SET_ERROR"; error: string }
  | { type: "SERVER_STATE_CHANGE"; status: SessionStatus }
  | { type: "START_LISTENING" }
  | { type: "STOP_LISTENING" }
  | { type: "ADD_MESSAGE"; role: ClientMessage["role"]; content: string }
  | { type: "AUDIO_PLAYBACK_START" }
  | { type: "AUDIO_PLAYBACK_END" }
  | { type: "LOG_EVENT"; eventType: DebugEvent["type"]; details: unknown; blob?: Blob }
  | { type: "TIMEOUT" }
  | { type: "CANCEL" };


// --- Machine ---

export const clientMachine = setup({
  types: {
    context: {} as ClientContext,
    events: {} as ClientEvent,
  },
  actions: {
    setStatusConfig: assign({
      status: () => "connecting",
    }),
    setConnected: assign({
      status: () => "idle",
      history: ({ context }) => [
        ...context.history,
        {
          id: Math.random().toString(36).slice(2),
          type: "socket_event" as const,
          timestamp: Date.now(),
          details: { status: "connected" },
        },
      ],
    }),
    setDisconnected: assign({
      status: () => "disconnected",
      history: ({ context }) => [
        ...context.history,
        {
          id: Math.random().toString(36).slice(2),
          type: "socket_event" as const,
          timestamp: Date.now(),
          details: { status: "disconnected" },
        },
      ],
    }),
    setError: assign({
      status: () => "error",
      error: ({ event }) => (event.type === "SET_ERROR" ? event.error : null),
      history: ({ context, event }) => [
        ...context.history,
        {
          id: Math.random().toString(36).slice(2),
          type: "error" as const,
          timestamp: Date.now(),
          details: { message: event.type === "SET_ERROR" ? event.error : "Unknown error" },
        },
      ],
    }),
    updateServerStatus: assign({
      serverStatus: ({ context, event }) => (event.type === "SERVER_STATE_CHANGE" ? event.status : context.serverStatus),
      history: ({ context, event }) => {
        if (event.type !== "SERVER_STATE_CHANGE") return context.history;
        return [
          ...context.history,
          {
            id: Math.random().toString(36).slice(2),
            type: "state_change" as const,
            timestamp: Date.now(),
            details: { from: context.serverStatus, to: event.status, source: "server" },
          },
        ];
      },
    }),
    setPlaying: assign({
      isPlaying: ({ event }) => event.type === "AUDIO_PLAYBACK_START",
    }),
    addMessage: assign({
      transcript: ({ context, event }) => {
        if (event.type !== "ADD_MESSAGE") return context.transcript;
        return [
          ...context.transcript,
          {
            id: Math.random().toString(36).slice(2),
            role: event.role,
            content: event.content,
            timestamp: Date.now(),
          },
        ];
      },
      history: ({ context, event }) => {
        if (event.type !== "ADD_MESSAGE") return context.history;
        return [
          ...context.history,
          {
            id: Math.random().toString(36).slice(2),
            type: "transcript" as const,
            timestamp: Date.now(),
            details: { role: event.role, text: event.content },
          },
        ];
      },
    }),
    logEvent: assign({
      history: ({ context, event }) => {
        if (event.type !== "LOG_EVENT") return context.history;
        return [
          ...context.history,
          {
            id: Math.random().toString(36).slice(2),
            type: event.eventType,
            timestamp: Date.now(),
            details: event.details,
            blobUrl: event.blob ? createBlobUrl(event.blob) : undefined,
          },
        ];
      },
    }),
    clearError: assign({
      error: null,
    }),
  },
  guards: {
    isServerThinkingOrSpeaking: ({ context, event }) => {
      const status = event.type === "SERVER_STATE_CHANGE" ? event.status : context.serverStatus;
      return status === "thinking" || status === "speaking";
    },
  },
}).createMachine({
  id: "client",
  initial: "disconnected",
  context: {
    status: "disconnected",
    serverStatus: "idle",
    transcript: [],
    history: [],
    error: null,
    isPlaying: false,
  },
  on: {
    LOG_EVENT: { actions: "logEvent" },
    ADD_MESSAGE: { actions: ["addMessage", "clearError"] },
    SET_ERROR: { target: ".error", actions: "setError" },
    DISCONNECT: { target: ".disconnected", actions: "setDisconnected" },
  },
  states: {
    disconnected: {
      on: {
        CONNECT: { target: "connecting", actions: "setStatusConfig" },
      },
    },
    connecting: {
      on: {
        CONNECTED: { target: "connected", actions: "setConnected" },
      },
    },
    connected: {
      initial: "idle",
      states: {
        idle: {
          entry: assign({ status: "idle" }),
          on: {
            START_LISTENING: { target: "#client.listening", actions: "clearError" },
            AUDIO_PLAYBACK_START: { target: "#client.speaking", actions: "setPlaying" },
            SERVER_STATE_CHANGE: [
              {
                guard: "isServerThinkingOrSpeaking",
                target: "processing",
                actions: "updateServerStatus",
              },
              {
                actions: "updateServerStatus",
              },
            ],
          },
        },
        processing: {
          entry: assign({ status: "processing" }),
          after: {
            20000: { target: "idle", actions: assign({ error: "Server timed out. Interactions will reset." }) },
          },
          on: {
            CANCEL: { target: "idle", actions: "clearError" },
            START_LISTENING: { target: "#client.listening", actions: "clearError" },
            AUDIO_PLAYBACK_START: { target: "#client.speaking", actions: "setPlaying" },
            SERVER_STATE_CHANGE: [
              {
                guard: ({ event }) => event.status === "listening" || event.status === "idle",
                target: "idle",
                actions: "updateServerStatus",
              },
              {
                actions: "updateServerStatus",
              },
            ],
          },
        },
      },
    },
    listening: {
      entry: assign({ status: "listening" }),
      on: {
        STOP_LISTENING: { target: "connected.processing" },
        SERVER_STATE_CHANGE: { actions: "updateServerStatus" },
      },
    },
    speaking: {
      entry: assign({ status: "speaking" }),
      on: {
        AUDIO_PLAYBACK_END: {
          target: "connected.idle",
          actions: assign({ isPlaying: false }),
        },
        SERVER_STATE_CHANGE: { actions: "updateServerStatus" },
      },
    },
    error: {
      on: {
        CONNECT: { target: "connecting", actions: "setStatusConfig" },
        START_LISTENING: { target: "listening", actions: "clearError" },
      },
    },
  },
});
