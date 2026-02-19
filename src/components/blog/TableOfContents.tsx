import type { BlogTocItem } from '@/lib/blog/types'

export function TableOfContents({ toc }: { toc: BlogTocItem[] }) {
  if (!toc.length) return null

  return (
    <nav className="blog-toc" aria-label="Table of contents">
      <div className="blog-toc__title">On this page</div>
      <ol className="blog-toc__list">
        {toc.map((item) => (
          <li
            key={item.id}
            className={
              item.depth === 3
                ? 'blog-toc__item blog-toc__item--h3'
                : item.depth === 4
                  ? 'blog-toc__item blog-toc__item--h4'
                  : 'blog-toc__item'
            }
          >
            <a className="blog-toc__link" href={`#${item.id}`}>
              {item.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}

