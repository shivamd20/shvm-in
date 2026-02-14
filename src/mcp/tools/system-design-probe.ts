import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import projectsData from "../data/projects.json";

interface Project {
    id: string;
    name: string;
    stack: string[];
    summary: string;
    problem: string;
    architecture: string;
    tradeoffs?: string;
    notable_decisions?: string[];
    system_design_topics?: string[];
    ownership: string;
    complexity: string;
}

export function registerSystemDesignProbeTool(server: McpServer) {
    server.tool(
        "system_design_probe",
        "Provide architecture-first answers about Shivam's system design depth. Input a topic (e.g., 'distributed database', 'real-time collaboration', 'edge computing') to get relevant systems, architecture choices, tradeoffs, and seniority signals.",
        { topic: z.string().describe("System design topic to probe, e.g. 'distributed database', 'real-time collaboration', 'consistency', 'edge computing'") },
        async ({ topic }) => {
            const topicLower = topic.toLowerCase();

            // Find projects relevant to the topic
            const relevantProjects = (projectsData.projects as Project[]).filter((p) => {
                const searchFields = [
                    p.summary,
                    p.problem,
                    p.architecture,
                    p.tradeoffs || "",
                    ...(p.notable_decisions || []),
                    ...(p.system_design_topics || []),
                    ...p.stack,
                ].map((s) => s.toLowerCase());

                return searchFields.some((field) => field.includes(topicLower)) ||
                    topicLower.split(/\s+/).some((word) =>
                        searchFields.some((field) => field.includes(word))
                    );
            });

            if (relevantProjects.length === 0) {
                return {
                    content: [{
                        type: "text" as const,
                        text: `No systems found directly related to "${topic}".\n\nShivam's systems span: distributed databases, real-time collaboration, edge computing, offline-first PWAs, multiplayer game engines, and privacy-first backup infrastructure.\n\nTry a broader topic or one of these keywords: distributed database, real-time, edge computing, durable objects, consistency, replication, offline-first, encryption, WebSockets.`
                    }],
                };
            }

            const sections = relevantProjects.map((p) => {
                let section = `## ${p.name}

**Problem:** ${p.problem}

**Architecture:**
${p.architecture}

**Stack:** ${p.stack.join(", ")}`;

                if (p.tradeoffs) {
                    section += `\n\n**Tradeoffs:**\n${p.tradeoffs}`;
                }

                if (p.notable_decisions && p.notable_decisions.length > 0) {
                    section += `\n\n**Key Decisions:**\n${p.notable_decisions.map((d) => `- ${d}`).join("\n")}`;
                }

                section += `\n\n**Ownership:** ${p.ownership} · **Complexity:** ${p.complexity}`;

                return section;
            });

            const output = `# System Design Probe: "${topic}"

${sections.join("\n\n---\n\n")}

---

## What This Demonstrates
- **Depth:** ${relevantProjects.length} relevant system(s) with architecture-level detail
- **Ownership:** All systems are sole-authored — full design ownership
- **Seniority Signal:** Makes explicit tradeoff decisions, documents rationale, builds for production constraints`;

            return {
                content: [{ type: "text" as const, text: output }],
            };
        }
    );
}
