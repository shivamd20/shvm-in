import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, useEffect, useRef } from 'react';
import { createMCPConsumer, MCPConsumer, LLMToolDefinition } from '@/lib/mcp-client';

export const Route = createFileRoute('/chat')({
  component: ChatPage,
});

type Message = { role: 'user' | 'assistant'; content: string };

const SERVER_URL = 'https://shvm.in/mcp';

function extractText(output: unknown): string {
  if (output == null) return '';
  const arr = Array.isArray(output) ? output : (output as { content?: unknown[] })?.content;
  if (!Array.isArray(arr) || arr.length === 0) return '';
  const first = arr[0];
  if (first && typeof first === 'object' && 'text' in first && typeof (first as { text: string }).text === 'string') {
    return (first as { text: string }).text;
  }
  return String(output);
}

function resolveChatToolName(tools: LLMToolDefinition[]): string | null {
  if (tools.length === 0) return null;
  if (tools.length === 1) return tools[0].name;
  const chatTool = tools.find((t) => t.name === 'chat' || t.name.includes('chat'));
  return chatTool?.name ?? null;
}

function ChatPage() {
  const [mcp, setMcp] = useState<MCPConsumer | null>(null);
  const [chatToolName, setChatToolName] = useState<string | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [errorMsg, setErrorMsg] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    createMCPConsumer({ servers: [SERVER_URL] })
      .then((instance) => {
        if (cancelled) return;
        setMcp(instance);
        const tools = instance.getTools();
        setChatToolName(resolveChatToolName(tools));
        setStatus('connected');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStatus('error');
        setErrorMsg(err instanceof Error ? err.message : String(err));
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function handleSend() {
    if (!input.trim() || !mcp || loading || !chatToolName) return;

    const userMessage: Message = { role: 'user', content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    const history = [...messages, userMessage].map((m) => ({ role: m.role, content: m.content }));

    try {
      const result = await mcp.execute({ name: chatToolName, arguments: { messages: history } });
      const reply = result.success ? extractText(result.output) : (result.error ?? 'Request failed.');
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (e) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${e instanceof Error ? e.message : String(e)}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-screen max-h-screen bg-neutral-950 text-neutral-200 overflow-hidden">
      {/* Header: fixed height, no shrink */}
      <header className="shrink-0 flex items-center justify-between gap-4 px-4 py-3 border-b border-neutral-800 bg-neutral-900/80">
        <Link to="/" className="text-sm font-mono text-neutral-400 hover:text-white transition-colors">
          ← Home
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs text-neutral-500">
            {status === 'connected' && chatToolName ? 'MCP · chat' : status === 'error' ? 'Error' : 'Connecting…'}
          </span>
          <Link to="/mcp-playground" className="text-xs font-mono text-neutral-500 hover:text-accent transition-colors">
            Playground
          </Link>
        </div>
      </header>

      {errorMsg && (
        <div className="shrink-0 px-4 py-2 bg-red-950/50 border-b border-red-900/50 text-red-300 text-sm">
          {errorMsg}
        </div>
      )}

      {/* Messages: scrollable, flex-1 with min-h-0 so it can shrink and scroll */}
      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
      >
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          {messages.length === 0 && !loading && (
            <p className="text-neutral-500 text-sm">Send a message to start. Replies use the MCP server (context from this site).</p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                  m.role === 'user' ? 'bg-blue-900/40 text-blue-100' : 'bg-neutral-800 text-neutral-200'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-lg px-3 py-2 text-sm text-neutral-500">…</div>
            </div>
          )}
          <div ref={messagesEndRef} aria-hidden />
        </div>
      </div>

      {/* Input: fixed at bottom, shrink-0 */}
      <div className="shrink-0 border-t border-neutral-800 bg-neutral-900/80 p-4">
        <div className="max-w-2xl mx-auto flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Message…"
            disabled={!chatToolName || loading}
            className="flex-1 min-w-0 bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || !chatToolName || loading}
            className="shrink-0 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-medium"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
