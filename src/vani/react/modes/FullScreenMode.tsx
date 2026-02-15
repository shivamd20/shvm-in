
import { Mic, Volume2, Loader2, Radio, WifiOff, AlertCircle, Terminal, Minimize2 } from 'lucide-react';
import { useState } from 'react';
import { VoiceDebugSidebar } from '../VoiceDebugSidebar';
import { VaniViewProps } from '../types';

export function FullScreenMode({
    status,
    transcript,
    history,
    error,
    connect,
    vadLoading,
    onTogglePip
}: VaniViewProps) {
    const [isDebugOpen, setIsDebugOpen] = useState(false);

    // UI Mapping
    const isListening = status === 'listening';
    const isThinking = status === 'processing';
    const isSpeaking = status === 'speaking';
    const isConnecting = status === 'connecting';
    const isDisconnected = status === 'disconnected';
    const isError = status === 'error';

    return (
        <div className="fixed inset-0 min-h-screen bg-black text-zinc-100 flex flex-col items-center justify-center p-4 selection:bg-accent/20 overflow-hidden">

            {/* Background Ambience */}
            <div className="fixed inset-0 pointer-events-none">
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vh] h-[60vh] blur-[120px] rounded-full opacity-20 transition-all duration-700
          ${isListening ? 'bg-green-500 scale-125' :
                        isThinking ? 'bg-yellow-500 scale-110' :
                            isSpeaking ? 'bg-blue-600 scale-125' :
                                isError ? 'bg-red-600 scale-110' :
                                    isDisconnected ? 'bg-zinc-800 scale-90' : 'bg-zinc-800 scale-100'}`}
                />
            </div>

            {/* Controls: Pip Toggle */}
            <div className="absolute top-4 right-4 z-50 flex gap-2">
                {onTogglePip && (
                    <button
                        onClick={onTogglePip}
                        className="p-2 rounded-full hover:bg-zinc-900 text-zinc-500 hover:text-zinc-300 transition-colors"
                        title="Enter Picture-in-Picture Mode"
                    >
                        <Minimize2 className="w-5 h-5" />
                    </button>
                )}
            </div>

            <div className="relative z-10 max-w-md w-full flex flex-col items-center gap-12 transition-all duration-500" style={{ transform: isDebugOpen ? "translateX(-150px)" : "translateX(0)" }}>

                {/* Status Indicator */}
                <div className="flex flex-col items-center gap-4">
                    <h1 className="text-2xl font-display font-medium tracking-tight h-8">
                        {isListening ? 'Listening...' :
                            isThinking ? 'Thinking...' :
                                isSpeaking ? 'Speaking...' :
                                    isConnecting ? 'Connecting...' :
                                        isError ? 'Connection Error' :
                                            'Ready'}
                    </h1>

                    {error && (
                        <div className="text-red-400 text-sm font-mono bg-red-900/20 px-3 py-1 rounded border border-red-900/50 animate-in fade-in slide-in-from-top-2 max-w-xs text-center break-words">
                            {/* Display extended error info if standard error is generic */}
                            {error === 'An error occurred' ? 'Unknown error. Check console.' : error}
                        </div>
                    )}

                    {!error && (
                        <div className={`h-1.5 rounded-full transition-all duration-500 ${isListening ? 'w-16 bg-green-500' :
                            isThinking ? 'w-16 bg-yellow-500 animate-pulse' :
                                isSpeaking ? 'w-24 bg-blue-500' :
                                    isConnecting ? 'w-8 bg-zinc-500 animate-pulse' :
                                        isError ? 'w-16 bg-red-500 conversation-shake' : 'w-2 bg-zinc-700'
                            }`} />
                    )}
                </div>

                {/* Main Interaction Circle */}
                <button
                    disabled={isConnecting || isError || isDisconnected}
                    className={`relative w-48 h-48 rounded-full flex items-center justify-center border-4 transition-all duration-300 outline-none
            ${isListening ? 'border-green-500/50 bg-green-500/10 scale-105 shadow-[0_0_40px_rgba(34,197,94,0.3)]' :
                            isThinking ? 'border-yellow-500/50 bg-yellow-500/10 shadow-[0_0_40px_rgba(234,179,8,0.3)] animate-pulse' :
                                isSpeaking ? 'border-blue-500/50 bg-blue-500/10 shadow-[0_0_40px_rgba(59,130,246,0.3)]' :
                                    isError ? 'border-red-500/50 bg-red-500/10 hover:border-red-400 cursor-not-allowed' :
                                        isDisconnected ? 'border-zinc-800/50 bg-black/50 cursor-not-allowed' :
                                            'border-zinc-800 bg-zinc-900 hover:border-zinc-700 hover:bg-zinc-800'}`}
                >
                    {isListening ? (
                        <Radio className="w-16 h-16 text-green-500 animate-pulse" />
                    ) : isThinking ? (
                        <Loader2 className="w-16 h-16 text-yellow-500 animate-spin" />
                    ) : isSpeaking ? (
                        <Volume2 className="w-16 h-16 text-blue-500 animate-bounce" />
                    ) : isError ? (
                        <AlertCircle className="w-16 h-16 text-red-500" />
                    ) : isDisconnected ? (
                        <WifiOff className="w-16 h-16 text-zinc-600" />
                    ) : (
                        <Mic className="w-16 h-16 text-zinc-500" />
                    )}
                </button>

                {/* Instructions */}
                {(isError || isDisconnected) ? (
                    <button
                        onClick={() => connect()}
                        className="text-zinc-400 hover:text-white text-sm font-mono border border-zinc-700 px-4 py-2 rounded hover:bg-zinc-800 transition-colors"
                    >
                        {isError ? 'Retry Connection' : 'Start Voice Session'}
                    </button>
                ) : (
                    <p className="text-zinc-500 text-sm font-mono text-center h-6">
                        {vadLoading ? 'Loading voice activity detection…' : 'Just start talking'}
                    </p>
                )}

                {/* Transcript (Last 2 messages) */}
                <div className="w-full space-y-4 min-h-[150px] mask-gradient-b flex flex-col justify-end pb-4">
                    {transcript && transcript.slice(-2).map((msg) => (
                        <div key={msg.id} className={`flex flex-col space-y-1 animate-in slide-in-from-bottom-2 fade-in duration-300 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                            <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">{msg.role}</span>
                            <div className={`px-4 py-2 rounded-2xl max-w-[90%] text-sm leading-relaxed shadow-lg
                ${msg.role === 'user'
                                    ? 'bg-zinc-800/80 text-zinc-200 rounded-tr-sm border border-zinc-700/50'
                                    : 'bg-blue-900/20 text-blue-100 border border-blue-500/20 rounded-tl-sm backdrop-blur-sm'}`}>
                                {msg.content}
                            </div>
                        </div>
                    ))}
                </div>

            </div>

            {/* Debug Toggle */}
            <button
                onClick={() => setIsDebugOpen(!isDebugOpen)}
                className={`fixed bottom-4 right-4 p-2 rounded-full transition-all duration-300 z-50
                    ${isDebugOpen ? 'bg-zinc-800 text-white shadow-xl' : 'bg-transparent text-zinc-700 hover:text-zinc-400 hover:bg-zinc-900'}`}
            >
                <Terminal className="w-5 h-5" />
            </button>

            {/* Debug Sidebar */}
            {isDebugOpen && (
                <div className="fixed inset-y-0 right-0 z-40">
                    <VoiceDebugSidebar
                        isOpen={isDebugOpen}
                        onClose={() => setIsDebugOpen(false)}
                        events={history}
                    />
                </div>
            )}
        </div>
    );
}
