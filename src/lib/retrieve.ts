import portfolio from '../data/portfolio.json';

export type SearchResult = {
    type: 'project' | 'experience' | 'open_source' | 'profile' | 'link' | 'stack' | 'general' | 'flagship';
    data: any;
    relevance: number;
};

export function retrieve(query: string): SearchResult[] {
    const q = query.toLowerCase();
    const results: SearchResult[] = [];

    // 1. Broad Categories / Intents
    if (q.includes('flagship') || q.includes('main project') || q.includes('best work')) {
        const flagships = portfolio.projects.filter(p => p.type === 'flagship');
        results.push({ type: 'flagship', data: flagships, relevance: 25 });
    }

    if (q.includes('architecture') || q.includes('system design') || q.includes('backend')) {
        // Return high-level architect-y projects
        const sysProjects = portfolio.projects.filter(p => p.summary.includes('system') || p.stack.includes('Durable Objects'));
        results.push({ type: 'stack', data: { name: 'System Architecture', projects: sysProjects }, relevance: 20 });
    }

    // 2. Specific Technology Lookups
    if (q.includes('durable object') || q.includes('worker') || q.includes('cloudflare') || q.includes('edge')) {
        const relatedProjects = portfolio.projects.filter(p =>
            p.stack.some((s: string) => s.toLowerCase().includes('durable object') || s.toLowerCase().includes('cloudflare') || s.toLowerCase().includes('edge'))
        );
        if (relatedProjects.length > 0) {
            results.push({ type: 'stack', data: { name: 'Edge Infrastructure', projects: relatedProjects }, relevance: 20 });
        }
    }

    if (q.includes('ai') || q.includes('artificial') || q.includes('llm') || q.includes('gpt')) {
        // Filter AI projects
        const aiProjects = portfolio.projects.filter(p => p.stack.some(s => s.toLowerCase().includes('ai') || s.toLowerCase().includes('gpt')));
        results.push({ type: 'stack', data: { name: 'AI Engineering', projects: aiProjects }, relevance: 20 });
    }

    // 3. Check projects directly
    portfolio.projects.forEach(p => {
        if (p.name.toLowerCase().includes(q) ||
            (p.summary.toLowerCase().includes(q) && q.length > 4)) {
            results.push({ type: 'project', data: p, relevance: 15 });
        }
    });

    // 4. Check open source
    portfolio.open_source.forEach(p => {
        if (p.name.toLowerCase().includes(q)) {
            results.push({ type: 'open_source', data: p, relevance: 14 });
        }
    });

    // 5. Experience matches
    if (q.includes('work') || q.includes('experience') || q.includes('job') || q.includes('career') || q.includes('druva') || q.includes('mindtickle') || q.includes('neptune') || q.includes('hasura')) {
        if (q.includes('druva')) {
            results.push({ type: 'experience', data: portfolio.experience.filter(e => e.company.toLowerCase().includes('druva')), relevance: 20 });
        } else if (q.includes('mindtickle')) {
            results.push({ type: 'experience', data: portfolio.experience.filter(e => e.company.toLowerCase().includes('mindtickle')), relevance: 20 });
        } else {
            results.push({ type: 'experience', data: portfolio.experience, relevance: 10 });
        }
    }

    // 6. Contact / Profile
    if (q.includes('email') || q.includes('contact') || q.includes('hire') || q.includes('resume') || q.includes('who are you')) {
        results.push({ type: 'profile', data: portfolio.profile, relevance: 10 });
    }

    return results.sort((a, b) => b.relevance - a.relevance);
}
