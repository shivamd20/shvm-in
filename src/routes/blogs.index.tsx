import { createFileRoute } from '@tanstack/react-router'
import { BlogLayout } from '@/components/blog/BlogLayout'
import { BlogIndex } from '@/components/blog/BlogIndex'
import { getBlogPosts } from '@/lib/blog/server-fns'

export const Route = createFileRoute('/blogs/')({
    loader: async () => {
        const { posts } = await getBlogPosts({ publishedOnly: true, limit: 50, offset: 0 })
        const tags = deriveTagsFromPosts(posts)
        return { posts, tags }
    },
    head: () => ({
        meta: [
            { title: 'Blogs | shvm.in' },
            {
                name: 'description',
                content: 'Static-first posts on systems and product engineering.',
            },
        ],
    }),
    component: BlogsIndexRoute,
})

function deriveTagsFromPosts(posts: { slug: string; tags: string[] }[]): { tag: string; count: number; slugs: string[] }[] {
    const byTag = new Map<string, string[]>()
    for (const p of posts) {
        for (const t of p.tags) {
            const slugs = byTag.get(t) ?? []
            if (!slugs.includes(p.slug)) slugs.push(p.slug)
            byTag.set(t, slugs)
        }
    }
    return Array.from(byTag.entries())
        .map(([tag, slugs]) => ({ tag, count: slugs.length, slugs }))
        .sort((a, b) => a.tag.localeCompare(b.tag))
}

function BlogsIndexRoute() {
    const { posts, tags } = Route.useLoaderData()
    return (
        <BlogLayout>
            <BlogIndex posts={posts} tags={tags} />
        </BlogLayout>
    )
}
