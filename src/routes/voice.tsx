
import { createFileRoute } from '@tanstack/react-router';
import React, { Suspense, useState, useEffect } from 'react';
import { VOICE_SYSTEM_PROMPT, VOICE_TOOLS } from '../lib/voice-system-prompt';

const Vani = React.lazy(() => import('../vani').then(m => ({ default: m.Vani })));

export const Route = createFileRoute('/voice')({
    component: VoiceRoute,
});

function VoiceRoute() {
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);

    /**
     * clientTools: the actual JavaScript implementations that run in the browser
     * when the server LLM decides to call them.
     * 
     * NOTE: The tool NAME here must exactly match the `name` field in VOICE_TOOLS below.
     * The server LLM uses VOICE_TOOLS to decide WHEN to call a tool.
     * Once called, the server sends a `tool.execute.request` message to the client,
     * which runs the matching function here and returns the result.
     */
    const clientTools = React.useMemo(() => ({
        changeTheme: async ({ theme }: { theme: "dark" | "light" | "system" }) => {
            console.log("[VoiceRoute] clientTool executed: changeTheme →", theme);
            document.documentElement.classList.remove("dark", "light");
            if (theme !== "system") {
                document.documentElement.classList.add(theme);
            }
            return { success: true, message: `Theme changed to ${theme}` };
        }
    }), []);

    if (!mounted) {
        return <div className="min-h-screen bg-black flex items-center justify-center text-zinc-500">Loading Voice Assistant...</div>;
    }

    return (
        <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-zinc-500">Loading Voice Assistant...</div>}>
            <Vani
                defaultMode="full"
                clientTools={clientTools}
                serverUrl={window.location.origin}
                initialConfig={{
                    /**
                     * VOICE_SYSTEM_PROMPT: Detailed voice-optimised persona prompt from
                     * src/lib/voice-system-prompt.ts. Includes:
                     *  - Shivam's full persona, projects, and work history
                     *  - Per-tool trigger instructions (so LLM knows exactly when to call tools)
                     *  - Voice brevity rules (1-2 sentences max)
                     *  - Anti-abuse / anti-jailbreak guardrails
                     */
                    systemPrompt: VOICE_SYSTEM_PROMPT,
                    /**
                     * VOICE_TOOLS: OpenAI-format tool descriptors. These are sent to the server
                     * and registered with the LLM so it knows what tools exist and when to invoke them.
                     * The actual implementations live in `clientTools` above.
                     */
                    tools: VOICE_TOOLS
                }}
                onError={(err) => {
                    console.group('[Voice Error]');
                    console.error(err);
                    if (typeof err === 'object') {
                        console.error(JSON.stringify(err, null, 2));
                    }
                    console.groupEnd();
                }}
            />
        </Suspense>
    );
}
