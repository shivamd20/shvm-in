import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { createMCPConsumer, MCPConsumer, LLMToolDefinition, ExecutionTrace } from '@/lib/mcp-client';
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

    async function connect() {
        setStatus('connecting');
        setErrorMsg('');
        try {
            const instance = await createMCPConsumer({ servers: [serverUrl] });
            setMcp(instance);
            setTools(instance.getTools());
            setStatus('connected');
            // If we re-connected, traces are reset in this new instance, so clear UI trace
            setTrace([]);
        } catch (err: any) {
            setStatus('error');
            setErrorMsg(err.message || String(err));
        }
    }

    useEffect(() => {
        connect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function runTool(toolName: string, inputProps: any) {
        if (!mcp) return;
        await mcp.execute({ name: toolName, arguments: inputProps });
        setTrace(mcp.getTrace());
    }

    return (
        <div className="min-h-screen bg-neutral-950 text-neutral-200 p-8 font-sans">
            <div className="max-w-5xl mx-auto space-y-6">
                <h1 className="text-3xl font-bold tracking-tight text-white mb-2">MCP Consumer Playground</h1>
                <p className="text-neutral-400 mb-8">
                    A pure developer diagnostics surface for testing MCP Server integration, normalization, and execution.
                </p>

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
                        <ToolRunner tools={tools} onRun={runTool} />
                        <TraceViewer trace={trace} onClear={() => setTrace([])} />
                    </div>
                </div>
            </div>
        </div>
    );
}

function ServerPanel({ serverUrl, setServerUrl, status, errorMsg, onConnect, toolsCount }: any) {
    return (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
                <Server className="w-5 h-5 text-blue-400" />
                <h2 className="text-xl font-semibold text-white">Server Connection</h2>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
                <input
                    type="text"
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                    className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                    placeholder="https://example.com/sse"
                />
                <button
                    onClick={onConnect}
                    disabled={status === 'connecting'}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                >
                    {status === 'connecting' ? 'Connecting...' : 'Connect'}
                </button>
            </div>
            <div className="mt-4 flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                    <span className="text-neutral-500">Status:</span>
                    {status === 'disconnected' && <span className="text-neutral-400">Disconnected</span>}
                    {status === 'connecting' && <span className="text-yellow-400">Connecting...</span>}
                    {status === 'connected' && <span className="text-green-400">Connected</span>}
                    {status === 'error' && <span className="text-red-400">Error</span>}
                </div>
                {status === 'connected' && (
                    <div className="flex items-center gap-2 border-l border-neutral-800 pl-4">
                        <span className="text-neutral-500">Available Tools:</span>
                        <span className="font-mono text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded">{toolsCount}</span>
                    </div>
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
    return (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-sm h-[600px] flex flex-col">
            <div className="flex items-center gap-2 mb-4 shrink-0">
                <Wrench className="w-5 h-5 text-emerald-400" />
                <h2 className="text-xl font-semibold text-white">Discovered Tools</h2>
            </div>
            <div className="overflow-y-auto pr-2 space-y-3 flex-1 custom-scrollbar">
                {tools.length === 0 ? (
                    <div className="text-neutral-500 text-sm italic py-4 text-center">No tools loaded.</div>
                ) : (
                    tools.map((t) => <ToolCard key={t.name} tool={t} />)
                )}
            </div>
        </div>
    );
}

function ToolCard({ tool }: { tool: LLMToolDefinition }) {
    const [expanded, setExpanded] = useState(false);
    return (
        <div className="border border-neutral-800 bg-neutral-950/50 rounded-lg overflow-hidden transition-all">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-start gap-3 p-3 text-left hover:bg-neutral-800/50 transition-colors"
            >
                <div className="mt-0.5 text-neutral-500">
                    {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </div>
                <div>
                    <div className="font-mono text-sm text-emerald-400 font-medium mb-1">{tool.name}</div>
                    <div className="text-sm text-neutral-400 line-clamp-2">{tool.description}</div>
                </div>
            </button>
            {expanded && (
                <div className="p-4 border-t border-neutral-800 bg-neutral-950 text-xs text-neutral-300 font-mono overflow-x-auto">
                    <div className="mb-2 text-neutral-500 uppercase tracking-wider text-[10px]">Parameters Schema</div>
                    <pre>{JSON.stringify(tool.parameters, null, 2)}</pre>
                </div>
            )}
        </div>
    );
}

function ToolRunner({ tools, onRun }: { tools: LLMToolDefinition[]; onRun: (name: string, input: any) => Promise<void> }) {
    const [selectedTool, setSelectedTool] = useState('');
    const [inputJson, setInputJson] = useState('{\n  \n}');
    const [running, setRunning] = useState(false);

    async function handleRun() {
        if (!selectedTool) return;
        let parsed = {};
        try {
            if (inputJson.trim() !== '') parsed = JSON.parse(inputJson);
        } catch {
            alert('Invalid JSON input parameters');
            return;
        }
        setRunning(true);
        await onRun(selectedTool, parsed);
        setRunning(false);
    }

    // Auto-fill template if tool is selected
    useEffect(() => {
        if (selectedTool) {
            const t = tools.find(x => x.name === selectedTool);
            if (t) {
                // Create dummy object from schema properties
                const props = (t.parameters as any)?.properties || {};
                const dummy: any = {};
                for (const [k, v] of Object.entries(props)) {
                    dummy[k] = (v as any).type === 'string' ? '' : (v as any).type === 'number' ? 0 : null;
                }
                setInputJson(JSON.stringify(dummy, null, 2));
            }
        }
    }, [selectedTool, tools]);

    return (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
                <Play className="w-5 h-5 text-purple-400" />
                <h2 className="text-xl font-semibold text-white">Manual Execution</h2>
            </div>
            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-semibold text-neutral-500 uppercase mb-2">Select Tool</label>
                    <select
                        value={selectedTool}
                        onChange={(e) => setSelectedTool(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                    >
                        <option value="">-- Choose a tool --</option>
                        {tools.map(t => (
                            <option key={t.name} value={t.name}>{t.name}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-neutral-500 uppercase mb-2">Input Arguments (JSON)</label>
                    <textarea
                        value={inputJson}
                        onChange={e => setInputJson(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm font-mono text-green-300 h-32 focus:outline-none focus:border-purple-500"
                    />
                </div>
                <button
                    onClick={handleRun}
                    disabled={!selectedTool || running}
                    className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                    {running ? 'Executing...' : 'Run Tool'}
                </button>
            </div>
        </div>
    );
}

function TraceViewer({ trace, onClear }: { trace: ExecutionTrace[]; onClear: () => void }) {
    return (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-sm flex flex-col" style={{ maxHeight: '400px' }}>
            <div className="flex items-center justify-between mb-4 shrink-0">
                <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-orange-400" />
                    <h2 className="text-xl font-semibold text-white">Execution Trace</h2>
                </div>
                <button onClick={onClear} className="text-xs text-neutral-400 hover:text-white transition-colors">
                    Clear
                </button>
            </div>
            <div className="overflow-y-auto pr-2 space-y-3 flex-1 custom-scrollbar">
                {trace.length === 0 ? (
                    <div className="text-neutral-500 text-sm italic py-4 text-center">No executions yet.</div>
                ) : (
                    trace.map((item, idx) => <TraceCard key={idx} item={item} />)
                )}
            </div>
        </div>
    );
}

function TraceCard({ item }: { item: ExecutionTrace }) {
    const [expanded, setExpanded] = useState(false);
    return (
        <div className={`border rounded-lg overflow-hidden transition-all ${item.error ? 'border-red-900/50 bg-red-950/20' : 'border-neutral-800 bg-neutral-950/50'}`}>
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between p-3 text-left hover:bg-neutral-800/50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="text-neutral-500">
                        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </div>
                    <div>
                        <div className={`font-mono text-sm font-medium ${item.error ? 'text-red-400' : 'text-orange-400'}`}>
                            {item.toolName}
                        </div>
                        <div className="text-xs text-neutral-500 mt-0.5">
                            {(new Date(item.timestamp)).toLocaleTimeString()}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-neutral-500 border border-neutral-800 px-2 py-0.5 rounded bg-neutral-900">
                        {item.durationMs}ms
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded ${item.error ? 'bg-red-900/50 text-red-300' : 'bg-green-900/50 text-green-300'}`}>
                        {item.error ? 'error' : 'success'}
                    </span>
                </div>
            </button>
            {expanded && (
                <div className="p-4 border-t border-neutral-800 bg-neutral-950 text-xs text-neutral-300 font-mono space-y-4 overflow-x-auto">
                    <div>
                        <div className="text-neutral-500 uppercase tracking-wider text-[10px] mb-1">Input</div>
                        <pre className="text-green-300/80">{JSON.stringify(item.input, null, 2)}</pre>
                    </div>
                    {item.output !== undefined && (
                        <div>
                            <div className="text-neutral-500 uppercase tracking-wider text-[10px] mb-1">Output</div>
                            <pre className="text-blue-300/80 whitespace-pre-wrap">{typeof item.output === 'string' ? item.output : JSON.stringify(item.output, null, 2)}</pre>
                        </div>
                    )}
                    {item.error !== undefined && (
                        <div>
                            <div className="text-red-500/80 uppercase tracking-wider text-[10px] mb-1">Error</div>
                            <pre className="text-red-400 whitespace-pre-wrap">{item.error}</pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
