import { BlogLayout } from '@/components/blog/BlogLayout'
import { BlogNewEditor } from '@/components/blog/BlogNewEditor'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/blogs/new')({
  head: () => ({
    meta: [
      { title: 'New post | shvm.in' },
      { name: 'description', content: 'Create a new blog post.' },
    ],
  }),
  component: BlogsNewRoute,
})

function BlogsNewRoute() {
  return (
    <BlogLayout title="New post">
      <BlogNewEditor />
    </BlogLayout>
  )
}
