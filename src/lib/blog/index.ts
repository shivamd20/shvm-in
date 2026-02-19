import indexJson from './generated/index.json'
import tagsJson from './generated/tags.json'
import { postImporters } from './generated/posts'
import type { BlogPost, BlogPostMeta } from './types'

type TagsManifestEntry = { tag: string; count: number; slugs: string[] }
type TagsManifest = { tags: Record<string, TagsManifestEntry> }

const allPosts = (indexJson as { posts: BlogPostMeta[] }).posts

const metaBySlug = new Map<string, BlogPostMeta>(
  allPosts.map((p) => [p.slug, p]),
)

export function getAllPosts(opts?: { includeUnpublished?: boolean }) {
  const includeUnpublished = opts?.includeUnpublished ?? false
  return includeUnpublished ? allPosts : allPosts.filter((p) => p.published)
}

export function getPostMetaBySlug(slug: string) {
  return metaBySlug.get(slug) ?? null
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const importer = (postImporters as Record<string, () => Promise<any>>)[slug]
  if (!importer) return null
  const mod = await importer()
  return (mod.default ?? null) as BlogPost | null
}

export function getAllTags() {
  const tags = (tagsJson as TagsManifest).tags
  return Object.values(tags)
}

export function getTagByName(tag: string) {
  const tags = (tagsJson as TagsManifest).tags
  return tags[tag] ?? null
}

export function getPostsByTag(tag: string) {
  const entry = getTagByName(tag)
  if (!entry) return []
  return entry.slugs
    .map((slug: string) => metaBySlug.get(slug))
    .filter(Boolean) as BlogPostMeta[]
}

export function generateTagIndex() {
  const tags = (tagsJson as TagsManifest).tags
  const result: Record<string, BlogPostMeta[]> = {}
  for (const [tag, entry] of Object.entries(tags)) {
    result[tag] = entry.slugs
      .map((slug: string) => metaBySlug.get(slug))
      .filter(Boolean) as BlogPostMeta[]
  }
  return result
}

export function generateStaticManifest() {
  return {
    posts: allPosts,
    tags: (tagsJson as TagsManifest).tags,
  }
}

export type { BlogPost, BlogPostMeta } from './types'
