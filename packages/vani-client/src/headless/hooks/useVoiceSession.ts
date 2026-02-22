import { useEffect, useRef, useCallback } from 'react';
import { useMicVAD } from '@ricky0123/vad-react';
import * as ort from 'onnxruntime-web';
import { useActor } from '@xstate/react';
import { clientMachine, type ClientContext, type DebugEvent } from '../machine/clientMachine';
import type { ClientMessage, VoiceConfig, VoiceStatus } from '../../shared/types/voice';
import type { ServerToClientJson } from '../../shared/contracts/ws';
import { buildVoiceWebSocketUrl } from '../utils/webSocketUrl';
export type { VoiceStatus, ClientMessage as Message, DebugEvent, VoiceConfig };

// --- Constants ---
const ONNX_WASM_BASE_PATH = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/';
const VAD_BASE_ASSET_PATH = 'https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.29/dist/';
const VAD_MODEL_URL = 'https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.29/dist/silero_vad_v5.onnx';

// Set WASM paths for ONNX Runtime
let ortConfigured = false;
function ensureOrtConfig() {
    if (ortConfigured) return;
    if (typeof window !== 'undefined') {
        ort.env.wasm.wasmPaths = ONNX_WASM_BASE_PATH;
        // Disable proxy to avoid dynamic import of worker scripts which Vite tries to optimize
        ort.env.wasm.proxy = false;
        // Avoid SIMD if it's causing issues, though usually SIMD is better
        // ort.env.wasm.simd = false; 
    }
    ortConfigured = true;
}

// --- Types ---
// Re-export types from machine if needed, or use them directly in UI




// --- Hook ---

export interface UseVoiceSessionProps {
    onError?: (error: string) => void;
    onMessage?: (msg: { role: 'user' | 'assistant'; content: string }) => void;
    onFeedback?: (message: string) => void;
    initialTranscript?: ClientMessage[];
    config?: VoiceConfig;
    /**
     * Base server URL used to construct the websocket URL.
     * Examples:
     * - "https://example.com"
     * - "wss://example.com"
     *
     * Default: "https://shvm.in"
     */
    serverUrl?: string;
    /**
     * Full override for websocket URL construction. Takes precedence over `serverUrl`.
     */
    getWebSocketUrl?: (sessionId: string) => string;
    /**
     * Override session id for the websocket route (e.g. `/ws/:sessionId`).
     * If omitted, a random one is generated once per hook instance.
     */
    sessionId?: string;
    /**
     * Customizes the websocket path appended to the server base URL.
     * Default: `/ws/${sessionId}`
     */
    wsPath?: (sessionId: string) => string;
    /**
     * Client-side tool handlers to be executed by the LLM
     */
    clientTools?: Record<string, (args: any) => Promise<any>>;
}

const VAD_SAMPLE_RATE = 16000;

function writeString(view: DataView, offset: number, text: string) {
    for (let i = 0; i < text.length; i += 1) {
        view.setUint8(offset + i, text.charCodeAt(i));
    }
}

function encodeWav(audio: Float32Array, sampleRate: number) {
    const buffer = new ArrayBuffer(44 + audio.length * 2);
    const view = new DataView(buffer);

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + audio.length * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, audio.length * 2, true);

    let offset = 44;
    for (let i = 0; i < audio.length; i += 1) {
        const sample = Math.max(-1, Math.min(1, audio[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        offset += 2;
    }

    return buffer;
}

export function useVoiceSession(props: UseVoiceSessionProps = {}) {
    const {
        onError,
        onMessage,
        onFeedback,
        initialTranscript,
        config,
        serverUrl,
        getWebSocketUrl: getWebSocketUrlOverride,
        sessionId,
        wsPath,
        clientTools
    } = props;

    // Initialize ORT config lazily
    ensureOrtConfig();

    // 1. Initialize Machine
    const [snapshot, send, actorRef] = useActor(clientMachine);
    const state = snapshot.context as ClientContext;

    // Refs for callbacks/non-state logic
    const wsRef = useRef<WebSocket | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioQueueRef = useRef<ArrayBuffer[]>([]);
    const isPlaybackLoopRunning = useRef(false);
    const onErrorCallbackRef = useRef(onError);
    const onMessageCallbackRef = useRef(onMessage);
    const onFeedbackCallbackRef = useRef(onFeedback);
    const configRef = useRef(config);
    const clientToolsRef = useRef(clientTools);
    const turnActiveRef = useRef(false);
    const lastVADErrorRef = useRef<string | null>(null);
    const hasSeededTranscriptRef = useRef(false);
    const sessionIdRef = useRef<string | null>(null);

    if (sessionIdRef.current === null) {
        sessionIdRef.current =
            sessionId ??
            (typeof crypto !== 'undefined' && 'randomUUID' in crypto
                ? // @ts-ignore
                crypto.randomUUID()
                : "session-" + Math.floor(Math.random() * 10000));
    }

    const buildWebSocketUrl = useCallback((activeSessionId: string) => {
        return buildVoiceWebSocketUrl({
            sessionId: activeSessionId,
            serverUrl,
            wsPath,
            getWebSocketUrlOverride,
        });
    }, [getWebSocketUrlOverride, serverUrl, wsPath]);

    // Sync refs
    useEffect(() => {
        onErrorCallbackRef.current = onError;
        onMessageCallbackRef.current = onMessage;
        onFeedbackCallbackRef.current = onFeedback;
        configRef.current = config;
        clientToolsRef.current = clientTools;
    }, [onError, onMessage, onFeedback, config, clientTools]);

    // Seed initial transcript once, if provided and machine is empty.
    useEffect(() => {
        if (hasSeededTranscriptRef.current) return;
        if (!initialTranscript || initialTranscript.length === 0) return;
        if (actorRef.getSnapshot().context.transcript.length > 0) {
            hasSeededTranscriptRef.current = true;
            return;
        }

        initialTranscript.forEach((msg) => {
            send({ type: 'ADD_MESSAGE', role: msg.role as any, content: msg.content });
        });

        hasSeededTranscriptRef.current = true;
    }, [actorRef, initialTranscript, send]);

    // ... (rest of hook)



    const initAudio = async () => {
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            if (audioContextRef.current.state === 'suspended') {
                await audioContextRef.current.resume();
            }
            return;
        }
        try {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            if (audioContextRef.current.state === 'suspended') {
                await audioContextRef.current.resume();
            }
        } catch (e: any) {
            console.error('[Voice] Audio init error:', e);
            const msg = 'Audio initialization failed: ' + e.message;
            console.error('[Voice] Sending SET_ERROR (Audio Init)', msg);
            send({ type: 'SET_ERROR', error: msg });
            // onError callback handled by effect
            throw e;
        }
    };

    const handleSpeechStart = useCallback(() => {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        if (turnActiveRef.current) return;

        // Use actorRef to get latest context synchronously in callback
        const currentContext = actorRef.getSnapshot().context;
        const status = currentContext.status;
        const error = currentContext.error;

        // On error, try to reset or recover.
        if (error) {
            // Optional reset logic
        }

        // No interruption handling. Turn-by-turn only.
        if (status === 'speaking' || status === 'processing') {
            console.log("[Voice] Busy, rejecting speech input (strict turn-by-turn).");
            return;
        }

        if (currentContext.isMuted) {
            console.log("[Voice] Muted, rejecting speech input.");
            return;
        }

        if (status !== 'idle' && status !== 'listening' && status !== 'error') return;

        turnActiveRef.current = true;

        // Send start with config
        ws.send(JSON.stringify({
            type: 'start',
            config: configRef.current
        }));

        send({ type: 'START_LISTENING' });
    }, [actorRef, send]);

    const sendMessage = useCallback((text: string) => {
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'text.message', content: text }));
            send({ type: 'ADD_MESSAGE', role: 'user', content: text });
            send({ type: 'SERVER_STATE_CHANGE', status: 'speaking' }); // Assume server will process
        }
    }, [send]);

    const handleSpeechEnd = useCallback(async (audio: Float32Array) => {
        const ws = wsRef.current;
        if (!turnActiveRef.current) return;
        turnActiveRef.current = false;

        if (!ws || ws.readyState !== WebSocket.OPEN) {
            send({ type: 'SERVER_STATE_CHANGE', status: 'idle' });
            return;
        }

        // VAD sample rate is 16k
        const wavBuffer = encodeWav(audio, VAD_SAMPLE_RATE);
        const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });

        ws.send(wavBuffer);
        send({ type: 'LOG_EVENT', eventType: 'audio_input', details: { size: wavBuffer.byteLength }, blob: wavBlob });
        ws.send(JSON.stringify({ type: 'stop' }));
        send({ type: 'STOP_LISTENING' });
    }, [send]);



    const handleVADMisfire = useCallback(() => {
        if (!turnActiveRef.current) return;
        turnActiveRef.current = false;
        // Reset via server state simulation or dedicated event? 
        // Logic was dispatch({ type: 'SERVER_STATE_CHANGE', status: 'idle' });
        // Keeping it consistent:
        send({ type: 'SERVER_STATE_CHANGE', status: 'idle' });
    }, [send]);

    const vad = useMicVAD({
        startOnLoad: false,
        onSpeechStart: handleSpeechStart,
        onSpeechEnd: handleSpeechEnd,
        onVADMisfire: handleVADMisfire,
        // @ts-expect-error
        workletURL: VAD_BASE_ASSET_PATH + 'vad.worklet.bundle.min.js',
        modelURL: VAD_MODEL_URL,
        onnxWASMBasePath: ONNX_WASM_BASE_PATH,
        baseAssetPath: VAD_BASE_ASSET_PATH,
    });

    useEffect(() => {
        if (!vad.errored) return;
        const message = typeof vad.errored === 'string'
            ? vad.errored
            // @ts-expect-error
            : vad.errored.message || 'VAD failed to load';
        if (lastVADErrorRef.current === message) return;
        lastVADErrorRef.current = message;
        console.error('[Voice] Sending SET_ERROR (VAD)', message);
        send({ type: 'SET_ERROR', error: message });
    }, [vad.errored, send]);

    useEffect(() => {
        const shouldListen = !state.isMuted && (state.status === 'idle' || state.status === 'listening');
        if (shouldListen && !vad.listening && !vad.loading && !vad.errored) {
            vad.start();
        } else if (!shouldListen && vad.listening) {
            vad.pause();
        }
    }, [state.status, state.isMuted, vad.listening, vad.loading, vad.errored, vad.start, vad.pause]);

    const connect = useCallback(() => {
        if (wsRef.current) wsRef.current.close();

        // Initialize AudioContext immediately to capture user gesture
        initAudio().catch(err => console.warn('[Voice] Early audio init failed', err));

        console.log('[Voice] Connect called');
        send({ type: 'CONNECT' });

        const sessionId = sessionIdRef.current || "session-" + Math.floor(Math.random() * 10000);
        const url = buildWebSocketUrl(sessionId);

        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
            send({ type: 'CONNECTED' });
            initAudio().catch(() => { });
        };

        ws.onmessage = async (event) => {
            if (event.data instanceof Blob) {
                const buf = await event.data.arrayBuffer();
                send({ type: 'LOG_EVENT', eventType: 'audio_output', details: { size: buf.byteLength }, blob: event.data });
                queueAudio(buf);
                return;
            }

            try {
                const data = JSON.parse(event.data) as ServerToClientJson;
                handleMessage(data);
            } catch (e) {
                console.error('[Voice] Parse error', e);
            }
        };

        ws.onclose = (e) => {
            console.log('[Voice] Closed', e.code);
            send({ type: 'DISCONNECT' }); // Use DISCONNECT event
        };

        ws.onerror = (e) => {
            console.error('[Voice] WS Error', e);
            send({ type: 'SET_ERROR', error: 'Connection failed: ' + (e instanceof ErrorEvent ? e.message : 'Unknown') });
        };
    }, [buildWebSocketUrl, send]);

    const handleMessage = async (data: ServerToClientJson) => {
        // send({ type: 'LOG_EVENT', eventType: 'socket_event', details: data });
        switch (data.type) {
            case 'state':
                send({ type: 'SERVER_STATE_CHANGE', status: data.value });
                break;
            case 'transcript.final':
                send({ type: 'ADD_MESSAGE', role: 'user', content: data.text });
                onMessageCallbackRef.current?.({ role: 'user', content: data.text });
                break;
            case 'assistant.message':
                send({ type: 'ADD_MESSAGE', role: 'assistant', content: data.message.content });
                onMessageCallbackRef.current?.({ role: 'assistant', content: data.message.content });
                break;
            case 'assistant.partial':
                // Optional: Stream text token by token if needed
                break;
            case 'error':
                console.error('[Voice] Sending SET_ERROR (Server)', data.reason);
                send({ type: 'SET_ERROR', error: data.reason });
                break;
            case 'feedback':
                onFeedbackCallbackRef.current?.(data.message);
                break;
            case 'tool.call.start':
                send({ type: 'TOOL_CALL_START', toolName: data.toolName });
                break;
            case 'tool.call.end':
                send({ type: 'TOOL_CALL_END', toolName: data.toolName });
                break;
            case 'tool.execute.request':
                if (clientToolsRef.current && clientToolsRef.current[data.toolName]) {
                    try {
                        const result = await clientToolsRef.current[data.toolName](data.parameters);
                        wsRef.current?.send(JSON.stringify({ type: 'tool.execute.response', callId: data.callId, result }));
                    } catch (err: any) {
                        wsRef.current?.send(JSON.stringify({ type: 'tool.execute.error', callId: data.callId, error: err.message || String(err) }));
                    }
                } else {
                    wsRef.current?.send(JSON.stringify({ type: 'tool.execute.error', callId: data.callId, error: `Tool ${data.toolName} not found on client` }));
                }
                break;
        }
    };
    const queueAudio = (buffer: ArrayBuffer) => {
        audioQueueRef.current.push(buffer);
        if (!isPlaybackLoopRunning.current) {
            playQueue();
        }
    };

    const playQueue = async () => {
        isPlaybackLoopRunning.current = true;

        while (audioQueueRef.current.length > 0) {
            send({ type: 'AUDIO_PLAYBACK_START' });

            const buffer = audioQueueRef.current.shift();
            if (!buffer) continue;

            try {
                const ctx = audioContextRef.current!;
                // Clone buffer for decoding
                const decoded = await ctx.decodeAudioData(buffer.slice(0));

                await new Promise<void>((resolve) => {
                    const source = ctx.createBufferSource();
                    source.buffer = decoded;
                    source.connect(ctx.destination);
                    source.onended = () => resolve();
                    source.start(0);
                });

            } catch (e) {
                console.warn('[Voice] Decode failed, trying fallback', e);
                // Fallback
                try {
                    const blob = new Blob([buffer], { type: 'audio/wav' }); // wav/mp3/etc
                    const url = URL.createObjectURL(blob);
                    const audio = new Audio(url);
                    await new Promise<void>((resolve, reject) => {
                        audio.onended = () => {
                            URL.revokeObjectURL(url);
                            resolve();
                        };
                        audio.onerror = reject;
                        audio.play().catch(reject);
                    });
                } catch (err) {
                    console.error('[Voice] Playback failed completely', err);
                }
            }
        }

        send({ type: 'AUDIO_PLAYBACK_END' });
        isPlaybackLoopRunning.current = false;
    };

    const disconnect = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        send({ type: 'DISCONNECT' });
    }, [send]);

    const cancel = useCallback(() => {
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'reset' }));
        }
        send({ type: 'CANCEL' });
    }, [send]);

    const toggleMute = useCallback(() => {
        send({ type: 'TOGGLE_MUTE' });
    }, [send]);

    return {
        ...state,
        vadListening: vad.listening,
        vadLoading: vad.loading,
        vadErrored: vad.errored,
        userSpeaking: vad.userSpeaking,
        connect,
        disconnect,
        sendMessage,
        cancel,
        toggleMute
    };
}
