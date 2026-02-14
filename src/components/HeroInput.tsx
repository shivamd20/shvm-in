import { useState, KeyboardEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';

export function HeroInput() {
    const [text, setText] = useState('');
    const navigate = useNavigate();

    const handleSend = () => {
        if (text.trim()) {
            // Navigate to chat with the initial query
            // @ts-ignore - straightforward state pass
            navigate({ to: '/chat', state: { query: text } });
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-accent/20 via-white/5 to-accent/20 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>

            <div className="relative flex items-center bg-black border border-white/10 rounded-2xl shadow-2xl p-2 transition-all duration-300 focus-within:ring-1 focus-within:ring-white/20 focus-within:border-white/20">

                <div className="pl-4 pr-2 text-accent/80 animate-pulse">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z" fill="currentColor" fillOpacity="0.2" />
                        <path d="M12 6V18M18 12H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </div>

                <input
                    type="text"
                    className="w-full bg-transparent border-none px-4 py-4 text-lg md:text-xl text-white focus:outline-none placeholder-zinc-600 font-display tracking-tight"
                    placeholder="Ask anything about my work..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoFocus
                />

                <button
                    onClick={handleSend}
                    disabled={!text.trim()}
                    className="p-3 bg-white/10 rounded-xl text-zinc-400 hover:text-white hover:bg-white/20 transition-all disabled:opacity-0 disabled:pointer-events-none"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                </button>
            </div>

            {/* Helper text */}
            <div className="absolute -bottom-8 left-0 right-0 text-center opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100">
                <span className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase">
                    Press Enter to Start
                </span>
            </div>
        </div>
    );
}
