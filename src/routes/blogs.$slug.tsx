import { BlogLayout } from '@/components/blog/BlogLayout'
import { BlogPost } from '@/components/blog/BlogPost'
import { getPostBySlugFromStore } from '@/lib/blog/server-fns'
import { createFileRoute, notFound } from '@tanstack/react-router'

export const Route = createFileRoute('/blogs/$slug')({
  loader: async (ctx) => {
    const post = await getPostBySlugFromStore(ctx.params.slug)
    if (!post || !post.meta.published) throw notFound()
    return post
  },
  head: ({ loaderData }) => {
    const meta = loaderData?.meta
    const title = meta?.published ? `${meta.title} | shvm.in` : 'Not Found | shvm.in'
    const description = meta?.published ? meta.summary : 'Post not found.'
    return {
      meta: [
        { title },
        { name: 'description', content: description },
        { name: 'robots', content: meta?.published ? 'index,follow' : 'noindex' },
      ],
    }
  },
  component: BlogPostRoute,
})

function BlogPostRoute() {
  const post = Route.useLoaderData()
  return (
    <BlogLayout title={post?.meta?.title}>
      <BlogPost post={post} />
    </BlogLayout>
  )
}
