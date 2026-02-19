import { createFileRoute } from '@tanstack/react-router'
import { BlogLayout } from '@/components/blog/BlogLayout'
import { BlogIndex } from '@/components/blog/BlogIndex'

export const Route = createFileRoute('/blogs/')({
    head: () => ({
        meta: [
            { title: 'Blogs | shvm.in' },
            {
                name: 'description',
                content: 'Static-first posts on systems, product engineering, and calm clarity.',
            },
        ],
    }),
    component: BlogsIndexRoute,
})

function BlogsIndexRoute() {
    return (
        <BlogLayout>
            <BlogIndex />
        </BlogLayout>
    )
}
