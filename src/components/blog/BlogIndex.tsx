import type { BlogPostMeta } from '@/lib/blog/types'
import { Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { TagChip } from './TagChip'

type TagEntry = { tag: string; count: number; slugs: string[] }

function matchQuery(q: string, post: { title: string; summary: string; tags: string[] }) {
  const lower = q.trim().toLowerCase()
  if (!lower) return true
  if (post.title.toLowerCase().includes(lower)) return true
  if (post.summary.toLowerCase().includes(lower)) return true
  if (post.tags.some((t) => t.toLowerCase().includes(lower))) return true
  return false
}

export function BlogIndex({
  posts,
  tags,
}: {
  posts: BlogPostMeta[]
  tags: TagEntry[]
}) {
  const [search, setSearch] = useState('')

  const filteredPosts = useMemo(
    () => (search.trim() ? posts.filter((p) => matchQuery(search, p)) : posts),
    [posts, search]
  )

  return (
    <div className="blog-container blog-index">
      <header className="blog-index__hero">
        <h1 id="blog-index-title" className="blog-index__title">
          Blog
        </h1>
        <p className="blog-index__subtitle">Notes on systems and product engineering.</p>
      </header>

      <div className="blog-index__toolbar">
        <label htmlFor="blog-search" className="blog-index__search-label">
          Search posts
        </label>
        <input
          id="blog-search"
          type="search"
          placeholder="Search by title, summary, or tag…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="blog-index__search"
          autoComplete="off"
          aria-describedby="blog-search-results"
        />
        <p id="blog-search-results" className="blog-index__search-results" aria-live="polite">
          {search.trim()
            ? `${filteredPosts.length} ${filteredPosts.length === 1 ? 'post' : 'posts'}`
            : ''}
        </p>
      </div>

      {tags.length > 0 && (
        <nav className="blog-index__tags" aria-label="Filter by tag">
          <h2 className="blog-index__tagsTitle">Tags</h2>
          <ul className="blog-index__tagsList">
            {tags.map((t) => (
              <li key={t.tag}>
                <Link
                  to="/blogs/tags/$tag"
                  params={{ tag: t.tag }}
                  preload="intent"
                  className="blog-tag"
                >
                  {t.tag}
                  <span className="blog-tag__count" aria-hidden="true">
                    {t.count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <section
        className="blog-index__list"
        aria-label="All posts"
        aria-labelledby="blog-index-title"
      >
        {filteredPosts.length === 0 ? (
          <p className="blog-index__empty">
            {search.trim() ? 'No posts match your search.' : 'No posts yet.'}
          </p>
        ) : (
          filteredPosts.map((p) => (
            <article
              key={p.slug}
              className="blog-card"
              aria-labelledby={`blog-card-title-${p.slug}`}
            >
              <div className="blog-card__row">
                <Link
                  to="/blogs/$slug"
                  params={{ slug: p.slug }}
                  preload="viewport"
                  className="blog-card__link"
                  id={`blog-card-title-${p.slug}`}
                >
                  <h2 className="blog-card__title">{p.title}</h2>
                </Link>
                <div className="blog-card__meta" aria-label={`Published ${p.date}, ${p.readingTime} min read`}>
                  <time dateTime={p.date}>{p.date}</time>
                  <span aria-hidden="true"> · </span>
                  <span>{p.readingTime} min read</span>
                </div>
              </div>
              <p className="blog-card__summary">{p.summary}</p>
              {p.tags.length > 0 && (
                <ul className="blog-card__tags" aria-label="Post tags">
                  {p.tags.map((t) => (
                    <li key={t}>
                      <TagChip tag={t} />
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))
        )}
      </section>
    </div>
  )
}
