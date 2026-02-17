import { createFileRoute, Link } from "@tanstack/react-router";

const VANICLIENT_GITHUB_URL = "https://github.com/shivamd20/shvm-in/tree/main/packages/vani-client";
const VANICLIENT_NPM_URL = "https://www.npmjs.com/package/@shvm/vani-client";

export const Route = createFileRoute("/vani")({
  component: VaniLandingRoute,
});

function VaniLandingRoute() {
  return (
    <div className="min-h-screen bg-black text-zinc-100 overflow-x-hidden">
      <div className="container-width py-16">
        <div className="flex items-start justify-between gap-6">
          <div className="space-y-3">
            <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest">vani</p>
            <h1 className="text-4xl md:text-5xl font-display font-semibold tracking-tight">
              Vani <span className="text-accent">Voice</span>
            </h1>
            <p className="text-zinc-400 max-w-2xl leading-relaxed">
              A Cloudflare-native voice session runtime (Durable Objects + Workers AI) with a shared client contract, a
              headless React hook, and an optional UI layer.
            </p>
          </div>

          <div className="hidden md:flex items-center gap-2">
            <a className="btn-secondary" href={VANICLIENT_GITHUB_URL} target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
            <a className="btn-secondary" href={VANICLIENT_NPM_URL} target="_blank" rel="noopener noreferrer">
              npm
            </a>
          </div>
        </div>

        <div className="mt-10 flex flex-col sm:flex-row gap-3">
          <Link to="/vani/docs" className="btn-primary text-center">
            Read docs
          </Link>
          <Link to="/vani/playground" className="btn-secondary text-center">
            Open playground
          </Link>
          <Link to="/" className="btn-secondary text-center">
            Back to shvm.in
          </Link>
        </div>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card title="@shvm/vani-client/shared">
            <p className="text-sm text-zinc-400 leading-relaxed">
              Types + websocket contract to keep client/server in lockstep.
            </p>
          </Card>
          <Card title="@shvm/vani-client/headless">
            <p className="text-sm text-zinc-400 leading-relaxed">
              A React hook + client state machine for managing session lifecycle.
            </p>
          </Card>
          <Card title="@shvm/vani-client/ui">
            <p className="text-sm text-zinc-400 leading-relaxed">A mobile-friendly reference UI.</p>
            <p className="text-xs text-zinc-500 mt-3 leading-relaxed">
              Styling is currently inherited from the host app’s Tailwind/CSS (isolation later).
            </p>
          </Card>
        </div>

        <div className="mt-14 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card title="Motivation">
            <p className="text-sm text-zinc-400 leading-relaxed">
              Make the voice session a first-class, stateful primitive (Durable Object per session) and keep client and
              server locked via a shared typed contract.
            </p>
          </Card>
          <Card title="Cost Model (rough)">
            <p className="text-sm text-zinc-400 leading-relaxed">
              Aim for a cheap control plane (Workers + DOs) and push costs into model usage. Your bill depends on model
              choice, audio volume, and concurrency.
            </p>
          </Card>
          <Card title="Compared To">
            <p className="text-sm text-zinc-400 leading-relaxed">
              Vapi is a managed voice platform; LiveKit is a real-time media SFU. Vani is a small, self-hostable voice
              agent runtime over websocket + DO state.
            </p>
          </Card>
        </div>

        <div className="mt-16 border-t border-white/5 pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-xs font-mono text-zinc-600">
            Default server: <span className="text-zinc-300">https://shvm.in</span>
          </p>
          <div className="flex gap-3">
            <Link to="/voice" className="text-xs font-mono text-zinc-500 hover:text-accent transition-colors">
              Try /voice →
            </Link>
            <Link to="/vani-headless" className="text-xs font-mono text-zinc-500 hover:text-accent transition-colors">
              Try headless →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-panel rounded-2xl p-6">
      <h2 className="text-lg font-display font-semibold text-white">{title}</h2>
      <div className="mt-3">{children}</div>
    </div>
  );
}
