import { HeadContent, Scripts, createRootRoute, Outlet } from '@tanstack/react-router'
import appCss from '../styles.css?url'
import { AnalyticsInit } from '@/components/AnalyticsInit'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, maximum-scale=1',
      },
      {
        title: 'Shivam Dwivedi | AI & Distributed Systems',
      },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      {
        rel: 'icon',
        type: 'image/svg+xml',
        href: '/favicon.svg'
      }
    ],
  }),

  component: RootDocument,
})

function RootDocument() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <AnalyticsInit />
        <Scripts />
      </body>
    </html>
  )
}
