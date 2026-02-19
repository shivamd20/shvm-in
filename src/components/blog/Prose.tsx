import type { BlogPost } from '@/lib/blog'
import { useCallback } from 'react'

export function Prose({ post }: { post: BlogPost }) {
  const onClick = useCallback(async (e: React.MouseEvent) => {
    const target = e.target as HTMLElement | null
    if (!target) return

    const btn = target.closest?.('button[data-blog-copy="code"]') as
      | HTMLButtonElement
      | null
    if (!btn) return

    const wrapper = btn.closest?.('.blog-codeblock') as HTMLElement | null
    const codeEl = wrapper?.querySelector?.('pre code') as HTMLElement | null
    const text = codeEl?.textContent ?? ''
    if (!text) return

    try {
      await navigator.clipboard.writeText(text)
      const prev = btn.textContent
      btn.textContent = 'Copied'
      window.setTimeout(() => {
        btn.textContent = prev
      }, 900)
    } catch {
      // ignore
    }
  }, [])

  return (
    <article
      className="blog-prose prose"
      onClick={onClick}
      dangerouslySetInnerHTML={{ __html: post.html }}
    />
  )
}

