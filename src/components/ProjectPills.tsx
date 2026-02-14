import projectsData from '../data/projects.json';

export function ProjectPills() {
    return (
        <div className="flex flex-wrap gap-3 justify-center max-w-2xl py-8">
            {projectsData.projects.map((p, i) => (
                <a
                    key={i}
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-md text-[10px] sm:text-xs text-zinc-500 hover:text-zinc-200 hover:border-zinc-600 transition-all font-mono tracking-wide"
                >
                    {p.name}
                </a>
            ))}
        </div>
    );
}
