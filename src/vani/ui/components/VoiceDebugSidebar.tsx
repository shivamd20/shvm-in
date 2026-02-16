import { X, FileAudio, Terminal, Activity, AlertCircle, Mic, Speaker } from 'lucide-react';
import type { DebugEvent } from '@vani/headless';

interface VoiceDebugSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    events: DebugEvent[];
}

export function VoiceDebugSidebar({ isOpen, onClose, events }: VoiceDebugSidebarProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-y-0 right-0 w-96 bg-zinc-900 border-l border-zinc-800 shadow-2xl flex flex-col z-50 animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="bg-zinc-950 px-4 py-3 border-b border-zinc-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 text-zinc-100">
                    <Terminal className="w-4 h-4 text-zinc-400" />
                    <span className="font-mono text-sm font-semibold">Debug Console</span>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-white transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Event Log */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs">
                {events.length === 0 && (
                    <div className="text-zinc-500 text-center py-8">No events logged yet.</div>
                )}

                {events.map((event) => (
                    <EventItem key={event.id} event={event} />
                ))}
            </div>

            {/* Footer / Stats */}
            <div className="bg-zinc-950 px-4 py-2 border-t border-zinc-800 text-[10px] text-zinc-500 flex justify-between shrink-0">
                <span>{events.length} events</span>
                <span>Session ID: {events[0]?.id?.slice(0, 4) || 'N/A'}</span>
            </div>
        </div>
    );
}

function EventItem({ event }: { event: DebugEvent }) {
    const time = new Date(event.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });

    const getIcon = () => {
        switch (event.type) {
            case 'state_change': return <Activity className="w-3 h-3 text-blue-400" />;
            case 'socket_event': return <Terminal className="w-3 h-3 text-zinc-500" />;
            case 'audio_input': return <Mic className="w-3 h-3 text-green-400" />;
            case 'audio_output': return <Speaker className="w-3 h-3 text-purple-400" />;
            case 'error': return <AlertCircle className="w-3 h-3 text-red-500" />;
            case 'transcript': return <FileAudio className="w-3 h-3 text-yellow-400" />;
            default: return <Terminal className="w-3 h-3" />;
        }
    };

    const isAudio = event.type === 'audio_input' || event.type === 'audio_output';

    return (
        <div className="bg-zinc-800/50 rounded border border-zinc-800 p-2 flex gap-3 hover:bg-zinc-800 transition-colors group">
            <div className="shrink-0 pt-0.5 opacity-70 group-hover:opacity-100">{getIcon()}</div>
            <div className="flex-1 min-w-0 overflow-hidden">
                <div className="flex items-center justify-between mb-0.5">
                    <span className="text-zinc-400 font-bold uppercase tracking-wider text-[10px]">{event.type.replace('_', ' ')}</span>
                    <span className="text-zinc-600 text-[10px]">{time}</span>
                </div>

                <div className="text-zinc-300 break-words whitespace-pre-wrap">
                    {renderDetails(event)}
                </div>

                {isAudio && event.blobUrl && (
                    <div className="mt-2">
                        <audio
                            controls
                            src={event.blobUrl}
                            className="w-full h-6 rounded bg-transparent opacity-80 hover:opacity-100"
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

function renderDetails(event: DebugEvent) {
    if (event.type === 'state_change') {
        return (
            <span className="flex items-center gap-1.5">
                <span className="text-zinc-500">{(event.details as any).from || 'void'}</span>
                <span className="text-zinc-600">→</span>
                <span className={`${getStateColor((event.details as any).to)} font-semibold`}>
                    {(event.details as any).to}
                </span>
                <span className="text-zinc-600 ml-1 text-[10px]">({(event.details as any).source})</span>
            </span>
        );
    }

    if (event.type === 'transcript') {
        return (
            <span>
                <span className={(event.details as any).role === 'user' ? 'text-green-400' : 'text-purple-400'}>
                    {(event.details as any).role}:
                </span> {(event.details as any).text}
            </span>
        );
    }

    // Default JSON dump for others, slightly formatted
    return JSON.stringify(event.details, null, 0).replace(/[{}"]/g, '').replace(/:/g, ': ');
}

function getStateColor(state: string) {
    switch (state) {
        case 'listening': return 'text-green-400';
        case 'processing': return 'text-yellow-400';
        case 'speaking': return 'text-blue-400';
        case 'idle': return 'text-zinc-400';
        case 'error': return 'text-red-400';
        default: return 'text-zinc-300';
    }
}
