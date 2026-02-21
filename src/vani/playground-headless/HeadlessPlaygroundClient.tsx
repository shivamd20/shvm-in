import { useMemo, useState } from "react";
import { useVoiceSession } from "@shvm/vani-client/headless";

export default function HeadlessPlaygroundClient() {
    const [text, setText] = useState("");

    const session = useVoiceSession({
        onError: (err) => console.error("[Vani Headless Playground] Error:", err),
    });

    const canSendText = session.status !== "disconnected" && session.status !== "connecting" && text.trim().length > 0;

    const transcript = useMemo(() => session.transcript ?? [], [session.transcript]);

    return (
        <div>
            <h1>Vani Headless Playground</h1>

            <div>
                <div>Status: {session.status}</div>
                <div>Server: {session.serverStatus}</div>
                <div>VAD loading: {String(session.vadLoading)}</div>
                <div>VAD listening: {String(session.vadListening)}</div>
                <div>User speaking: {String(session.userSpeaking)}</div>
                {session.error ? <div>Error: {session.error}</div> : null}
            </div>

            <hr />

            <div>
                <button type="button" onClick={session.connect} disabled={session.status !== "disconnected" && session.status !== "error"}>
                    Connect
                </button>
                <button type="button" onClick={session.disconnect} disabled={session.status === "disconnected"}>
                    Disconnect
                </button>
                <button type="button" onClick={session.cancel} disabled={session.status !== "processing" && session.status !== "speaking"}>
                    Cancel/Reset
                </button>
            </div>

            <hr />

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    if (!canSendText) return;
                    session.sendMessage(text.trim());
                    setText("");
                }}
            >
                <label>
                    Text message:
                    <input value={text} onChange={(e) => setText(e.target.value)} />
                </label>
                <button type="submit" disabled={!canSendText}>
                    Send
                </button>
            </form>

            <hr />

            <h2>Transcript</h2>
            {transcript.length === 0 ? (
                <div>(empty)</div>
            ) : (
                <ul>
                    {transcript.map((m) => (
                        <li key={m.id}>
                            <strong>{m.role}:</strong> {m.content}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
