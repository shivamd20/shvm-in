
import { VoiceStatus, Message, DebugEvent, VoiceConfig } from '../machine';

export interface VaniViewProps {
    status: VoiceStatus;
    transcript: Message[];
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
