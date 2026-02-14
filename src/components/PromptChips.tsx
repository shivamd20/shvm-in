export function PromptChips({ onSelect }: { onSelect: (text: string) => void }) {
    const suggestions = [
        "Explain shvm-db",
        "Projects with Cloudflare Workers?",
        "Tell me about your time at Druva",
        "What is Liva?",
        "Show open source libraries"
    ];

    return (
        <div className="flex flex-wrap gap-3 justify-center max-w-lg mx-auto py-6 animate-fade-in-delayed">
            {suggestions.map((s, i) => (
                <button
                    key={s}
                    onClick={() => onSelect(s)}
                    className="px-4 py-2 bg-zinc-900/40 border border-white/5 rounded-full text-xs text-zinc-400 hover:text-white hover:border-accent/40 hover:bg-zinc-800/60 transition-all duration-300 font-mono tracking-wide shadow-sm hover:shadow-accent/10"
                    style={{ animationDelay: `${i * 100}ms` }}
                >
                    {s}
                </button>
            ))}
        </div>
    );
}
