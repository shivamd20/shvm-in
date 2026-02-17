import { createFileRoute, Link } from "@tanstack/react-router";

const VANICLIENT_GITHUB_URL = "https://github.com/shivamd20/shvm-in/tree/main/packages/vani-client";

export const Route = createFileRoute("/vani/docs")({
  component: VaniDocsRoute,
});

function VaniDocsRoute() {
  return (
    <div className="min-h-screen bg-black text-zinc-100 overflow-x-hidden">
      <div className="container-width py-14">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest">vani / docs</p>
            <h1 className="text-3xl md:text-4xl font-display font-semibold tracking-tight mt-2">Vani docs</h1>
          </div>
          <div className="flex gap-2">
            <Link to="/vani" className="btn-secondary">
              Landing
            </Link>
            <Link to="/vani/playground" className="btn-primary">
              Playground
            </Link>
          </div>
        </div>

        <div className="mt-10 prose prose-invert max-w-none prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-zinc-800">
          <h2>Install</h2>
          <pre>
            <code>npm i @shvm/vani-client</code>
          </pre>

          <h2>Quick start (UI)</h2>
          <pre>
            <code>{`import { Vani } from "@shvm/vani-client/ui";

export function App() {
  return <Vani defaultMode="full" />;
}`}</code>
          </pre>

          <h2>Quick start (headless)</h2>
          <pre>
            <code>{`import { useVoiceSession } from "@shvm/vani-client/headless";

export function VoiceWidget() {
  const voice = useVoiceSession();
  return (
    <div>
      <div>Status: {voice.status}</div>
      <button onClick={voice.connect}>Connect</button>
      <button onClick={voice.cancel}>Cancel</button>
    </div>
  );
}`}</code>
          </pre>

          <h2>Server URL</h2>
          <p>
            <code>useVoiceSession</code> and <code>{`<Vani />`}</code> default to <code>https://shvm.in</code>. Override
            with <code>serverUrl</code> if you’re running your own server.
          </p>

          <h2>Why Vani exists</h2>
          <ul>
            <li>
              Voice UX is brittle when state lives “somewhere else”. Durable Objects make a voice session a first-class,
              stateful primitive.
            </li>
            <li>
              Keep the contract shared: the server and client speak the same typed websocket schema.
            </li>
            <li>
              Reduce per-minute vendor lock-in by making “self-host” a normal path (while still letting you use managed
              providers when it’s the right call).
            </li>
          </ul>

          <h2>Cost notes (rough)</h2>
          <p>
            Vani is designed so the “expensive part” is the model usage, not your control plane. Running it on Cloudflare
            tends to mean you pay for Workers + Durable Objects + Workers AI usage. Exact cost depends on model choice,
            audio volume, and concurrency.
          </p>

          <h2>How it compares (high level)</h2>
          <ul>
            <li>
              <b>Vapi</b>: managed voice agent platform. Faster to ship, higher abstraction. Vani is lower-level and
              self-hostable by default.
            </li>
            <li>
              <b>LiveKit</b>: real-time media infrastructure (WebRTC rooms, SFU). Great for calls/rooms and multi-party.
              Vani is a per-session voice agent runtime over a simple websocket + DO state.
            </li>
          </ul>
          <p className="text-zinc-400">
            These aren’t 1:1 competitors — the right pick depends on whether you need a managed voice platform, a media
            SFU, or a small self-hostable voice-agent runtime.
          </p>

          <h2>Self-host on your Cloudflare account</h2>
          <ol>
            <li>Fork the repo and clone it locally.</li>
            <li>Use Node 22 (TanStack Start targets modern Node in CI).</li>
            <li>
              Install deps: <code>npm ci</code>
            </li>
            <li>
              Login to Cloudflare: <code>npx wrangler login</code>
            </li>
            <li>
              Deploy (site + voice server): <code>npm run deploy</code>
            </li>
          </ol>
          <p>
            Make sure Workers AI is enabled on your Cloudflare account. The worker binds it as <code>env.AI</code> via{" "}
            <code>{`"ai": { "binding": "AI" }`}</code>.
          </p>
          <p>
            The voice websocket route is <code>/ws/:sessionId</code> and is backed by a Durable Object named{" "}
            <code>VOICE_SESSIONS</code> configured in <code>wrangler.jsonc</code>.
          </p>
          <pre>
            <code>{`// wrangler.jsonc (excerpt)
{
  "ai": { "binding": "AI" },
  "durable_objects": {
    "bindings": [
      { "name": "VOICE_SESSIONS", "class_name": "VoiceSessionDO" }
    ]
  },
  "migrations": [
    { "tag": "v2", "new_sqlite_classes": ["VoiceSessionDO"] }
  ]
}`}</code>
          </pre>
          <p>
            The worker routes websocket upgrades in <code>src/server.ts</code> and forwards them to the per-session DO.
          </p>
          <pre>
            <code>{`// src/server.ts (excerpt)
// Voice session websocket route
const wsMatch = url.pathname.match(/^\\/ws\\/([^/]+)$/);
if (wsMatch) {
  const sessionId = wsMatch[1];
  const id = env.VOICE_SESSIONS.idFromName(sessionId);
  const stub = env.VOICE_SESSIONS.get(id);
  return stub.fetch(request);
}`}</code>
          </pre>
          <p>
            After deploying, point your own domain at the worker (Cloudflare dashboard → Workers &amp; Pages → your worker
            → Triggers → Custom Domains). Then set <code>serverUrl</code> in your client/UI to your domain.
          </p>
          <p>
            If you only want the voice server portion, you can keep the same Durable Object and websocket route and
            integrate the client package into a separate UI app — the contract is in{" "}
            <code>@shvm/vani-client/shared</code>.
          </p>
        </div>

        <div className="mt-12 border-t border-white/5 pt-8 flex justify-between items-center gap-4">
          <Link to="/vani" className="text-xs font-mono text-zinc-500 hover:text-accent transition-colors">
            ← Back
          </Link>
          <a
            href={VANICLIENT_GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono text-zinc-500 hover:text-accent transition-colors"
          >
            View client package →
          </a>
        </div>
      </div>
    </div>
  );
}
