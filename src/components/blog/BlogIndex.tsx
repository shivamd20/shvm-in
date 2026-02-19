import { getAllPosts, getAllTags } from '@/lib/blog'
import { Link } from '@tanstack/react-router'
import { TagChip } from './TagChip'

export function BlogIndex() {
  const posts = getAllPosts()
  const tags = getAllTags()

  return (
    <div className="blog-container">
      <div className="blog-index__hero">
        <h1 className="blog-index__title">Blogs</h1>
        <p className="blog-index__subtitle"> Notes on systems and product engineering.
        </p>
      </div>

      {tags.length ? (
        <section className="blog-index__tags" aria-label="Tags">
          <div className="blog-index__tagsTitle">Tags</div>
          <div className="blog-index__tagsList">
            {tags.map((t) => (
              <Link
                key={t.tag}
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
            ))}
          </div>
        </section>
      ) : null}

      <section className="blog-index__list" aria-label="All posts">
        {posts.map((p) => (
          <article key={p.slug} className="blog-card">
            <Link
              to="/blogs/$slug"
              params={{ slug: p.slug }}
              preload="viewport"
              className="blog-card__link"
            >
              <h2 className="blog-card__title">{p.title}</h2>
            </Link>
            <div className="blog-card__meta">
              <time dateTime={p.date}>{p.date}</time>
              <span aria-hidden="true">·</span>
              <span>{p.readingTime} min</span>
            </div>
            <p className="blog-card__summary">{p.summary}</p>
            {p.tags.length ? (
              <div className="blog-card__tags" aria-label="Tags">
                {p.tags.map((t) => (
                  <TagChip key={t} tag={t} />
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </section>
    </div>
  )
}
