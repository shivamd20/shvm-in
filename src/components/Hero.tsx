export function Hero() {
    return (
        <div className="flex flex-col items-center justify-center space-y-6 pt-16 pb-12 text-center animate-fade-in relative z-20">

            {/* Subtle background glow for hero */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-accent/5 blur-[120px] rounded-full pointer-events-none" />

            <h1 className="text-5xl md:text-7xl font-display font-medium tracking-tight text-white/90 drop-shadow-2xl">
                SHVM<span className="text-accent">.</span>IN
            </h1>

            <div className="space-y-4 max-w-lg mx-auto relative">
                <p className="font-mono text-xs md:text-sm text-accent tracking-[0.2em] uppercase opacity-80">
                    AI + Distributed Systems Engineer
                </p>

                <p className="text-muted-foreground text-sm leading-relaxed px-4">
                    Building high-performance, edge-native infrastructure and intelligent systems.
                    <br className="hidden md:block" />
                    Talk to my digital twin below.
                </p>
            </div>

        </div>
    );
}
