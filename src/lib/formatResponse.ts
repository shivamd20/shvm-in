import { SearchResult } from './retrieve';
import { Mode } from '../components/ModeToggle';

export interface FormattedResponse {
    text: string;
    uiType?: 'cards' | 'timeline' | 'profile' | 'tech_stack' | 'none';
    uiData?: any;
    followUps?: string[];
}

export function formatResponse(_query: string, results: SearchResult[], mode: Mode = 'engineer'): FormattedResponse {
    if (results.length === 0) {
        return {
            text: "I don't have specific details on that yet. Try asking about my **Engineering Philosophy**, **Flagship Projects**, or **System Designs**.",
            uiType: 'none',
            followUps: ["Show flagship projects", "Explain engineering philosophy", "View work history"]
        };
    }

    const topResult = results[0];
    const data = topResult.data;

    // Handle Flagship / Stack List
    if (topResult.type === 'flagship' || topResult.type === 'stack') {
        const isStack = topResult.type === 'stack';
        const projects = isStack ? data.projects : data;
        const title = isStack ? data.name : "Flagship Systems";

        let intro = `Here are the **${title}** projects relevant to your query.`;
        if (mode === 'architect') intro = `analyzing **${title}** from a system design perspective:`;

        return {
            text: intro,
            uiType: 'cards',
            uiData: projects, // Array of projects for card rendering
            followUps: projects.map((p: any) => `Tell me about ${p.name}`)
        };
    }

    // Handle Single Project / Open Source
    if (topResult.type === 'project' || topResult.type === 'open_source') {
        const p = data;


        let responseText = "";

        if (mode === 'architect') {
            responseText = `### ${p.name} System Architecture\n\n**Core Problem:** ${p.problem}\n\n**Architecture Decision:**\n${p.architecture}\n\n**Trade-offs:**\n${p.tradeoffs}`;
        } else {
            responseText = `### ${p.name}\n${p.summary}\n\n**Tech Stack:** ${p.stack.join(', ')}`;
        }

        return {
            text: responseText,
            uiType: 'cards',
            uiData: [p], // Single card
            followUps: ["View code", "Architecture deep dive", "Show similar projects"]
        };
    }

    // Handle Experience
    if (topResult.type === 'experience') {
        const exps = Array.isArray(data) ? data : [data];
        return {
            text: `Here is the **Experience Timeline** highlighting key engineering impacts.`,
            uiType: 'timeline',
            uiData: exps,
            followUps: ["Show skills", "Download resume", "Contact for roles"]
        };
    }

    // Handle Profile
    if (topResult.type === 'profile') {
        return {
            text: `**${data.name}**\n${data.title} • ${data.location}\n\n${data.tagline}`,
            uiType: 'profile',
            uiData: data,
            followUps: ["View GitHub", "Connect on LinkedIn", "Email me"]
        };
    }

    return {
        text: "I found some info but I'm not sure how to render it perfectly.",
        uiType: 'none'
    };
}
