import type { BlogPost as BlogPostType } from '@/lib/blog'
import { BlogMeta } from './BlogMeta'
import { Prose } from './Prose'
import { ReadingProgressBar } from './ReadingProgressBar'
import { ShareBar } from './ShareBar'
import { TableOfContents } from './TableOfContents'

export function BlogPost({ post }: { post: BlogPostType }) {
  return (
    <div className="blog-container blog-post">
      <ReadingProgressBar />

      <header className="blog-post__header">
        <h1 className="blog-post__title">{post.meta.title}</h1>
        <BlogMeta meta={post.meta} />
        <ShareBar title={post.meta.title} />
      </header>

      <div className="blog-post__body">
        <div className="blog-post__content">
          <Prose post={post} />
        </div>
        <aside className="blog-post__aside">
          <TableOfContents toc={post.toc} />
        </aside>
      </div>
    </div>
  )
}

