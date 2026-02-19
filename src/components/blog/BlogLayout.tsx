import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

export function BlogLayout({
  title,
  children,
}: {
  title?: string
  children: ReactNode
}) {
  return (
    <div className="blog-shell min-h-screen">
      <header className="blog-header">
        <div className="blog-header__inner">
          <div className="blog-header__left">
            <Link to="/" preload="intent" className="blog-header__brand">
              shvm.in
            </Link>
            <span className="blog-header__sep" aria-hidden="true">
              /
            </span>
            <Link to="/blogs" preload="intent" className="blog-header__link">
              blogs
            </Link>
          </div>

          {title ? <div className="blog-header__title">{title}</div> : null}
        </div>
      </header>

      <main className="blog-main">{children}</main>
    </div>
  )
}

