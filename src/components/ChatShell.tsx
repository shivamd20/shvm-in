import { useState, useEffect, useRef } from 'react';
import { retrieve } from '@/lib/retrieve';
import { formatResponse } from '@/lib/formatResponse';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { PromptChips } from './PromptChips';
import { ModeToggle, Mode } from './ModeToggle';
import { useLocation, useNavigate } from '@tanstack/react-router';

export interface Message {
    role: 'user' | 'assistant';
    content: string;
    uiType?: 'cards' | 'timeline' | 'profile' | 'tech_stack' | 'none';
    uiData?: any;
    followUps?: string[];
}

export function ChatShell() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<Mode>('engineer');
    const scrollRef = useRef<HTMLDivElement>(null);

    // Handle initial query from navigation state
    const location = useLocation();
    const navigate = useNavigate();
    const hasInitialized = useRef(false);

    useEffect(() => {
        if (hasInitialized.current) return;
        hasInitialized.current = true;

        // Check if we have an initial query passed via state
        // @ts-ignore - straightforward state access
        const initialQuery = location.state?.query;

        if (initialQuery) {
            handleSend(initialQuery);
        }
    }, [location]);

    const handleSend = async (text: string) => {
        if (!text.trim()) return;

        // Immediate user message
        const userMsg: Message = { role: 'user', content: text };
        setMessages(prev => [...prev, userMsg]);
        setLoading(true);

        // Simulate thinking/retrieving
        setTimeout(() => {
            const results = retrieve(text);
            // @ts-ignore
            const formatted = formatResponse(text, results, mode);

            const aiMsg: Message = {
                role: 'assistant',
                content: formatted.text,
                uiType: formatted.uiType,
                uiData: formatted.uiData,
                followUps: formatted.followUps
            };
            setMessages(prev => [...prev, aiMsg]);
            setLoading(false);
        }, 800);
    };

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, loading]);

    const handleFollowUp = (q: string) => {
        handleSend(q);
    };

    return (
        <div className="flex flex-col h-screen w-full bg-black text-white overflow-hidden relative selection:bg-accent/20 selection:text-white">

            {/* Header / Mode Toggle Area */}
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-50 bg-gradient-to-b from-black via-black/80 to-transparent pointer-events-none sticky-header">
                <div className="pointer-events-auto">
                    <a href="/" className="text-xl font-display font-bold tracking-tighter text-white hover:text-accent transition-colors">
                        SHVM<span className="text-accent">.</span>
                    </a>
                </div>
                <div className="pointer-events-auto">
                    <ModeToggle mode={mode} setMode={setMode} />
                </div>
            </div>

            {/* Main Chat Area */}
            <div
                className="flex-1 overflow-y-auto px-4 md:px-0 py-20 scrollbar-hide"
                ref={scrollRef}
            >
                <div className="max-w-3xl mx-auto w-full space-y-8 pb-32">
                    {messages.length === 0 && !loading && (
                        <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-6 animate-fade-in opacity-90">
                            {/* Empty State / Welcome */}
                            <div className="w-16 h-16 rounded-full bg-zinc-900/50 border border-white/10 flex items-center justify-center mb-2 shadow-[0_0_30px_rgba(255,107,43,0.1)]">
                                <span className="text-2xl">⚡️</span>
                            </div>
                            <h2 className="text-2xl md:text-3xl font-display font-medium text-white/90">
                                What can I help you build?
                            </h2>
                            <div className="w-full max-w-md px-4">
                                <PromptChips onSelect={handleFollowUp} />
                            </div>
                        </div>
                    )}

                    <MessageList messages={messages} loading={loading} onFollowUp={handleFollowUp} />

                    {/* Invisble spacer for scrolling to bottom */}
                    <div className="h-12" />
                </div>
            </div>

            {/* Sticky Bottom Input */}
            <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-black via-black/95 to-transparent z-40">
                <div className="max-w-3xl mx-auto w-full">
                    <ChatInput onSend={handleSend} disabled={loading} />
                    <div className="text-center mt-3">
                        <span className="text-[10px] text-zinc-600 font-mono">
                            AI can make mistakes. Check important info.
                        </span>
                    </div>
                </div>
            </div>

        </div>
    );
}
