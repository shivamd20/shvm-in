import type { DebugEvent } from '@shvm/vani-client/headless';
import type { ClientMessage, VoiceConfig, VoiceStatus } from '@shvm/vani-client/shared';

export interface VaniViewProps {
    status: VoiceStatus;
    transcript: ClientMessage[];
    history: DebugEvent[];
    error: string | null;
    connect: () => void;
    cancel: () => void;
    vadLoading: boolean;
    onTogglePip?: () => void;
    config?: VoiceConfig;
    setConfig?: (config: VoiceConfig) => void;
    feedback?: string | null;
}
