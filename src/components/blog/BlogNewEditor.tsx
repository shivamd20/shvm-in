import { useState, useCallback, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Link, useRouter } from '@tanstack/react-router'
import { blogChat, humanizeDraft } from '@/lib/blog/blog-ai'

type Message = { role: 'user' | 'assistant'; content: string }

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function BlogNewEditor() {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [markdown, setMarkdown] = useState('')
  const [tags, setTags] = useState('')
  const [date, setDate] = useState(todayISO())
  const [serverPreview, setServerPreview] = useState<string | null>(null)
  const [saveLoading, setSaveLoading] = useState(false)
  const [humanizeLoading, setHumanizeLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chatLoading])

  const lastAssistantMessage = messages.filter((m) => m.role === 'assistant').pop()?.content ?? ''

  const sendChat = useCallback(async () => {
    if (!chatInput.trim() || chatLoading) return
    const userMsg: Message = { role: 'user', content: chatInput.trim() }
    setMessages((prev) => [...prev, userMsg])
    setChatInput('')
    setChatLoading(true)
    setError(null)
    try {
      const history = [...messages, userMsg]
      const reply = await blogChat({
        messages: history,
        context: { title: title || undefined, draftSummary: markdown ? markdown.slice(0, 300) : undefined },
      })
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
    } catch (e) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${e instanceof Error ? e.message : String(e)}` }])
    } finally {
      setChatLoading(false)
    }
  }, [chatInput, chatLoading, messages, title, markdown])

  const useLastAsDraft = useCallback(() => {
    if (lastAssistantMessage) setMarkdown(lastAssistantMessage)
  }, [lastAssistantMessage])

  const appendLastToDraft = useCallback(() => {
    if (lastAssistantMessage) setMarkdown((prev) => (prev ? `${prev}\n\n${lastAssistantMessage}` : lastAssistantMessage))
  }, [lastAssistantMessage])

  const runHumanize = useCallback(async () => {
    if (!markdown.trim() || humanizeLoading) return
    setHumanizeLoading(true)
    setError(null)
    try {
      const result = await humanizeDraft(markdown)
      setMarkdown(result ?? markdown)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Humanize failed')
    } finally {
      setHumanizeLoading(false)
    }
  }, [markdown, humanizeLoading])

  const fetchServerPreview = useCallback(async () => {
    setSaveLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/blog/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Preview failed')
      setServerPreview(data.html ?? '')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Preview failed')
    } finally {
      setSaveLoading(false)
    }
  }, [markdown])

  const save = useCallback(
    async (published: boolean) => {
      if (!title.trim() || !markdown.trim()) {
        setError('Title and markdown are required.')
        return
      }
      setSaveLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/blog/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            slug: slug.trim() || undefined,
            markdown,
            tags: tags.split(/[\s,]+/).filter(Boolean).map((t) => t.toLowerCase().replace(/\s+/g, '-')),
            date: date || todayISO(),
            published,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Save failed')
        await router.navigate({ to: '/blogs/$slug', params: { slug: data.slug } })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Save failed')
      } finally {
        setSaveLoading(false)
      }
    },
    [title, slug, markdown, tags, date, router]
  )

  return (
    <div className="blog-container blog-new-editor">
      <div className="blog-new-editor__grid">
        <div className="blog-new-editor__chat">
          <h2 className="blog-new-editor__chat-title">Chat</h2>
          <p className="blog-new-editor__chat-hint">Ask for intros, sections, or rewrites. Use the buttons below to apply the last reply to your draft.</p>
          <div className="blog-new-editor__messages">
            {messages.length === 0 && (
              <p className="blog-new-editor__messages-empty">Say e.g. &ldquo;Write a short intro about rate limiting&rdquo; or &ldquo;Add a section on tradeoffs&rdquo;.</p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`blog-new-editor__msg blog-new-editor__msg--${m.role}`}>
                <span className="blog-new-editor__msg-role">{m.role === 'user' ? 'You' : 'AI'}</span>
                <div className="blog-new-editor__msg-body">
                  {m.role === 'assistant' ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown> : m.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="blog-new-editor__msg blog-new-editor__msg--assistant">
                <span className="blog-new-editor__msg-role">AI</span>
                <div className="blog-new-editor__msg-body">…</div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="blog-new-editor__chat-input-row">
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendChat()
                }
              }}
              placeholder="Ask for content or ideas…"
              className="blog-new-editor__chat-input"
              rows={2}
              disabled={chatLoading}
            />
            <button type="button" onClick={sendChat} disabled={chatLoading || !chatInput.trim()} className="blog-new-editor__btn blog-new-editor__btn--send">
              Send
            </button>
          </div>
          {lastAssistantMessage && (
            <div className="blog-new-editor__chat-apply">
              <button type="button" onClick={useLastAsDraft} className="blog-new-editor__btn blog-new-editor__btn--preview">
                Use last reply as draft
              </button>
              <button type="button" onClick={appendLastToDraft} className="blog-new-editor__btn blog-new-editor__btn--preview">
                Append last reply
              </button>
            </div>
          )}
        </div>
        <div className="blog-new-editor__draft">
          <h2 className="blog-new-editor__draft-title">Draft</h2>
          <label className="blog-new-editor__label">
            Title
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Post title" className="blog-new-editor__input" />
          </label>
          <label className="blog-new-editor__label">
            Slug (optional)
            <input type="text" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="url-slug" className="blog-new-editor__input" />
          </label>
          <label className="blog-new-editor__label">
            Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="blog-new-editor__input" />
          </label>
          <label className="blog-new-editor__label">
            Tags (comma or space separated)
            <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="system-design, meta" className="blog-new-editor__input" />
          </label>
          <label className="blog-new-editor__label">
            Markdown
            <textarea
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              placeholder="Write or paste content…"
              className="blog-new-editor__textarea"
              spellCheck={false}
            />
          </label>
          <div className="blog-new-editor__actions">
            <button type="button" onClick={runHumanize} disabled={humanizeLoading || !markdown.trim()} className="blog-new-editor__btn blog-new-editor__btn--preview">
              {humanizeLoading ? 'Humanizing…' : 'Humanize draft'}
            </button>
            <button type="button" onClick={fetchServerPreview} disabled={saveLoading} className="blog-new-editor__btn blog-new-editor__btn--preview">
              Preview from server
            </button>
            <button type="button" onClick={() => save(false)} disabled={saveLoading} className="blog-new-editor__btn blog-new-editor__btn--draft">
              Save draft
            </button>
            <button type="button" onClick={() => save(true)} disabled={saveLoading} className="blog-new-editor__btn blog-new-editor__btn--publish">
              Publish
            </button>
          </div>
          {error && (
            <p className="blog-new-editor__error" role="alert">
              {error}
            </p>
          )}
          <div className="blog-new-editor__preview-body blog-prose prose">
            {serverPreview !== null ? (
              <article dangerouslySetInnerHTML={{ __html: serverPreview }} />
            ) : (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown || '*Nothing to preview yet.*'}</ReactMarkdown>
            )}
          </div>
        </div>
      </div>
      <p className="blog-new-editor__back">
        <Link to="/blogs">← Back to blog</Link>
      </p>
    </div>
  )
}
