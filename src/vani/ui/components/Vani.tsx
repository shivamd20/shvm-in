import { useState } from 'react';
import { useVoiceSession } from '@shvm/vani-client/headless';
import { FullScreenMode } from '@vani/ui/modes/FullScreenMode';
import { PipMode } from '@vani/ui/modes/PipMode';
import type { ClientMessage, VoiceConfig } from '@shvm/vani-client/shared';

export interface VaniProps {
    /**
     * Optional callback for errors
     */
    onError?: (error: string) => void;
    /**
     * Callback for new messages
     */
    onMessage?: (msg: { role: 'user' | 'assistant'; content: string }) => void;
    /**
     * Initial transcript to seed the session
     */
    initialTranscript?: ClientMessage[];
    /**
     * Initial display mode. Defaults to 'full'.
     */
    defaultMode?: 'full' | 'pip';
    /**
     * Optional controlled mode.
     */
    mode?: 'full' | 'pip';
    /**
     * Callback when mode changes (e.g. user minimizes/maximizes)
     */
    onModeChange?: (mode: 'full' | 'pip') => void;
    /**
     * Initial config
     */
    initialConfig?: VoiceConfig;
}

export function Vani({
    onError,
    onMessage,
    initialTranscript,
    defaultMode = 'full',
    mode: controlledMode,
    onModeChange,
    initialConfig
}: VaniProps) {
    const [internalMode, setInternalMode] = useState<'full' | 'pip'>(defaultMode);
    const [config, setConfig] = useState<VoiceConfig>(initialConfig || {
        sttModel: '@cf/openai/whisper-tiny-en',
        llmModel: '@cf/meta/llama-3.1-8b-instruct',
        tts: { model: '@cf/deepgram/aura-2-en', speaker: 'luna' }
    });
    const [feedback, setFeedback] = useState<string | null>(null);

    // Derived mode: if controlledMode is provided use it, otherwise internal state
    const currentMode = controlledMode ?? internalMode;

    const handleFeedback = (message: string) => {
        setFeedback(message);
        setTimeout(() => setFeedback(null), 3000);
    };

    const session = useVoiceSession({ onError, onMessage, initialTranscript, config, onFeedback: handleFeedback });

    const handleToggleMode = () => {
        const newMode = currentMode === 'full' ? 'pip' : 'full';
        if (controlledMode === undefined) {
            setInternalMode(newMode);
        }
        onModeChange?.(newMode);
    };

    if (currentMode === 'pip') {
        return <PipMode {...session} onTogglePip={handleToggleMode} config={config} setConfig={setConfig} feedback={feedback} />;
    }

    return <FullScreenMode {...session} onTogglePip={handleToggleMode} config={config} setConfig={setConfig} feedback={feedback} />;
}
