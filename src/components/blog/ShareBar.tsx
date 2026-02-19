import { useEffect, useMemo, useState } from 'react'

export function ShareBar({ title }: { title: string }) {
  const [copied, setCopied] = useState(false)
  const [url, setUrl] = useState('')

  useEffect(() => {
    setUrl(window.location.href)
  }, [])

  const tweetHref = useMemo(() => {
    if (!url) return 'https://twitter.com/intent/tweet'
    const u = encodeURIComponent(url)
    const t = encodeURIComponent(title)
    return `https://twitter.com/intent/tweet?url=${u}&text=${t}`
  }, [title, url])

  async function onCopy() {
    const target = url || (typeof window !== 'undefined' ? window.location.href : '')
    if (!target) return
    try {
      await navigator.clipboard.writeText(target)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 900)
    } catch {
      // ignore
    }
  }

  return (
    <div className="blog-share" aria-label="Share">
      <button type="button" className="blog-share__btn" onClick={onCopy}>
        {copied ? 'Copied' : 'Copy link'}
      </button>
      <a
        className="blog-share__btn"
        href={tweetHref}
        target="_blank"
        rel="noopener noreferrer"
      >
        Share on X
      </a>
    </div>
  )
}
