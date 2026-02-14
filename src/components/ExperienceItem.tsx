interface ExperienceItemProps {
    role: string;
    company: string;
    period: string;
    highlights: string[];
}

export function ExperienceItem({ role, company, period, highlights }: ExperienceItemProps) {
    return (
        <div className="relative pl-8 border-l border-white/10 py-2 group">
            <div className="absolute -left-[5px] top-3 w-2.5 h-2.5 rounded-full bg-zinc-800 border-2 border-zinc-950 group-hover:bg-accent transition-colors duration-300 shadow-[0_0_10px_rgba(255,107,43,0.3)] shadow-transparent group-hover:shadow-[0_0_10px_rgba(255,107,43,0.5)]" />

            <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between mb-2">
                <h3 className="text-lg font-display font-medium text-white">{role}</h3>
                <span className="text-xs font-mono text-zinc-500">{period}</span>
            </div>

            <div className="text-sm text-accent mb-3 font-medium">{company}</div>

            <ul className="space-y-2">
                {highlights.map((highlight, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground leading-relaxed">
                        {highlight}
                    </li>
                ))}
            </ul>
        </div>
    );
}
