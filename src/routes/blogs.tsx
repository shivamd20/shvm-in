import { createFileRoute, Outlet } from '@tanstack/react-router'
// import { BlogLayout } from '@/components/blog/BlogLayout' // Not used here anymore
// import { BlogIndex } from '@/components/blog/BlogIndex' // Moved to blogs.index.tsx

export const Route = createFileRoute('/blogs')({
  head: () => ({
    links: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&display=swap',
      },
    ],
  }),
  component: BlogsLayoutRoute,
})

function BlogsLayoutRoute() {
  return <Outlet />
}

