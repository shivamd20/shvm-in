import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import projectsData from "../data/projects.json";

export function registerProjectProbeTool(server: McpServer) {
    server.tool(
        "project_probe",
        "Get detailed information about a specific project — problem solved, architecture summary, complexity level, ownership, and notable decisions. Use fuzzy matching on project name.",
        { project: z.string().describe("Project name or ID to look up, e.g. 'shvm-db', 'Liva', 'Din', 'Backflare'") },
        async ({ project }) => {
            const projectLower = project.toLowerCase().replace(/[-_\s]/g, "");

            // Search in both projects and open_source
            const found = projectsData.projects.find((p) => {
                const nameNorm = p.name.toLowerCase().replace(/[-_\s.]/g, "");
                const idNorm = p.id.toLowerCase().replace(/[-_\s]/g, "");
                return nameNorm.includes(projectLower) || idNorm.includes(projectLower) ||
                    projectLower.includes(nameNorm) || projectLower.includes(idNorm);
            });

            const foundOss = projectsData.open_source.find((p) => {
                const nameNorm = p.name.toLowerCase().replace(/[-_\s.]/g, "");
                const idNorm = p.id.toLowerCase().replace(/[-_\s]/g, "");
                return nameNorm.includes(projectLower) || idNorm.includes(projectLower) ||
                    projectLower.includes(nameNorm) || projectLower.includes(idNorm);
            });

            if (!found && !foundOss) {
                const allNames = [
                    ...projectsData.projects.map((p) => p.name),
                    ...projectsData.open_source.map((p) => p.name),
                ];
                return {
                    content: [{
                        type: "text" as const,
                        text: `Project not found.\n\nAvailable projects: ${allNames.join(", ")}`
                    }],
                };
            }

            if (foundOss && !found) {
                const output = `# ${foundOss.name}
**Type:** Open Source Library

${foundOss.summary}

**Stack:** ${foundOss.stack.join(", ")}

**Repo:** ${foundOss.repo}`;

                return {
                    content: [{ type: "text" as const, text: output }],
                };
            }

            const p = found!;
            let output = `# ${p.name}
**Type:** ${p.type} · **Status:** ${p.status} · **Complexity:** ${p.complexity}

## Problem
${p.problem}

## Architecture
${p.architecture}

## Stack
${p.stack.join(", ")}`;

            if (p.tradeoffs) {
                output += `\n\n## Tradeoffs\n${p.tradeoffs}`;
            }

            output += `\n\n## Ownership\n${p.ownership}`;

            if (p.notable_decisions && p.notable_decisions.length > 0) {
                output += `\n\n## Notable Decisions\n${p.notable_decisions.map((d) => `- ${d}`).join("\n")}`;
            }

            if (p.url && p.url !== "#") {
                output += `\n\n## Links\n- Live: ${p.url}`;
            }
            if (p.repo && p.repo !== "#") {
                output += `\n- Repo: ${p.repo}`;
            }

            return {
                content: [{ type: "text" as const, text: output }],
            };
        }
    );
}
