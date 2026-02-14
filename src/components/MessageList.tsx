import ReactMarkdown from 'react-markdown';
import { ProjectCard } from './ProjectCard';
import { ExperienceItem } from './ExperienceItem';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    uiType?: 'cards' | 'timeline' | 'profile' | 'tech_stack' | 'none';
    uiData?: any;
    followUps?: string[];
}

export function MessageList({ messages, loading, onFollowUp }: { messages: Message[], loading: boolean, onFollowUp: (q: string) => void }) {
    return (
        <div className="flex flex-col space-y-8 w-full">
            {messages.map((msg, idx) => (
                <div key={idx} className={`flex flex-col w-full ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in space-y-3`}>

                    {/* Main Bubble */}
                    <div className={`
            responsive-message px-5 py-4 rounded-3xl max-w-[85%] text-sm leading-relaxed shadow-sm
            ${msg.role === 'user'
                            ? 'bg-zinc-800 text-white rounded-tr-sm self-end border border-zinc-700/50'
                            : 'bg-zinc-900/40 text-zinc-100 rounded-tl-sm self-start border border-white/5 backdrop-blur-sm'
                        }
          `}>
                        {/* If assistant, render markdown */}
                        {msg.role === 'assistant' ? (
                            <div className="prose prose-invert prose-sm max-w-none">
                                <ReactMarkdown
                                    components={{
                                        h3: ({ ...props }) => <h3 className="font-display font-medium text-white mb-2 text-base border-b border-white/5 pb-2 inline-block" {...props} />,
                                        strong: ({ ...props }) => <strong className="font-medium text-accent" {...props} />,
                                        a: ({ ...props }) => <a className="text-accent hover:text-white underline underline-offset-4 transition-colors" target="_blank" rel="noopener noreferrer" {...props} />,
                                        code: ({ ...props }) => <code className="bg-zinc-950 px-1.5 py-0.5 rounded text-xs font-mono text-zinc-300 border border-white/5" {...props} />,
                                        ul: ({ ...props }) => <ul className="list-disc pl-4 space-y-1 my-2 marker:text-zinc-600" {...props} />,
                                        li: ({ ...props }) => <li className="pl-1" {...props} />
                                    }}
                                >
                                    {msg.content}
                                </ReactMarkdown>
                            </div>
                        ) : (
                            <p className="font-mono text-xs md:text-sm">{msg.content}</p>
                        )}
                    </div>

                    {/* UI Attachment (Cards, Timeline, etc.) */}
                    {msg.uiType && msg.uiData && (
                        <div className="w-full pl-0 md:pl-4 mt-2 mb-4 animate-fade-in-delayed">
                            {/* Cards Grid */}
                            {msg.uiType === 'cards' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                                    {msg.uiData.map((project: any) => (
                                        <ProjectCard key={project.name} project={project} />
                                    ))}
                                </div>
                            )}

                            {/* Timeline */}
                            {msg.uiType === 'timeline' && (
                                <div className="space-y-6 w-full max-w-2xl bg-zinc-900/20 p-6 rounded-2xl border border-white/5">
                                    {msg.uiData.map((exp: any) => (
                                        <ExperienceItem
                                            key={exp.company}
                                            role={exp.role}
                                            company={exp.company}
                                            period={exp.period}
                                            highlights={exp.highlights}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Tech Stack */}
                            {msg.uiType === 'tech_stack' && (
                                <div className="flex flex-wrap gap-2 animate-fade-in-delayed">
                                    {msg.uiData.map((tech: string) => (
                                        <span key={tech} className="px-3 py-1 bg-zinc-800 rounded-full text-xs font-mono text-zinc-300 border border-zinc-700">
                                            {tech}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Profile Card */}
                            {msg.uiType === 'profile' && (
                                <div className="p-6 bg-gradient-to-br from-zinc-900 via-zinc-900/50 to-black rounded-2xl border border-white/10 max-w-md shadow-xl flex flex-col items-center text-center space-y-4 relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-accent to-transparent opacity-50" />
                                    <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center text-3xl mb-2 shadow-inner border border-white/5 animate-pulse-slow">
                                        👨‍💻
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-display font-bold text-white tracking-tight">{msg.uiData.name}</h3>
                                        <p className="text-sm font-mono text-accent/80 uppercase tracking-widest mt-1">{msg.uiData.title}</p>
                                    </div>
                                    <p className="text-xs md:text-sm text-zinc-400 leading-relaxed px-4">
                                        {msg.uiData.tagline}
                                    </p>
                                    <div className="flex gap-4 pt-4 border-t border-white/5 w-full justify-center">
                                        <SocialIcon href={msg.uiData.github} icon="GH" />
                                        <SocialIcon href={msg.uiData.linkedin} icon="LI" />
                                        <SocialIcon href={msg.uiData.email} icon="MAIL" />
                                        <SocialIcon href={msg.uiData.x} icon="X" />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Suggested Follow Ups */}
                    {msg.role === 'assistant' && msg.followUps && (
                        <div className="flex flex-wrap gap-2 pl-2 animate-fade-in-delayed delay-300">
                            {msg.followUps.map((q) => (
                                <button
                                    key={q}
                                    onClick={() => onFollowUp(q)}
                                    className="px-3 py-1.5 text-xs text-zinc-500 bg-zinc-900/30 border border-white/5 rounded-full hover:text-accent hover:border-accent/30 transition-all font-mono tracking-wide"
                                >
                                    {q} →
                                </button>
                            ))}
                        </div>
                    )}

                </div>
            ))}

            {loading && (
                <div className="flex justify-start w-full animate-pulse px-2">
                    <div className="flex space-x-1.5 items-center p-4 bg-zinc-900/30 rounded-2xl rounded-tl-sm border border-white/5 shadow-sm w-16 h-10">
                        <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                        <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                        <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce"></div>
                    </div>
                </div>
            )}
        </div>
    );
}

function SocialIcon({ href, icon }: { href: string; icon: string }) {
    if (!href) return null;
    return (
        <a
            href={href.startsWith('http') ? href : `mailto:${href}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all border border-zinc-700 hover:border-accent/40"
        >
            {icon}
        </a>
    )
}
