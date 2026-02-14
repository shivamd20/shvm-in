import { useState, KeyboardEvent } from 'react';

interface ChatInputProps {
    onSend: (text: string) => void;
    disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
    const [text, setText] = useState('');

    const handleSend = () => {
        if (text.trim() && !disabled) {
            onSend(text);
            setText('');
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="relative w-full max-w-2xl mx-auto">
            <div className={`relative flex items-center bg-zinc-900/30 border border-white/10 rounded-full shadow-inner transition-all duration-300 ${disabled ? 'opacity-50 cursor-not-allowed' : 'focus-within:ring-1 focus-within:ring-accent/50 focus-within:border-accent/40 hover:border-white/20'}`}>
                <span className="pl-5 text-accent font-mono text-lg animate-pulse">{'>'}</span>
                <input
                    type="text"
                    className="w-full bg-transparent border-none px-4 py-3 text-sm text-white focus:outline-none placeholder-zinc-600 font-mono tracking-wide"
                    placeholder="Ask about architecture, systems, or code..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={disabled}
                    autoFocus
                />
                <button
                    onClick={handleSend}
                    disabled={!text.trim() || disabled}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full text-zinc-500 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-0"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                </button>
            </div>
        </div>
    );
}
