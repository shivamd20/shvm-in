import { BlogLayout } from '@/components/blog/BlogLayout'
import { TagChip } from '@/components/blog/TagChip'
import { getBlogPosts } from '@/lib/blog/server-fns'
import { createFileRoute, notFound, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/blogs/tags/$tag')({
  loader: async (ctx) => {
    const { posts: allPosts } = await getBlogPosts({ data: { publishedOnly: true, limit: 100, offset: 0 } })
    const tag = ctx.params.tag
    const posts = allPosts.filter((p) => p.tags.includes(tag))
    if (posts.length === 0) throw notFound()
    const entry = { tag, count: posts.length, slugs: posts.map((p) => p.slug) }
    return { entry, posts }
  },
  head: ({ params }) => ({
    meta: [
      { title: `Tag: ${params.tag} | shvm.in` },
      { name: 'description', content: `Posts tagged “${params.tag}”.` },
    ],
  }),
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
          ))}
        </section>
      </div>
    </BlogLayout>
  )
}
