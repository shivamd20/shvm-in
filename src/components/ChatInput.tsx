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
            // Keep focus if possible? Not easy without ref.
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
            <div className="relative flex items-center bg-zinc-950 border border-zinc-700 rounded-lg shadow-sm focus-within:ring-2 focus-within:ring-zinc-600 focus-within:border-zinc-500 transition-all">
                <span className="pl-4 text-zinc-500 font-mono text-lg">{'>'}</span>
                <input
                    type="text"
                    className="w-full bg-transparent border-none px-4 py-4 text-sm text-zinc-100 focus:outline-none placeholder-zinc-600 font-mono"
                    placeholder="Ask about shvm-db architecture..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={disabled}
                    autoFocus
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-zinc-600 font-mono hidden sm:block pointer-events-none">
                    RETURN ⏎
                </div>
            </div>
        </div>
    );
}
