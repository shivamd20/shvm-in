
import { VoiceStatus, Message, DebugEvent } from '../machine';

export interface VaniViewProps {
    status: VoiceStatus;
    transcript: Message[];
    history: DebugEvent[];
    error: string | null;
    connect: () => void;
    cancel: () => void;
    vadLoading: boolean;
    onTogglePip?: () => void;
}
