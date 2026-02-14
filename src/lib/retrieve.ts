import portfolio from '../data/portfolio.json';

export type SearchResult = {
    type: 'project' | 'experience' | 'open_source' | 'profile' | 'link' | 'stack' | 'general';
    data: any;
    relevance: number;
};

export function retrieve(query: string): SearchResult[] {
    const q = query.toLowerCase();
    const results: SearchResult[] = [];

    // 1. Specific Technology Lookups (High Priority)
    if (q.includes('durable object') || q.includes('worker') || q.includes('cloudflare')) {
        const relatedProjects = portfolio.projects.filter(p =>
            p.stack.some((s: string) => s.toLowerCase().includes('durable object') || s.toLowerCase().includes('cloudflare'))
        );
        if (relatedProjects.length > 0) {
            results.push({ type: 'stack', data: { name: 'Cloudflare / Durable Objects', projects: relatedProjects }, relevance: 20 });
        }
    }

    // 2. Check projects directly
    portfolio.projects.forEach(p => {
        if (p.name.toLowerCase().includes(q) ||
            (p.summary.toLowerCase().includes(q) && q.length > 4)) {
            results.push({ type: 'project', data: p, relevance: 15 });
        }
    });

    // 3. Check open source
    portfolio.open_source.forEach(p => {
        if (p.name.toLowerCase().includes(q)) {
            results.push({ type: 'open_source', data: p, relevance: 14 });
        }
    });

    // 4. Experience matches
    if (q.includes('work') || q.includes('experience') || q.includes('job') || q.includes('career') || q.includes('druva') || q.includes('mindtickle')) {
        if (q.includes('druva')) {
            results.push({ type: 'experience', data: portfolio.experience.filter(e => e.company.toLowerCase().includes('druva')), relevance: 20 });
        } else if (q.includes('mindtickle')) {
            results.push({ type: 'experience', data: portfolio.experience.filter(e => e.company.toLowerCase().includes('mindtickle')), relevance: 20 });
        } else {
            results.push({ type: 'experience', data: portfolio.experience, relevance: 10 });
        }
    }

    // 5. Contact / Profile
    if (q.includes('email') || q.includes('contact') || q.includes('reach') || q.includes('hello') || q.includes('who are you')) {
        results.push({ type: 'profile', data: portfolio.profile, relevance: 10 });
    }

    return results.sort((a, b) => b.relevance - a.relevance);
}
