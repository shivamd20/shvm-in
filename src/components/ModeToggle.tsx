export type Mode = 'recruiter' | 'engineer' | 'architect';

export function ModeToggle({ mode, setMode }: { mode: Mode, setMode: (m: Mode) => void }) {
    const modes: Mode[] = ['recruiter', 'engineer', 'architect'];

    return (
        <div className="flex bg-zinc-900/50 p-1 rounded-lg border border-zinc-800/50 backdrop-blur-sm">
            {modes.map((m) => (
                <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider rounded-md transition-all ${mode === m
                            ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700'
                            : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'
                        }`}
                >
                    {m}
                </button>
            ))}
        </div>
    );
}
