export function Hero() {
    return (
        <div className="flex flex-col items-center justify-center space-y-4 py-8 text-center">
            <h1 className="text-4xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-zinc-100 to-zinc-500">
                SHVM.IN
            </h1>
            <p className="font-mono text-sm text-zinc-500 uppercase tracking-widest">
                AI + Distributed Systems Engineer
            </p>
            <p className="text-zinc-600 text-xs mt-2">
                Talk to my AI about what I build.
            </p>
        </div>
    );
}
