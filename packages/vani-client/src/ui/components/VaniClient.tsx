import { useState } from "react";
import { useVoiceSession } from "@shvm/vani-client/headless";
import { FullScreenMode } from "../modes/FullScreenMode";
import { PipMode } from "../modes/PipMode";
import type { VoiceConfig } from "@shvm/vani-client/shared";
import type { VaniProps } from "../types";

export default function VaniClient({
    onError,
    onMessage,
    initialTranscript,
    defaultMode = "full",
    mode: controlledMode,
    onModeChange,
    initialConfig,
    serverUrl,
}: VaniProps) {
    const [internalMode, setInternalMode] = useState<"full" | "pip">(defaultMode);
    const [config, setConfig] = useState<VoiceConfig>(
        initialConfig || {
            sttModel: "@cf/openai/whisper-tiny-en",
            llmModel: "@cf/meta/llama-3.1-8b-instruct",
            tts: { model: "@cf/deepgram/aura-2-en", speaker: "luna" },
        },
    );
    const [feedback, setFeedback] = useState<string | null>(null);

    const currentMode = controlledMode ?? internalMode;

    const handleFeedback = (message: string) => {
        setFeedback(message);
        setTimeout(() => setFeedback(null), 3000);
    };

    const session = useVoiceSession({
        onError,
        onMessage,
        initialTranscript,
        config,
        onFeedback: handleFeedback,
        serverUrl,
    });

    const handleToggleMode = () => {
        const newMode = currentMode === "full" ? "pip" : "full";
        if (controlledMode === undefined) {
            setInternalMode(newMode);
        }
        onModeChange?.(newMode);
    };

    return (
        <div className="vani-root">
            {currentMode === "pip" ? (
                <PipMode
                    {...session}
                    onTogglePip={handleToggleMode}
                    config={config}
                    setConfig={setConfig}
                    feedback={feedback}
                />
            ) : (
                <FullScreenMode
                    {...session}
                    onTogglePip={handleToggleMode}
                    config={config}
                    setConfig={setConfig}
                    feedback={feedback}
                />
            )}
        </div>
    );
}
