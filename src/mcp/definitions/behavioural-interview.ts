import { z } from "zod";
import experience from "../data/experience.json";

export const behaviouralInterviewDefinition = {
    name: "behavioural_interview",
    description: "Return structured professional context for fit evaluation — working style, decision-making approach, collaboration preferences, leadership signals, and growth goals. This is factual/contextual data, not personality simulation.",
    schema: z.object({}),
    handler: async () => {
        const ws = experience.working_style;

        const output = `# Behavioural Interview Context

## Working Style

### Decision Making
${ws.decision_making}

### Collaboration
${ws.collaboration}

## Leadership Signals
${ws.leadership_signals.map((s: string) => `- ${s}`).join("\n")}

## Growth Goals
${ws.growth_goals.map((g: string) => `- ${g}`).join("\n")}

## Career Progression
${experience.experience.map((e) => `- **${e.role}** at ${e.company} (${e.period}) — ${e.impact}`).join("\n")}

## Seniority Signals (by role)
${experience.experience.map((e) => {
            const signals = e.seniority_signals || [];
            return `### ${e.company}\n${signals.map((s: string) => `- ${s}`).join("\n")}`;
        }).join("\n\n")}

---
*This is factual context. The host model should use this data to drive behavioral discussion, not simulate personality.*`;

        return output;
    }
};
