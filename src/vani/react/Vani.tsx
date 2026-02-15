
import { useState } from 'react';
import { useVoiceSession } from './useVoiceSession';
import { FullScreenMode } from './modes/FullScreenMode';
import { PipMode } from './modes/PipMode';
import { type Message } from '../machine';

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
    initialTranscript?: Message[];
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
}

export function Vani({
    onError,
    onMessage,
    initialTranscript,
    defaultMode = 'full',
    mode: controlledMode,
    onModeChange
}: VaniProps) {
    const [internalMode, setInternalMode] = useState<'full' | 'pip'>(defaultMode);

    // Derived mode: if controlledMode is provided use it, otherwise internal state
    const currentMode = controlledMode ?? internalMode;

    const session = useVoiceSession({ onError, onMessage, initialTranscript });

    const handleToggleMode = () => {
        const newMode = currentMode === 'full' ? 'pip' : 'full';
        if (controlledMode === undefined) {
            setInternalMode(newMode);
        }
        onModeChange?.(newMode);
    };

    if (currentMode === 'pip') {
        return <PipMode {...session} onTogglePip={handleToggleMode} />;
    }

    return <FullScreenMode {...session} onTogglePip={handleToggleMode} />;
}
