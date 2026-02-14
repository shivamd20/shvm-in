export function PromptChips({ onSelect }: { onSelect: (text: string) => void }) {
    const suggestions = [
        "Explain shvm-db architecture",
        "Show projects using Durable Objects",
        "How does the video pipeline work?",
        "What did he build at Druva?",
        "Show real-time systems"
    ];

    return (
        <div className="flex flex-wrap gap-2 justify-center max-w-lg mt-4" id="prompt-chips">
            {suggestions.map((s) => (
                <button
                    key={s}
                    onClick={() => onSelect(s)}
                    className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-full text-xs text-zinc-500 hover:text-zinc-200 hover:border-zinc-700 hover:bg-zinc-800 transition-all font-mono"
                >
                    {s}
                </button>
            ))}
        </div>
    );
}
