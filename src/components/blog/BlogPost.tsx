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
      </header>

      <div className="blog-post__body">
        <div className="blog-post__content">
          <Prose post={post} />
          <div className="blog-post__share-footer">
            <ShareBar title={post.meta.title} />
          </div>
        </div>
        {post.toc.length > 0 && (
          <aside className="blog-post__aside" aria-label="On this page">
            <TableOfContents toc={post.toc} />
          </aside>
        )}
      </div>
    </div>
  )
}

