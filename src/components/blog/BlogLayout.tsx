import { Link } from '@tanstack/react-router'
import { useEffect, useRef, useState, type ReactNode } from 'react'

const BLOG_THEME_KEY = 'blog-theme'
type BlogTheme = 'light' | 'dark'

function readStoredTheme(): BlogTheme | null {
  if (typeof window === 'undefined') return null
  const s = window.localStorage.getItem(BLOG_THEME_KEY)
  if (s === 'light' || s === 'dark') return s
  return null
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  )
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

export function BlogLayout({
  title,
  children,
}: {
  title?: string
  children: ReactNode
}) {
  const [headerVisible, setHeaderVisible] = useState(true)
  const lastScrollY = useRef(0)
  const [theme, setTheme] = useState<BlogTheme | null>(() => readStoredTheme())
  const [systemDark, setSystemDark] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  )

  useEffect(() => {
    const m = window.matchMedia('(prefers-color-scheme: dark)')
    const on = () => setSystemDark(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])

  const effectiveDark = theme === 'dark' || (theme === null && systemDark)

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) return

    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const y = window.scrollY
        setHeaderVisible(y <= 60 || y < lastScrollY.current)
        lastScrollY.current = y
        ticking = false
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function cycleTheme() {
    const next: BlogTheme = effectiveDark ? 'light' : 'dark'
    setTheme(next)
    window.localStorage.setItem(BLOG_THEME_KEY, next)
  }

  return (
    <div
      className="blog-shell min-h-screen"
      data-theme={theme ?? undefined}
    >
      <header
        className="blog-header blog-header--focus-mode"
        style={{
          transform: headerVisible ? 'translateY(0)' : 'translateY(-100%)',
        }}
      >
        <div className="blog-header__inner">
          <div className="blog-header__left">
            <Link to="/" preload="intent" className="blog-header__brand">
              shvm.in
            </Link>
            <span className="blog-header__sep" aria-hidden="true">
              /
            </span>
            {title ? (
              <Link to="/blogs" preload="intent" className="blog-header__link">
                Back to blog
              </Link>
            ) : (
              <Link to="/blogs" preload="intent" className="blog-header__link">
                blogs
              </Link>
            )}
          </div>
          <button
            type="button"
            onClick={cycleTheme}
            className="blog-header__theme-toggle"
            aria-label={effectiveDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={effectiveDark ? 'Light mode' : 'Dark mode'}
          >
            {effectiveDark ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </header>

      <main className="blog-main">{children}</main>
    </div>
  )
}

