import { z } from "zod";
import experience from "../../data/experience.json";
import profile from "../../data/profile.json";

export const profileFitAssessmentDefinition = {
    name: "profile_fit_assessment",
    description: "Provide explicit context about what Shivam wants to work on, preferred environment, seniority expectations, and long-term goals. Centralizes intent and alignment data for recruiters and hiring managers.",
    schema: z.object({}),
    handler: async () => {
        const fit = experience.fit_assessment;

        const output = `# Profile Fit Assessment

## What Shivam Wants to Work On
${fit.wants_to_work_on.map((w: string) => `- ${w}`).join("\n")}

## Preferred Environment
${fit.preferred_environment.map((e: string) => `- ${e}`).join("\n")}

## Seniority Expectations
${fit.seniority_expectations}

## Long-Term Goals
${fit.long_term_goals.map((g: string) => `- ${g}`).join("\n")}

## Quick Facts
- **Current Role:** ${profile.title}
- **Location:** ${profile.location}
- **Years of Experience:** ${profile.years_of_experience}
- **Education:** ${profile.education}

## Engineering Identity
${profile.engineering_style.philosophy}

**Core Strengths:** ${profile.engineering_style.strengths.join(", ")}

---
*This tool centralizes intent and alignment data. Use it to evaluate mutual fit.*`;

        return output;
    }
};
