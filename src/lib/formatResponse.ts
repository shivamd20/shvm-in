import { SearchResult } from './retrieve';
import { Mode } from '../components/ModeToggle';

export function formatResponse(query: string, results: SearchResult[], mode: Mode = 'engineer'): string {
    if (results.length === 0) {
        return "I don't have specific details on that yet. Try asking about my projects (Liva, Shvm-DB, Din), work experience (Druva, Mindtickle), or tech stack.";
    }

    const topResult = results[0];
    const data = topResult.data;

    // Handle Project List (Stack match)
    if (topResult.type === 'stack') {
        const { name, projects } = data;
        let response = `Here are the projects where I used **${name}**:\n\n`;
        projects.forEach((p: any) => {
            if (mode === 'recruiter') {
                response += `- **[${p.name}](${p.url})**: ${p.summary} (Status: ${p.status})\n`;
            } else if (mode === 'architect') {
                response += `- **[${p.name}](${p.url})**: ${p.architecture || p.summary}\n`;
            } else {
                response += `- **[${p.name}](${p.url})**: ${p.summary} (${p.stack.join(', ')})\n`;
            }
        });
        return response;
    }

    // Handle Single Project / Open Source
    if (topResult.type === 'project' || topResult.type === 'open_source') {
        const p = data;

        if (mode === 'recruiter') {
            return `### ${p.name}
${p.summary}

**Problem Solved:**
${p.problem || "Addressed scalable real-time needs."}

**Key Tech:**
${p.stack.slice(0, 3).join(', ')}

[View Demo](${p.url}) | [Source Code](${p.repo})
`;
        }

        if (mode === 'architect') {
            return `### ${p.name} - System Architecture

**Core Problem:**
${p.problem}

**Architecture Decision:**
${p.architecture}

**Trade-offs:**
${p.tradeoffs}

**Tech Stack:**
${p.stack.join(', ')}
`;
        }

        // Engineer Mode (Default)
        return `### ${p.name}
${p.summary}

**Stack:**
${p.stack.map((s: string) => `\`${s}\``).join(', ')}

**Architecture Note:**
${p.architecture}

[Live Demo](${p.url}) | [GitHub Repo](${p.repo})
`;
    }

    // Handle Experience
    if (topResult.type === 'experience') {
        const exps = Array.isArray(data) ? data : [data];
        return exps.map((e: any) => {
            let content = `### ${e.role} @ ${e.company}\n*${e.period}*`;

            if (mode === 'recruiter') {
                content += `\n\n**Key Achievements:**\n${e.highlights.map((h: string) => `- ${h}`).join('\n')}`;
            } else if (mode === 'architect') {
                // Filter for system design highlights if possible, else all
                content += `\n\n**System Contributions:**\n${e.highlights.map((h: string) => `- ${h} (Scalability/Efficiency)`).join('\n')}`;
            } else {
                content += `\n\n${e.highlights.map((h: string) => `- ${h}`).join('\n')}`;
            }
            return content;
        }).join('\n\n---\n\n');
    }

    // Handle Profile
    if (topResult.type === 'profile') {
        const p = data;
        if (mode === 'recruiter') {
            return `**${p.name}**
${p.title} based in ${p.location}.

${p.tagline}

**Contact:** [${p.email}](mailto:${p.email})
**LinkedIn:** [${p.linkedin}](${p.linkedin})
**GitHub:** [${p.github}](${p.github})
`;
        }
        return `**${p.name}**
${p.title}
${p.location}

${p.tagline}

- Email: [${p.email}](mailto:${p.email})
- GitHub: [${p.github}](${p.github})
- LinkedIn: [${p.linkedin}](${p.linkedin})
`;
    }

    return "I found some info but I'm not sure how to format it.";
}
