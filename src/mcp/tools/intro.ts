import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import profile from "../data/profile.json";
import experience from "../data/experience.json";

export function registerIntroTool(server: McpServer) {
    server.tool(
        "intro",
        "Get a concise introduction to Shivam Dwivedi — current role, engineering style, systems built, and career intent. Best used as a first contact tool.",
        {},
        async () => {
            const currentRole = experience.experience[0];

            const output = `# ${profile.name}
**${profile.title}** · ${profile.location}

> ${profile.tagline}

## Current Focus
${profile.current_focus.map((f: string) => `- ${f}`).join("\n")}

## Engineering Style
${profile.engineering_style.philosophy}

**Strengths:** ${profile.engineering_style.strengths.join(", ")}

**Approach:** ${profile.engineering_style.approach}

## Current Role
**${currentRole.role}** at **${currentRole.company}** (${currentRole.period})
${currentRole.highlights.map((h: string) => `- ${h}`).join("\n")}

## Career Intent
${profile.career_intent}

## Experience
${profile.years_of_experience} years · ${profile.education}

## Links
- Website: ${profile.website}
- GitHub: ${profile.github}
- LinkedIn: ${profile.linkedin}
- X: ${profile.x}`;

            return {
                content: [{ type: "text" as const, text: output }],
            };
        }
    );
}
