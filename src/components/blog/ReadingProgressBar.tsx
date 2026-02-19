import { useEffect, useState } from 'react'

export function ReadingProgressBar() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const doc = document.documentElement
        const total = doc.scrollHeight - doc.clientHeight
        const next = total > 0 ? Math.min(1, Math.max(0, doc.scrollTop / total)) : 0
        setProgress(next)
      })
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  return (
    <div className="blog-progress" aria-hidden="true">
      <div className="blog-progress__bar" style={{ transform: `scaleX(${progress})` }} />
    </div>
  )
}

