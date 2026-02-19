import { BlogLayout } from '@/components/blog/BlogLayout'
import { TagChip } from '@/components/blog/TagChip'
import { getPostsByTag, getTagByName } from '@/lib/blog'
import { createFileRoute, notFound, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/blogs/tags/$tag')({
  // head: ({ params }) => ({
  //   meta: [
  //     { title: `Tag: ${params.tag} | shvm.in` },
  //     { name: 'description', content: `Posts tagged “${params.tag}”.` },
  //   ],
  // }),
  loader: (ctx) => {
    const entry = getTagByName(ctx.params.tag)
    if (!entry) throw notFound()
    const posts = getPostsByTag(ctx.params.tag)
    return { entry, posts }
  },
  component: TagRoute,
})

function TagRoute() {
  const { entry, posts } = Route.useLoaderData()

  return (
    <BlogLayout title={`Tag: ${entry.tag}`}>
      <div className="blog-container">
        <div className="blog-tagpage__header">
          <div className="blog-tagpage__kicker">Tag</div>
          <h1 className="blog-tagpage__title">
            <TagChip tag={entry.tag} />
          </h1>
          <div className="blog-tagpage__count">{entry.count} posts</div>
        </div>

        <section className="blog-index__list" aria-label="Posts">
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
    </BlogLayout>
  )
}
