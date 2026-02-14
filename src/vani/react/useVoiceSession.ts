import { useReducer, useEffect, useRef, useCallback } from 'react';

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
    blobUrl?: string; // For audio events
}

interface VoiceState {
    status: VoiceStatus;
    serverStatus: string; // The raw status reported by the server
    transcript: Message[];
    history: DebugEvent[];
    error: string | null;
    isPlaying: boolean; // Is audio currently playing?
}

type VoiceAction =
    | { type: 'CONNECTING' }
    | { type: 'CONNECTED' }
    | { type: 'DISCONNECTED' }
    | { type: 'SET_ERROR'; error: string }
    | { type: 'SERVER_STATE_CHANGE'; status: string }
    | { type: 'START_LISTENING' }
    | { type: 'STOP_LISTENING' }
    | { type: 'ADD_MESSAGE'; role: Message['role']; content: string }
    | { type: 'APPEND_LLM_TOKEN'; token: string }
    | { type: 'AUDIO_PLAYBACK_START' }
    | { type: 'AUDIO_PLAYBACK_END' }
    | { type: 'LOG_EVENT'; eventType: DebugEvent['type']; details: any; blob?: Blob };

const initialState: VoiceState = {
    status: 'disconnected',
    serverStatus: 'idle',
    transcript: [],
    history: [],
    error: null,
    isPlaying: false,
};

// --- Reducer ---

function voiceReducer(state: VoiceState, action: VoiceAction): VoiceState {
    const timestamp = Date.now();
    const eventId = Math.random().toString(36).slice(2, 9);

    // Helpers to create log entries
    const createLog = (eventType: DebugEvent['type'], details: any, blob?: Blob): DebugEvent => ({
        id: eventId,
        type: eventType,
        timestamp,
        details,
        blobUrl: blob ? URL.createObjectURL(blob) : undefined
    });

    switch (action.type) {
        case 'CONNECTING':
            return {
                ...state,
                status: 'connecting',
                error: null,
                history: [...state.history, createLog('socket_event', { status: 'connecting' })]
            };
        case 'CONNECTED':
            return {
                ...state,
                status: 'idle',
                error: null,
                history: [...state.history, createLog('socket_event', { status: 'connected' })]
            };
        case 'DISCONNECTED':
            return {
                ...state,
                status: 'disconnected',
                history: [...state.history, createLog('socket_event', { status: 'disconnected' })]
            };
        case 'SET_ERROR':
            return {
                ...state,
                status: 'error',
                error: action.error,
                history: [...state.history, createLog('error', { message: action.error })]
            };
        case 'SERVER_STATE_CHANGE': {
            // Determine combined status
            // If server is "speaking", it just means it's sending audio.
            // We only show "speaking" in UI when we actually PLAY audio.
            // If server is "thinking", we show processing.
            // If server is "listening", we default to idle (unless user is actually holding space).

            let nextStatus = state.status;

            // If we are currently listening (local override), ignore server "listening"
            if (state.status === 'listening' && action.status === 'listening') {
                nextStatus = 'listening';
            } else if (state.isPlaying) {
                nextStatus = 'speaking';
            } else if (action.status === 'thinking' || action.status === 'speaking') {
                nextStatus = 'processing';
            } else if (action.status === 'listening' || action.status === 'idle') {
                nextStatus = 'idle';
            }

            return {
                ...state,
                serverStatus: action.status,
                status: nextStatus,
                history: [...state.history, createLog('state_change', { from: state.serverStatus, to: action.status, source: 'server' })]
            };
        }
        case 'START_LISTENING':
            return {
                ...state,
                status: 'listening',
                history: [...state.history, createLog('state_change', { to: 'listening', source: 'user_action' })]
            };
        case 'STOP_LISTENING':
            return {
                ...state,
                status: 'processing', // Assume we go to processing after stop
                history: [...state.history, createLog('state_change', { to: 'processing', source: 'user_action' })]
            };
        case 'ADD_MESSAGE':
            return {
                ...state,
                transcript: [...state.transcript, {
                    id: eventId,
                    role: action.role,
                    content: action.content,
                    timestamp
                }],
                history: [...state.history, createLog('transcript', { role: action.role, text: action.content })]
            };
        case 'AUDIO_PLAYBACK_START':
            return {
                ...state,
                isPlaying: true,
                status: 'speaking',
                history: [...state.history, createLog('state_change', { to: 'speaking', source: 'audio_player' })]
            };
        case 'AUDIO_PLAYBACK_END':
            // When playback ends, fallback to idle (or processing if server is still doing something?)
            // Usually we go to idle.
            return {
                ...state,
                isPlaying: false,
                status: 'idle',
                history: [...state.history, createLog('state_change', { to: 'idle', source: 'audio_player' })]
            };
        case 'LOG_EVENT':
            return {
                ...state,
                history: [...state.history, createLog(action.eventType, action.details, action.blob)]
            };
        default:
            return state;
    }
}

// --- Hook ---

interface UseVoiceSessionProps {
    onError?: (error: string) => void;
}

export function useVoiceSession({ onError }: UseVoiceSessionProps = {}) {
    const [state, dispatch] = useReducer(voiceReducer, initialState);

    // Refs for callbacks/non-state logic
    const wsRef = useRef<WebSocket | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const audioQueueRef = useRef<ArrayBuffer[]>([]);
    const isPlaybackLoopRunning = useRef(false);
    const sentChunksRef = useRef<Blob[]>([]);
    const onErrorCallbackRef = useRef(onError);
    const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        onErrorCallbackRef.current = onError;
    }, [onError]);

    // Watchdog for processing state
    useEffect(() => {
        if (state.status === 'processing') {
            processingTimeoutRef.current = setTimeout(() => {
                console.warn('[Voice] Processing timeout - resetting to idle');
                dispatch({ type: 'SET_ERROR', error: 'Server timed out' });
                dispatch({ type: 'SERVER_STATE_CHANGE', status: 'idle' }); // Force reset
            }, 60000); // 60s timeout
        } else {
            if (processingTimeoutRef.current) {
                clearTimeout(processingTimeoutRef.current);
                processingTimeoutRef.current = null;
            }
        }
        return () => {
            if (processingTimeoutRef.current) clearTimeout(processingTimeoutRef.current);
        };
    }, [state.status]);


    // Cleanup
    useEffect(() => {
        return () => {
            wsRef.current?.close();
            audioContextRef.current?.close();
            mediaStreamRef.current?.getTracks().forEach(t => t.stop());
            // Revoke object URLs in history to avoid leaks? (Ideally, but complicated in reducer)
        };
    }, []);

    const initAudio = async () => {
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') return;
        try {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (e: any) {
            console.error('[Voice] Audio init error:', e);
            const msg = 'Microphone access denied: ' + e.message;
            dispatch({ type: 'SET_ERROR', error: msg });
            onErrorCallbackRef.current?.(msg);
            throw e;
        }
    };

    const connect = useCallback(() => {
        if (wsRef.current) wsRef.current.close();

        dispatch({ type: 'CONNECTING' });

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const sessionId = "session-" + Math.floor(Math.random() * 10000);
        const url = `${protocol}//${host}/ws/${sessionId}`;

        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
            dispatch({ type: 'CONNECTED' });
            initAudio().catch(() => { });
        };

        ws.onmessage = async (event) => {
            if (event.data instanceof Blob) {
                const buf = await event.data.arrayBuffer();
                dispatch({ type: 'LOG_EVENT', eventType: 'audio_output', details: { size: buf.byteLength }, blob: event.data });
                queueAudio(buf);
                return;
            }

            try {
                const data = JSON.parse(event.data);
                handleMessage(data);
            } catch (e) {
                console.error('[Voice] Parse error', e);
            }
        };

        ws.onclose = (e) => {
            console.log('[Voice] Closed', e.code);
            dispatch({ type: 'DISCONNECTED' });
        };

        ws.onerror = (e) => {
            console.error('[Voice] WS Error', e);
            dispatch({ type: 'SET_ERROR', error: 'Connection failed' });
        };
    }, []);

    const handleMessage = (data: any) => {
        // dispatch({ type: 'LOG_EVENT', eventType: 'socket_event', details: data });
        switch (data.type) {
            case 'state':
                dispatch({ type: 'SERVER_STATE_CHANGE', status: data.value });
                break;
            case 'transcript.final':
                dispatch({ type: 'ADD_MESSAGE', role: 'user', content: data.text });
                break;
            case 'assistant.message':
                dispatch({ type: 'ADD_MESSAGE', role: 'assistant', content: data.message.content });
                break;
            case 'assistant.partial':
                // Optional: Stream text token by token if needed
                break;
            case 'error':
                dispatch({ type: 'SET_ERROR', error: data.reason });
                break;
        }
    };

    const startRecording = useCallback(async () => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

        // Only allow start if we are allowed (idle/listening/speaking shouldn't block per se, but logic...)
        // We enforce PTT.
        await initAudio();
        if (audioContextRef.current?.state === 'suspended') await audioContextRef.current.resume();

        sentChunksRef.current = [];
        wsRef.current.send(JSON.stringify({ type: 'start' }));

        const stream = mediaStreamRef.current;
        if (!stream) return;

        const options = { mimeType: 'audio/webm' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            // @ts-ignore
            delete options.mimeType;
        }

        const recorder = new MediaRecorder(stream, options);
        recorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                sentChunksRef.current.push(e.data);
            }
        };

        recorder.onstop = async () => {
            const ws = wsRef.current;
            if (sentChunksRef.current.length > 0 && ws && ws.readyState === WebSocket.OPEN) {
                const fullBlob = new Blob(sentChunksRef.current, { type: 'audio/webm' });
                const buffer = await fullBlob.arrayBuffer();
                ws.send(buffer);
                dispatch({ type: 'LOG_EVENT', eventType: 'audio_input', details: { size: buffer.byteLength }, blob: fullBlob });
                // We assume server will ack with 'thinking' soon. If not, watchdog will catch it.
            } else if (!ws || ws.readyState !== WebSocket.OPEN) {
                console.warn('[Voice] Socket closed before sending audio');
                dispatch({ type: 'SERVER_STATE_CHANGE', status: 'idle' });
            }

            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'stop' }));
                dispatch({ type: 'STOP_LISTENING' }); // Enter processing state
            }
        };

        recorder.start(100);
        dispatch({ type: 'START_LISTENING' });

    }, []);

    const stopRecording = useCallback(() => {
        if (recorderRef.current && recorderRef.current.state !== 'inactive') {
            recorderRef.current.stop();
            dispatch({ type: 'STOP_LISTENING' });
        }
    }, []);

    const queueAudio = (buffer: ArrayBuffer) => {
        audioQueueRef.current.push(buffer);
        if (!isPlaybackLoopRunning.current) {
            playQueue();
        }
    };

    const playQueue = async () => {
        isPlaybackLoopRunning.current = true;

        while (audioQueueRef.current.length > 0) {
            dispatch({ type: 'AUDIO_PLAYBACK_START' });

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

        dispatch({ type: 'AUDIO_PLAYBACK_END' });
        isPlaybackLoopRunning.current = false;
    };

    const disconnect = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        dispatch({ type: 'DISCONNECTED' });
    }, []);

    return {
        ...state,
        connect,
        disconnect,
        startRecording,
        stopRecording
    };
}
