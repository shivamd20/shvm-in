import { createFileRoute, Outlet } from '@tanstack/react-router'
// import { BlogLayout } from '@/components/blog/BlogLayout' // Not used here anymore
// import { BlogIndex } from '@/components/blog/BlogIndex' // Moved to blogs.index.tsx

export const Route = createFileRoute('/blogs')({
  // head moved to blogs.index.tsx
  // head: () => ({
  //   meta: [
  //     { title: 'Blogs | shvm.in' },
  //     {
  //       name: 'description',
  //       content: 'Static-first posts on systems, product engineering, and calm clarity.',
  //     },
  //   ],
  // }),
  component: BlogsLayoutRoute,
})

function BlogsLayoutRoute() {
  return <Outlet />
}

