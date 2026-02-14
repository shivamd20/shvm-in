interface ProjectCardProps {
    project: {
        name: string;
        url?: string;
        repo?: string;
        summary: string;
        stack: string[];
        type?: string;
        problem?: string;
    };
}

export function ProjectCard({ project }: ProjectCardProps) {
    const link = project.url || project.repo || '#';

    return (
        <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="group block p-6 rounded-2xl glass-panel hover:bg-white/5 transition-all duration-300 border border-white/5 hover:border-white/10 relative overflow-hidden flex flex-col h-full"
        >
            <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="relative z-10 flex flex-col h-full justify-between space-y-4">
                <div>
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-xl font-display font-medium text-white group-hover:text-accent transition-colors">
                            {project.name}
                        </h3>
                        <span className="text-xs text-muted-foreground uppercase tracking-widest border border-white/10 px-2 py-0.5 rounded-full shrink-0 ml-2">
                            {project.type || 'Project'}
                        </span>
                    </div>

                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                        {project.summary}
                    </p>

                    {project.problem && (
                        <p className="text-xs text-zinc-500 line-clamp-2 mb-4 italic pl-2 border-l-2 border-white/10">
                            "{project.problem}"
                        </p>
                    )}
                </div>

                <div className="flex flex-wrap gap-2 mt-auto pt-4 border-t border-white/5">
                    {project.stack.slice(0, 4).map((tech) => (
                        <span
                            key={tech}
                            className="text-[10px] font-mono text-zinc-400 bg-zinc-900/50 px-2 py-1 rounded border border-white/5 group-hover:border-white/10 transition-colors"
                        >
                            {tech}
                        </span>
                    ))}
                    {project.stack.length > 4 && (
                        <span className="text-[10px] font-mono text-zinc-500 px-1 py-1">+</span>
                    )}
                </div>
            </div>
        </a>
    );
}
