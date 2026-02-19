import type { BlogPostMeta } from '@/lib/blog'
import { TagChip } from './TagChip'

function formatDate(isoDate: string) {
  const d = new Date(`${isoDate}T00:00:00Z`)
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(d)
}

export function BlogMeta({ meta }: { meta: BlogPostMeta }) {
  return (
    <div className="blog-meta">
      <div className="blog-meta__row">
        <time dateTime={meta.date} className="blog-meta__date">
          {formatDate(meta.date)}
        </time>
        <span className="blog-meta__dot" aria-hidden="true">
          ·
        </span>
        <span className="blog-meta__reading">{meta.readingTime} min read</span>
      </div>
      {meta.tags.length ? (
        <div className="blog-meta__tags" aria-label="Tags">
          {meta.tags.map((t) => (
            <TagChip key={t} tag={t} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

