export type BlogTocItem = {
  id: string
  depth: 2 | 3 | 4
  text: string
}

export type BlogPostMeta = {
  title: string
  slug: string
  date: string
  tags: string[]
  summary: string
  readingTime: number
  published: boolean
}

export type BlogPost = {
  meta: BlogPostMeta
  html: string
  toc: BlogTocItem[]
}

