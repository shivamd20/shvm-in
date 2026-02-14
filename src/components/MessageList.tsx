import ReactMarkdown from 'react-markdown';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export function MessageList({ messages, loading }: { messages: Message[], loading: boolean }) {
    return (
        <div className="flex flex-col space-y-6 pb-20">
            {messages.map((msg, idx) => (
                <div key={idx} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`px-4 py-3 rounded-2xl max-w-[90%] md:max-w-[80%] ${msg.role === 'user'
                            ? 'bg-zinc-800 text-white font-mono text-sm shadow-sm'
                            : 'bg-transparent text-zinc-300 border border-zinc-800/50 w-full prose prose-invert prose-sm max-w-none shadow-sm'
                        }`}>
                        {msg.role === 'assistant' ? (
                            // Use a div wrapper to apply prose styles properly to markdown content
                            <div className="markdown-body">
                                <ReactMarkdown
                                    components={{
                                        // Override default element styling for darker theme if needed
                                        h3: ({ node, ...props }) => <h3 className="text-zinc-100 font-semibold mt-4 mb-2 text-lg border-b border-zinc-800 pb-1" {...props} />,
                                        strong: ({ node, ...props }) => <strong className="text-zinc-100 font-bold" {...props} />,
                                        a: ({ node, ...props }) => <a className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors" target="_blank" rel="noopener noreferrer" {...props} />,
                                        code: ({ node, ...props }) => <code className="bg-zinc-800/50 px-1 py-0.5 rounded text-xs font-mono text-zinc-300" {...props} />,
                                        ul: ({ node, ...props }) => <ul className="list-disc pl-4 space-y-1 my-2" {...props} />,
                                        li: ({ node, ...props }) => <li className="pl-1 marker:text-zinc-600" {...props} />
                                    }}
                                >
                                    {msg.content}
                                </ReactMarkdown>
                            </div>
                        ) : (
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                        )}
                    </div>
                </div>
            ))}
            {loading && (
                <div className="flex justify-start w-full animate-pulse px-4">
                    <div className="flex space-x-2 items-center">
                        <div className="w-2 h-2 bg-zinc-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                        <div className="w-2 h-2 bg-zinc-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                        <div className="w-2 h-2 bg-zinc-600 rounded-full animate-bounce"></div>
                    </div>
                </div>
            )}
        </div>
    );
}
