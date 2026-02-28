import { BlogLayout } from '@/components/blog/BlogLayout'
import { BlogPost } from '@/components/blog/BlogPost'
import { getPostBySlugFromStore } from '@/lib/blog/server-fns'
import { createFileRoute, notFound } from '@tanstack/react-router'

export const Route = createFileRoute('/blogs/$slug')({
  loader: async (ctx) => {
    // #region agent log
    fetch('http://127.0.0.1:7291/ingest/e6cf2584-6d8a-4079-a59c-682c51786aee',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8b621a'},body:JSON.stringify({sessionId:'8b621a',location:'blogs.$slug.tsx:loader',message:'loader entry',data:{slug:ctx.params.slug},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    const post = await getPostBySlugFromStore({ data: ctx.params.slug })
    // #region agent log
    fetch('http://127.0.0.1:7291/ingest/e6cf2584-6d8a-4079-a59c-682c51786aee',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8b621a'},body:JSON.stringify({sessionId:'8b621a',location:'blogs.$slug.tsx:loader',message:'after getPostBySlugFromStore',data:{hasPost:!!post,slug:post?.meta?.slug,published:post?.meta?.published},timestamp:Date.now(),hypothesisId:'H5'})}).catch(()=>{});
    // #endregion
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
