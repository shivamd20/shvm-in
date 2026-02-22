import { useState, useEffect, useRef } from 'react';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { PromptChips } from './PromptChips';
import { ModeToggle, Mode } from './ModeToggle';
import { useLocation } from '@tanstack/react-router';
import { Vani } from '../vani';

export interface Message {
    role: 'user' | 'assistant';
    content: string;
    uiType?: 'cards' | 'timeline' | 'profile' | 'tech_stack' | 'none';
    uiData?: any;
    followUps?: string[];
    isHidden?: boolean;
}

export function ChatShell() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<Mode>('engineer');
    const [isVoiceMode, setIsVoiceMode] = useState(false); // Voice mode state
    const scrollRef = useRef<HTMLDivElement>(null);

    // Handle initial query from navigation state
    const location = useLocation();
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

    const handleSend = async (text: string, overrideMessages?: Message[]) => {
        if (!text.trim() && !overrideMessages) return;

        let currentMessages = overrideMessages || [...messages];
        if (text.trim()) {
            const userMsg: Message = { role: 'user', content: text };
            currentMessages = [...currentMessages, userMsg];
            setMessages(currentMessages);
        }
        setLoading(true);

        try {
            const apiMessages = currentMessages.map(m => ({
                role: m.role,
                content: m.content
            }));

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: apiMessages, mode })
            });

            if (!response.body) throw new Error("No response body");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            let assistantMessageCreated = false;
            let assistantContent = "";
            let buffer = "";
            let finalMessages = [...currentMessages];

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const chunk = JSON.parse(line);

                        if (chunk.type === 'TEXT_MESSAGE_CONTENT' && chunk.delta) {
                            if (!assistantMessageCreated) {
                                finalMessages = [...finalMessages, { role: 'assistant', content: "" }];
                                setMessages(finalMessages);
                                assistantMessageCreated = true;
                            }
                            assistantContent += chunk.delta;
                            setMessages(prev => {
                                const newMessages = [...prev];
                                const lastMsg = newMessages[newMessages.length - 1];
                                if (lastMsg.role === 'assistant') {
                                    lastMsg.content = assistantContent;
                                }
                                return newMessages;
                            });
                        }

                        if (chunk.type === 'TOOL_CALL_START') {
                            if (!assistantMessageCreated) {
                                finalMessages = [...finalMessages, { role: 'assistant', content: "" }];
                                setMessages(finalMessages);
                                assistantMessageCreated = true;
                            }
                            assistantContent += `\n\n> ⏳ *Using tool:* \`${chunk.toolName}\`...\n\n`;
                            setMessages(prev => {
                                const newMessages = [...prev];
                                const lastMsg = newMessages[newMessages.length - 1];
                                if (lastMsg.role === 'assistant') {
                                    lastMsg.content = assistantContent;
                                }
                                return newMessages;
                            });
                        }

                        if (chunk.type === 'TOOL_CALL_END') {
                            assistantContent += `\n\n> ✅ *Tool finished.* \n\n`;
                            setMessages(prev => {
                                const newMessages = [...prev];
                                const lastMsg = newMessages[newMessages.length - 1];
                                if (lastMsg.role === 'assistant') {
                                    lastMsg.content = assistantContent;
                                }
                                return newMessages;
                            });
                        }
                    } catch (e) {
                        // ignore unparseable
                    }
                }
            }

        } catch (error) {
            console.error("Chat error:", error);
            setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I encountered an error. Please try again." }]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, loading]);

    const handleFollowUp = (q: string) => {
        handleSend(q);
    };

    const handleVoiceMessage = (msg: { role: 'user' | 'assistant', content: string }) => {
        setMessages(prev => [...prev, { role: msg.role, content: msg.content }]);
    };

    return (
        <div className="flex flex-col h-screen w-full bg-black text-white overflow-hidden relative selection:bg-accent/20 selection:text-white">

            {/* Header / Mode Toggle Area */}
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-50 bg-gradient-to-b from-black via-black/80 to-transparent pointer-events-none sticky-header">
                <div className="pointer-events-auto flex items-center gap-4">
                    <a href="/" className="text-xl font-display font-bold tracking-tighter text-white hover:text-accent transition-colors">
                        SHVM<span className="text-accent">.</span>
                    </a>
                </div>
                <div className="pointer-events-auto flex items-center gap-3">
                    {/* Voice Toggle */}
                    <button
                        onClick={() => setIsVoiceMode(!isVoiceMode)}
                        className={`p-2 rounded-full transition-all duration-300 ${isVoiceMode ? 'bg-accent text-white shadow-[0_0_15px_rgba(255,107,43,0.4)]' : 'bg-white/10 text-zinc-400 hover:text-white hover:bg-white/20'}`}
                        title={isVoiceMode ? "Switch to Text" : "Switch to Voice"}
                    >
                        {isVoiceMode ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                        ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                        )}
                    </button>
                    <div className="h-6 w-px bg-white/10 mx-1" />
                    <ModeToggle mode={mode} setMode={setMode} />
                </div>
            </div>

            {/* Main Content Area */}
            {isVoiceMode ? (
                <div className="flex-1 w-full h-full animate-fade-in relative z-40">
                    <Vani
                        defaultMode="full"
                        onMessage={handleVoiceMessage}
                        initialTranscript={messages.map((m, i) => ({
                            id: `msg-${i}-${Date.now()}`,
                            role: m.role as any,
                            content: m.content,
                            timestamp: Date.now()
                        }))}
                        onError={(err) => console.error("Vani Error:", err)}
                    />
                    {/* Close button handled by toggle in header */}
                </div>
            ) : (
                <>
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
                </>
            )}

        </div>
    );
}
