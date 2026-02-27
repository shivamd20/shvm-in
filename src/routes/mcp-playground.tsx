import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import {
  createMCPConsumer,
  MCPConsumer,
  LLMToolDefinition,
  ExecutionTrace,
} from '@/lib/mcp-client';
import { ChevronDown, ChevronRight, Server, Wrench, Activity, Play } from 'lucide-react';

export const Route = createFileRoute('/mcp-playground')({
  component: MCPPlayground,
});

function MCPPlayground() {
  const [mcp, setMcp] = useState<MCPConsumer | null>(null);
  const [tools, setTools] = useState<LLMToolDefinition[]>([]);
  const [trace, setTrace] = useState<ExecutionTrace[]>([]);
  const [serverUrl, setServerUrl] = useState('https://shvm.in/mcp');
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedTool, setSelectedTool] = useState('');
  const [inputJson, setInputJson] = useState('{\n  \n}');
  const [runLoading, setRunLoading] = useState(false);

  async function connect() {
    setStatus('connecting');
    setErrorMsg('');
    try {
      const instance = await createMCPConsumer({ servers: [serverUrl] });
      setMcp(instance);
      setTools(instance.getTools());
      setStatus('connected');
      setTrace([]);
      if (instance.getTools().length > 0 && !selectedTool) {
        setSelectedTool(instance.getTools()[0].name);
      }
    } catch (err: unknown) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    connect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRunTool() {
    if (!mcp || !selectedTool) return;
    let parsed: Record<string, unknown> = {};
    try {
      if (inputJson.trim()) parsed = JSON.parse(inputJson) as Record<string, unknown>;
    } catch {
      alert('Invalid JSON input');
      return;
    }
    setRunLoading(true);
    await mcp.execute({ name: selectedTool, arguments: parsed });
    setTrace(mcp.getTrace());
    setRunLoading(false);
  }

  useEffect(() => {
    if (selectedTool && tools.length > 0) {
      const t = tools.find((x) => x.name === selectedTool);
      if (t?.parameters && typeof t.parameters === 'object' && t.parameters.properties) {
        const props = (t.parameters as { properties?: Record<string, { type?: string }> }).properties ?? {};
        const dummy: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(props)) {
          dummy[k] = v?.type === 'string' ? '' : v?.type === 'number' ? 0 : null;
        }
        setInputJson(JSON.stringify(dummy, null, 2));
      }
    }
  }, [selectedTool, tools]);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 p-6 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">MCP Playground</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Use any tool from the MCP server below, or chat (powered by the same server).
          </p>
        </div>

        <ServerPanel
          serverUrl={serverUrl}
          setServerUrl={setServerUrl}
          status={status}
          errorMsg={errorMsg}
          onConnect={connect}
          toolsCount={tools.length}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ToolList tools={tools} />
          <div className="space-y-6">
            <ToolRunner
              tools={tools}
              selectedTool={selectedTool}
              setSelectedTool={setSelectedTool}
              inputJson={inputJson}
              setInputJson={setInputJson}
              onRun={handleRunTool}
              running={runLoading}
            />
<TraceViewer trace={trace} onClear={() => setTrace([])} />
        </div>
        </div>

        <div className="border border-neutral-800 rounded-xl bg-neutral-900/50 p-5">
          <h2 className="text-lg font-semibold text-white mb-1">Chat</h2>
          <p className="text-sm text-neutral-400 mb-3">
            Chat with site context (blogs, projects, profile) via the MCP server — on a separate page with proper scroll.
          </p>
          <Link
            to="/chat"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            Open chat page
          </Link>
        </div>
      </div>
    </div>
  );
}

function ServerPanel({
  serverUrl,
  setServerUrl,
  status,
  errorMsg,
  onConnect,
  toolsCount,
}: {
  serverUrl: string;
  setServerUrl: (v: string) => void;
  status: string;
  errorMsg: string;
  onConnect: () => void;
  toolsCount: number;
}) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Server className="w-5 h-5 text-blue-400" />
        <h2 className="text-xl font-semibold text-white">Server</h2>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={serverUrl}
          onChange={(e) => setServerUrl(e.target.value)}
          className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
          placeholder="https://shvm.in/mcp"
        />
        <button
          onClick={onConnect}
          disabled={status === 'connecting'}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium whitespace-nowrap"
        >
          {status === 'connecting' ? 'Connecting…' : 'Connect'}
        </button>
      </div>
      <div className="mt-4 flex items-center gap-4 text-sm">
        <span className="text-neutral-500">Status:</span>
        {status === 'connected' && <span className="text-green-400">Connected</span>}
        {status === 'connecting' && <span className="text-yellow-400">Connecting…</span>}
        {status === 'error' && <span className="text-red-400">Error</span>}
        {status === 'disconnected' && <span className="text-neutral-400">Disconnected</span>}
        {status === 'connected' && (
          <span className="border-l border-neutral-800 pl-4 text-neutral-500">
            Tools: <span className="font-mono text-blue-400">{toolsCount}</span>
          </span>
        )}
      </div>
      {errorMsg && (
        <div className="mt-3 p-3 bg-red-950/50 border border-red-900/50 rounded-lg text-red-400 text-sm">
          {errorMsg}
        </div>
      )}
    </div>
  );
}

function ToolList({ tools }: { tools: LLMToolDefinition[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-sm flex flex-col min-h-[280px]">
      <div className="flex items-center gap-2 mb-4">
        <Wrench className="w-5 h-5 text-emerald-400" />
        <h2 className="text-xl font-semibold text-white">Discovered tools</h2>
      </div>
      <div className="overflow-y-auto space-y-2 flex-1">
        {tools.length === 0 ? (
          <p className="text-neutral-500 text-sm italic">No tools loaded. Connect to a server.</p>
        ) : (
          tools.map((t) => (
            <div key={t.name} className="border border-neutral-800 bg-neutral-950/50 rounded-lg overflow-hidden">
              <button
                onClick={() => setExpanded(expanded === t.name ? null : t.name)}
                className="w-full flex items-start gap-3 p-3 text-left hover:bg-neutral-800/50"
              >
                {expanded === t.name ? <ChevronDown className="w-4 h-4 mt-0.5" /> : <ChevronRight className="w-4 h-4 mt-0.5" />}
                <div>
                  <div className="font-mono text-sm text-emerald-400 font-medium">{t.name}</div>
                  <div className="text-sm text-neutral-400 line-clamp-2">{t.description}</div>
                </div>
              </button>
              {expanded === t.name && (
                <div className="p-4 border-t border-neutral-800 bg-neutral-950 text-xs font-mono text-neutral-300 overflow-x-auto">
                  <pre>{JSON.stringify(t.parameters, null, 2)}</pre>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ToolRunner({
  tools,
  selectedTool,
  setSelectedTool,
  inputJson,
  setInputJson,
  onRun,
  running,
}: {
  tools: LLMToolDefinition[];
  selectedTool: string;
  setSelectedTool: (v: string) => void;
  inputJson: string;
  setInputJson: (v: string) => void;
  onRun: () => void;
  running: boolean;
}) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Play className="w-5 h-5 text-purple-400" />
        <h2 className="text-xl font-semibold text-white">Run tool</h2>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-neutral-500 uppercase mb-2">Tool</label>
          <select
            value={selectedTool}
            onChange={(e) => setSelectedTool(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
          >
            <option value="">— Select —</option>
            {tools.map((t) => (
              <option key={t.name} value={t.name}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-500 uppercase mb-2">Arguments (JSON)</label>
          <textarea
            value={inputJson}
            onChange={(e) => setInputJson(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm font-mono text-green-300 h-32 focus:outline-none focus:border-purple-500"
          />
        </div>
        <button
          onClick={onRun}
          disabled={!selectedTool || running}
          className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          {running ? 'Running…' : 'Run'}
        </button>
      </div>
    </div>
  );
}

function TraceViewer({ trace, onClear }: { trace: ExecutionTrace[]; onClear: () => void }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-sm flex flex-col max-h-[320px]">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-orange-400" />
          <h2 className="text-xl font-semibold text-white">Trace</h2>
        </div>
        <button onClick={onClear} className="text-xs text-neutral-400 hover:text-white">
          Clear
        </button>
      </div>
      <div className="overflow-y-auto space-y-2 flex-1">
        {trace.length === 0 ? (
          <p className="text-neutral-500 text-sm italic">No runs yet.</p>
        ) : (
          trace.map((item, idx) => (
            <div
              key={idx}
              className={`border rounded-lg overflow-hidden ${item.error ? 'border-red-900/50 bg-red-950/20' : 'border-neutral-800 bg-neutral-950/50'}`}
            >
              <button
                onClick={() => setExpanded(expanded === idx ? null : idx)}
                className="w-full flex items-center justify-between p-3 text-left hover:bg-neutral-800/50"
              >
                <div className="flex items-center gap-3">
                  {expanded === idx ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <div>
                    <div className={`font-mono text-sm font-medium ${item.error ? 'text-red-400' : 'text-orange-400'}`}>
                      {item.toolName}
                    </div>
                    <div className="text-xs text-neutral-500">{item.durationMs}ms</div>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${item.error ? 'bg-red-900/50 text-red-300' : 'bg-green-900/50 text-green-300'}`}>
                  {item.error ? 'error' : 'ok'}
                </span>
              </button>
              {expanded === idx && (
                <div className="p-4 border-t border-neutral-800 bg-neutral-950 text-xs font-mono space-y-3 overflow-x-auto">
                  <div>
                    <div className="text-neutral-500 uppercase text-[10px] mb-1">Input</div>
                    <pre className="text-green-300/80">{JSON.stringify(item.input, null, 2)}</pre>
                  </div>
                  {item.output !== undefined && (
                    <div>
                      <div className="text-neutral-500 uppercase text-[10px] mb-1">Output</div>
                      <pre className="text-blue-300/80 whitespace-pre-wrap">
                        {typeof item.output === 'string' ? item.output : JSON.stringify(item.output, null, 2)}
                      </pre>
                    </div>
                  )}
                  {item.error && (
                    <div>
                      <div className="text-red-500/80 uppercase text-[10px] mb-1">Error</div>
                      <pre className="text-red-400 whitespace-pre-wrap">{item.error}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

