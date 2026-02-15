import { setup, assign, fromCallback } from "xstate";

// --- Actors (Placeholders for future integration) ---

export const socketActor = fromCallback(() => {
    // This actor will manage the WebSocket connection
    // receive((event) => { ... })
    // sendBack({ type: 'CONNECTED' })
    return () => {
        // cleanup
    };
});

export const audioActor = fromCallback(() => {
    // This actor will manage the AudioContext and Queue
    return () => { };
});


// --- Types ---

export type VoiceStatus =
    | "disconnected"
    | "connecting"
    | "idle"        // Connected, waiting
    | "listening"   // Mic is open, recording
    | "processing"  // Server is thinking (STT or LLM generation before audio)
    | "speaking"    // Client is playing audio
    | "error";

export interface Message {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: number;
}

export interface DebugEvent {
    id: string;
    type: "state_change" | "socket_event" | "audio_input" | "audio_output" | "transcript" | "llm_token" | "error";
    timestamp: number;
    details: any;
    blobUrl?: string;
}

export interface ClientContext {
    status: VoiceStatus; // Derived/synced with state
    serverStatus: string;
    transcript: Message[];
    history: DebugEvent[];
    error: string | null;
    isPlaying: boolean;
}

// --- Events ---

export type ClientEvent =
    | { type: 'CONNECT' }
    | { type: 'DISCONNECT' }
    | { type: 'CONNECTED' }
    | { type: 'SET_ERROR'; error: string }
    | { type: 'SERVER_STATE_CHANGE'; status: string } // 'idle' | 'listening' | 'thinking' | 'speaking'
    | { type: 'START_LISTENING' }
    | { type: 'STOP_LISTENING' }
    | { type: 'ADD_MESSAGE'; role: Message['role']; content: string }
    | { type: 'AUDIO_PLAYBACK_START' }
    | { type: 'AUDIO_PLAYBACK_END' }
    | { type: 'LOG_EVENT'; eventType: DebugEvent['type']; details: any; blob?: Blob }
    | { type: 'TIMEOUT' };


// --- Machine ---

export const clientMachine = setup({
    types: {
        context: {} as ClientContext,
        events: {} as ClientEvent,
    },
    actions: {
        setStatusConfig: assign({
            status: () => 'connecting'
        }),
        setConnected: assign({
            status: () => 'idle',
            history: ({ context }) => [...context.history, {
                id: Math.random().toString(36).slice(2),
                type: 'socket_event' as const,
                timestamp: Date.now(),
                details: { status: 'connected' }
            }]
        }),
        setDisconnected: assign({
            status: () => 'disconnected',
            history: ({ context }) => [...context.history, {
                id: Math.random().toString(36).slice(2),
                type: 'socket_event' as const,
                timestamp: Date.now(),
                details: { status: 'disconnected' }
            }]
        }),
        setError: assign({
            status: () => 'error',
            error: ({ event }) => (event.type === 'SET_ERROR' ? event.error : null),
            history: ({ context, event }) => [...context.history, {
                id: Math.random().toString(36).slice(2),
                type: 'error' as const,
                timestamp: Date.now(),
                details: { message: (event as any).error }
            }]
        }),
        updateServerStatus: assign({
            serverStatus: ({ event }) => (event.type === 'SERVER_STATE_CHANGE' ? event.status : 'idle'),
            history: ({ context, event }) => {
                if (event.type !== 'SERVER_STATE_CHANGE') return context.history;
                return [...context.history, {
                    id: Math.random().toString(36).slice(2),
                    type: 'state_change' as const,
                    timestamp: Date.now(),
                    details: { from: context.serverStatus, to: event.status, source: 'server' }
                }];
            }
        }),
        setPlaying: assign({
            isPlaying: ({ event }) => event.type === 'AUDIO_PLAYBACK_START'
        }),
        addMessage: assign({
            transcript: ({ context, event }) => {
                if (event.type !== 'ADD_MESSAGE') return context.transcript;
                return [...context.transcript, {
                    id: Math.random().toString(36).slice(2),
                    role: event.role,
                    content: event.content,
                    timestamp: Date.now()
                }];
            },
            history: ({ context, event }) => {
                if (event.type !== 'ADD_MESSAGE') return context.history;
                return [...context.history, {
                    id: Math.random().toString(36).slice(2),
                    type: 'transcript' as const,
                    timestamp: Date.now(),
                    details: { role: event.role, text: event.content }
                }];
            }
        }),
        logEvent: assign({
            history: ({ context, event }) => {
                if (event.type !== 'LOG_EVENT') return context.history;
                return [...context.history, {
                    id: Math.random().toString(36).slice(2),
                    type: event.eventType,
                    timestamp: Date.now(),
                    details: event.details,
                    blobUrl: event.blob ? URL.createObjectURL(event.blob) : undefined
                }];
            }
        })
    },
    guards: {
        isServerThinkingOrSpeaking: ({ context, event }) => {
            const status = event.type === 'SERVER_STATE_CHANGE' ? event.status : context.serverStatus;
            return status === 'thinking' || status === 'speaking';
        }
    }
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
        LOG_EVENT: { actions: 'logEvent' },
        ADD_MESSAGE: { actions: 'addMessage' },
        SET_ERROR: { target: '.error', actions: 'setError' },
        DISCONNECT: { target: '.disconnected', actions: 'setDisconnected' }
    },
    states: {
        disconnected: {
            on: {
                CONNECT: { target: 'connecting', actions: 'setStatusConfig' }
            }
        },
        connecting: {
            on: {
                CONNECTED: { target: 'connected', actions: 'setConnected' },
                // If connection fails, we might get SET_ERROR which is handled globally to go to error state
            }
        },
        connected: {
            initial: 'idle',
            states: {
                idle: {
                    entry: assign({ status: 'idle' }),
                    on: {
                        START_LISTENING: { target: '#client.listening' },
                        AUDIO_PLAYBACK_START: { target: '#client.speaking', actions: 'setPlaying' },
                        SERVER_STATE_CHANGE: [
                            {
                                guard: 'isServerThinkingOrSpeaking',
                                target: 'processing',
                                actions: 'updateServerStatus'
                            },
                            {
                                actions: 'updateServerStatus' // Update but stay idle
                            }
                        ]
                    }
                },
                processing: {
                    entry: assign({ status: 'processing' }),
                    // Watchdog
                    after: {
                        60000: { target: 'idle', actions: assign({ error: 'Server timed out' }) } // Simplified watchdog
                    },
                    on: {
                        START_LISTENING: { target: '#client.listening' },
                        AUDIO_PLAYBACK_START: { target: '#client.speaking', actions: 'setPlaying' },
                        SERVER_STATE_CHANGE: [
                            {
                                guard: ({ event }) => event.status === 'listening' || event.status === 'idle',
                                target: 'idle',
                                actions: 'updateServerStatus'
                            },
                            {
                                actions: 'updateServerStatus' // Update but stay processing (e.g. thinking -> speaking)
                            }
                        ]

                    }
                }
            }
        },
        listening: {
            entry: assign({ status: 'listening' }),
            on: {
                STOP_LISTENING: { target: 'connected.processing' },
                // While listening, we ignore server state changes regarding navigation, but we might record them?
                // `useVoiceSession` updates `serverStatus` but ignores `nextStatus` change.
                SERVER_STATE_CHANGE: { actions: 'updateServerStatus' }
            }
        },
        speaking: {
            entry: assign({ status: 'speaking' }),
            on: {
                AUDIO_PLAYBACK_END: {
                    target: 'connected.idle', // Default to idle, let server update push to processing if needed?
                    actions: assign({ isPlaying: false })
                },
                // While speaking, we update server status but usually stay speaking until audio ends
                SERVER_STATE_CHANGE: { actions: 'updateServerStatus' }
            }
        },
        error: {
            on: {
                CONNECT: { target: 'connecting', actions: 'setStatusConfig' },
                // Allow recovering
            }
        }
    }
});
