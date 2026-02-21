import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useMemo, useState, useEffect, Suspense } from "react";
const Vani = React.lazy(() => import("@shvm/vani-client/ui").then(m => ({ default: m.Vani })));

const DEFAULT_SERVER_URL = "https://shvm.in";

export const Route = createFileRoute("/vani/playground")({
  component: VaniPlaygroundRoute,
});

function VaniPlaygroundRoute() {
  const [serverUrlDraft, setServerUrlDraft] = useState(DEFAULT_SERVER_URL);
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL);
  const [mode, setMode] = useState<"full" | "pip">("full");
  const [instance, setInstance] = useState(0);

  const vaniKey = useMemo(() => `${instance}:${serverUrl}:${mode}`, [instance, mode, serverUrl]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-black text-zinc-100 overflow-x-hidden">
      <div className="fixed top-0 left-0 right-0 z-[80] bg-black/70 backdrop-blur border-b border-white/5">
        <div className="container-width py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest">vani / playground</p>
              <h1 className="text-xl md:text-2xl font-display font-semibold tracking-tight mt-1">Playground</h1>
            </div>
            <div className="flex gap-2">
              <Link to="/vani/docs" className="btn-secondary">
                Docs
              </Link>
              <Link to="/vani" className="btn-secondary">
                Landing
              </Link>
            </div>
          </div>

          <div className="mt-4 glass-panel rounded-2xl p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="md:col-span-2">
                <label className="block text-xs font-mono text-zinc-500 mb-2 uppercase tracking-widest">serverUrl</label>
                <input
                  value={serverUrlDraft}
                  onChange={(e) => setServerUrlDraft(e.target.value)}
                  placeholder="https://shvm.in"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
                  inputMode="url"
                  autoCapitalize="none"
                  spellCheck={false}
                />
                <p className="mt-2 text-xs text-zinc-500">
                  Applies on (re)mount. Use <span className="text-zinc-300">Apply</span> to remount.
                </p>
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-500 mb-2 uppercase tracking-widest">mode</label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as any)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
                >
                  <option value="full">full</option>
                  <option value="pip">pip</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              <button
                className="btn-primary"
                onClick={() => {
                  setServerUrl(serverUrlDraft.trim() || DEFAULT_SERVER_URL);
                  setInstance((v) => v + 1);
                }}
              >
                Apply
              </button>
              <button className="btn-secondary" onClick={() => setInstance((v) => v + 1)}>
                Reset session
              </button>
              <Link to="/" className="btn-secondary text-center">
                Back to shvm.in
              </Link>
            </div>
          </div>
        </div>
      </div>

      {mounted && (
        <Suspense fallback={<div className="fixed bottom-4 right-4 text-xs text-zinc-500">Loading Vani...</div>}>
          <Vani key={vaniKey} serverUrl={serverUrl} defaultMode={mode} />
        </Suspense>
      )}
    </div>
  );
}

