export type Mode = 'recruiter' | 'engineer' | 'architect';

export function ModeToggle({ mode, setMode }: { mode: Mode, setMode: (m: Mode) => void }) {
    const modes: Mode[] = ['recruiter', 'engineer', 'architect'];

    return (
        <div className="flex bg-black/40 p-1 rounded-full border border-white/5 backdrop-blur-md shadow-lg">
            {modes.map((m) => (
                <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider rounded-full transition-all duration-300 ${mode === m
                            ? 'bg-zinc-800 text-white shadow-sm border border-white/10'
                            : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                        }`}
                >
                    {m}
                </button>
            ))}
        </div>
    );
}
