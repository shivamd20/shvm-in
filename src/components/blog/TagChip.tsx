import { Link } from '@tanstack/react-router'

export function TagChip({ tag }: { tag: string }) {
  return (
    <Link
      to="/blogs/tags/$tag"
      params={{ tag }}
      preload="intent"
      className="blog-tag"
    >
      {tag}
    </Link>
  )
}

