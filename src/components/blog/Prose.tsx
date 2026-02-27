import type { BlogPost } from '@/lib/blog'
import { useCallback } from 'react'

export function Prose({ post }: { post: BlogPost }) {
  const onClick = useCallback(async (e: React.MouseEvent) => {
    const target = e.target as HTMLElement | null
    if (!target) return

    const codeBtn = target.closest?.('button[data-blog-copy="code"]') as HTMLButtonElement | null
    if (codeBtn) {
      const wrapper = codeBtn.closest?.('.blog-codeblock') as HTMLElement | null
      const codeEl = wrapper?.querySelector?.('pre code') as HTMLElement | null
      const text = codeEl?.textContent ?? ''
      if (!text) return
      try {
        await navigator.clipboard.writeText(text)
        const prev = codeBtn.textContent
        codeBtn.textContent = 'Copied'
        codeBtn.setAttribute('aria-label', 'Copied')
        window.setTimeout(() => {
          codeBtn.textContent = prev
          codeBtn.setAttribute('aria-label', 'Copy code to clipboard')
        }, 900)
      } catch {
        // ignore
      }
      return
    }

    const headingBtn = target.closest?.('button.blog-heading-copy') as HTMLButtonElement | null
    if (headingBtn) {
      const id = headingBtn.getAttribute('data-heading-id')
      if (!id) return
      const url = `${window.location.origin}${window.location.pathname}#${id}`
      try {
        await navigator.clipboard.writeText(url)
        const prev = headingBtn.textContent
        headingBtn.textContent = 'Copied'
        headingBtn.setAttribute('aria-label', 'Copied')
        window.setTimeout(() => {
          headingBtn.textContent = prev ?? 'Copy link'
          headingBtn.setAttribute('aria-label', 'Copy link to section')
        }, 1500)
      } catch {
        // ignore
      }
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

