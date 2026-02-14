import { useState, useEffect, useRef } from 'react';
import { retrieve } from '@/lib/retrieve';
import { formatResponse } from '@/lib/formatResponse';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { PromptChips } from './PromptChips';
import { ModeToggle, Mode } from './ModeToggle';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export function ChatShell() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<Mode>('engineer');
    const scrollRef = useRef<HTMLDivElement>(null);

    const sendMessage = async (text: string) => {
        if (!text.trim()) return;

        // Immediate user message
        const userMsg: Message = { role: 'user', content: text };
        setMessages(prev => [...prev, userMsg]);
        setLoading(true);

        // Simulate thinking/retrieving
        setTimeout(() => {
            const results = retrieve(text);
            // Pass mode here
            const responseText = formatResponse(text, results, mode);

            const aiMsg: Message = { role: 'assistant', content: responseText };
            setMessages(prev => [...prev, aiMsg]);
            setLoading(false);
        }, 600); // 600ms delay for "thinking" feel
    };

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, loading]);

    return (
        <div className="flex flex-col h-[70vh] w-full max-w-4xl mx-auto border border-zinc-800 rounded-xl bg-gradient-to-br from-zinc-950 to-zinc-900/50 backdrop-blur-md overflow-hidden shadow-2xl relative">

            {/* Header with Mode Toggle */}
            <div className="absolute top-4 right-6 z-30">
                <ModeToggle mode={mode} setMode={setMode} />
            </div>

            <div
                className="flex-1 overflow-y-auto px-6 py-8 space-y-6 scrollbar-hide relative z-10 pt-16"
                ref={scrollRef}
            >
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-8 animate-fade-in opacity-80 pointer-events-none">
                        <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4 shadow-inner">
                            <span className="text-2xl">🤖</span>
                        </div>
                        <p className="text-zinc-400 font-mono text-xs max-w-xs leading-relaxed">
                            I am an AI assistant with context on Shivam's engineering work.
                            Ask me about distributed systems, Durable Objects, or specific projects.
                        </p>
                        <div className="pointer-events-auto w-full">
                            <PromptChips onSelect={sendMessage} />
                        </div>
                    </div>
                )}
                <MessageList messages={messages} loading={loading} />
            </div>

            <div className="p-4 sm:p-6 border-t border-zinc-800 bg-zinc-950/80 backdrop-blur-xl absolute bottom-0 w-full z-20">
                <ChatInput onSend={sendMessage} disabled={loading} />
            </div>
        </div>
    );
}
