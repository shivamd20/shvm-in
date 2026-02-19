#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import matter from 'gray-matter'
import { z } from 'zod'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeStringify from 'rehype-stringify'
import { visit } from 'unist-util-visit'
import { toString as mdastToString } from 'mdast-util-to-string'
import { createHighlighter } from 'shiki'

const rootDir = process.cwd()
const contentDir = path.join(rootDir, 'content', 'blog')
const outDir = path.join(rootDir, 'src', 'lib', 'blog', 'generated')
const outPostsDir = path.join(outDir, 'posts')

const filenameSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/)

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
const tagSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

const frontmatterSchema = z
  .object({
    title: z.string().min(1),
    date: isoDateSchema.optional(),
    tags: z.array(tagSchema).default([]),
    published: z.boolean(),
  })
  .strict()

/**
 * Mermaid is explicitly out-of-scope for now.
 */
function assertNoMermaid(markdown, filePath) {
  if (markdown.includes('```mermaid')) {
    throw new Error(
      `Mermaid blocks are out-of-scope for now. Remove \`\`\`mermaid from ${filePath}`,
    )
  }
}

function countWords(text) {
  return (text.match(/\S+/g) ?? []).length
}

function getReadingTimeMinutes(text) {
  const words = countWords(text)
  return Math.max(1, Math.ceil(words / 200))
}

function getTextFromHast(node) {
  if (!node) return ''
  if (node.type === 'text') return node.value ?? ''
  if (Array.isArray(node.children)) return node.children.map(getTextFromHast).join('')
  return ''
}

function parseImageTitleForDimensions(title) {
  if (typeof title !== 'string' || !title.trim()) return null

  const m1 = title.trim().match(/^(\d{2,5})x(\d{2,5})$/i)
  if (m1) return { width: Number(m1[1]), height: Number(m1[2]) }

  const m2 = title
    .trim()
    .match(/(?:^|\s)w=(\d{2,5})(?:\s|$).*(?:^|\s)h=(\d{2,5})(?:\s|$)/i)
  if (m2) return { width: Number(m2[1]), height: Number(m2[2]) }

  return null
}

function rehypeBlogTransforms({ highlighter }) {
  return async (tree, file) => {
    /** @type {Array<{id: string, depth: number, text: string}>} */
    const toc = []

    const loadedLangs = new Set(highlighter.getLoadedLanguages())

    // Collect headings and transform nodes in one pass.
    visit(tree, 'element', (node, index, parent) => {
      if (!parent || typeof index !== 'number') return

      // TOC (use ids injected by rehype-slug)
      if (node.tagName && /^h[1-6]$/.test(node.tagName)) {
        const depth = Number(node.tagName.slice(1))
        if (depth >= 2 && depth <= 4) {
          const id = node.properties?.id
          const text = getTextFromHast(node).trim()
          if (typeof id === 'string' && id && text) {
            toc.push({ id, depth, text })
          }
        }
      }

      // Images: add lazy loading and optional dimensions (from title)
      if (node.tagName === 'img') {
        node.properties = node.properties ?? {}
        node.properties.loading = 'lazy'
        node.properties.decoding = 'async'

        const title = node.properties.title
        const dims = parseImageTitleForDimensions(title)
        if (dims) {
          node.properties.width = dims.width
          node.properties.height = dims.height
          delete node.properties.title
        }
      }

      // Code blocks: replace <pre><code class="language-...">...</code></pre>
      if (node.tagName === 'pre') {
        const codeEl = node.children?.find?.((c) => c?.type === 'element' && c.tagName === 'code')
        if (!codeEl) return

        const className = codeEl.properties?.className
        const classes = Array.isArray(className) ? className : typeof className === 'string' ? [className] : []
        const langFromClass = classes
          .map((c) => String(c))
          .find((c) => c.startsWith('language-'))
          ?.replace(/^language-/, '')

        const lang = (langFromClass && langFromClass !== 'text') ? langFromClass : 'text'
        const code = getTextFromHast(codeEl).replace(/\n$/, '')

        const makePre = (theme) => {
          if (lang !== 'text' && !loadedLangs.has(lang)) {
            // best-effort; if it fails, fall back to plain text
            // (do not throw on unknown languages)
            return highlighter
              .loadLanguage(lang)
              .then(() => loadedLangs.add(lang))
              .catch(() => null)
              .then(() => highlighter.codeToHast(code, { lang: loadedLangs.has(lang) ? lang : 'text', theme }).children[0])
          }
          return Promise.resolve(highlighter.codeToHast(code, { lang, theme }).children[0])
        }

        // Replace node asynchronously (unist visit doesn't support async visitor directly).
        // Mark placeholder and patch after traversal.
        node.__blogReplace = { lang, code, makePre }
      }
    })

    /** Replace code blocks after traversal (async shiki). */
    const replacements = []
    visit(tree, 'element', (node, index, parent) => {
      if (!parent || typeof index !== 'number') return
      if (node.__blogReplace) replacements.push({ node, index, parent, ...node.__blogReplace })
    })

    for (const r of replacements) {
      const lightPre = await r.makePre('github-light')
      const darkPre = await r.makePre('github-dark')

      if (lightPre?.properties) {
        lightPre.properties.className = [
          ...(Array.isArray(lightPre.properties.className) ? lightPre.properties.className : []),
          'blog-code-pre',
          'blog-code-pre--light',
        ]
      }
      if (darkPre?.properties) {
        darkPre.properties.className = [
          ...(Array.isArray(darkPre.properties.className) ? darkPre.properties.className : []),
          'blog-code-pre',
          'blog-code-pre--dark',
        ]
      }

      const wrapper = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['blog-codeblock'], 'data-lang': r.lang },
        children: [
          {
            type: 'element',
            tagName: 'button',
            properties: {
              type: 'button',
              className: ['blog-codeblock__copy'],
              'data-blog-copy': 'code',
              'aria-label': 'Copy code to clipboard',
            },
            children: [{ type: 'text', value: 'Copy' }],
          },
          {
            type: 'element',
            tagName: 'div',
            properties: { className: ['blog-codeblock__inner'] },
            children: [lightPre, darkPre].filter(Boolean),
          },
        ],
      }

      r.parent.children[r.index] = wrapper
    }

    file.data.toc = toc
  }
}

async function extractSummaryAndText(markdown) {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown)

  let firstParagraph = ''
  visit(tree, (node) => {
    if (firstParagraph) return
    if (node.type === 'paragraph') {
      firstParagraph = mdastToString(node).trim()
    }
  })

  const fullText = mdastToString(tree).trim()
  return { summary: firstParagraph, fullText }
}

function sortByDateDesc(a, b) {
  // ISO date string sorts lexicographically
  if (a.date === b.date) return a.slug.localeCompare(b.slug)
  return a.date < b.date ? 1 : -1
}

async function main() {
  const entries = await fs.readdir(contentDir).catch((e) => {
    if (e?.code === 'ENOENT') {
      throw new Error(`Missing blog content directory: ${contentDir}`)
    }
    throw e
  })

  const files = entries
    .filter((f) => f.endsWith('.md'))
    .map((f) => filenameSchema.parse(f))
    .sort()

  const highlighter = await createHighlighter({
    themes: ['github-light', 'github-dark'],
    langs: [],
  })

  await fs.rm(outDir, { recursive: true, force: true })
  await fs.mkdir(outPostsDir, { recursive: true })

  /** @type {Array<{title:string,slug:string,date:string,tags:string[],summary:string,readingTime:number,published:boolean}>} */
  const metas = []

  /** @type {Record<string, Array<string>>} */
  const tagsToSlugs = {}

  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSlug)
    .use(rehypeBlogTransforms, { highlighter })
    .use(rehypeAutolinkHeadings, {
      behavior: 'wrap',
      properties: { className: ['blog-heading-anchor'] },
    })
    .use(rehypeStringify)

  for (const filename of files) {
    const filePath = path.join(contentDir, filename)
    const raw = await fs.readFile(filePath, 'utf8')
    assertNoMermaid(raw, filePath)

    const match = filename.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.md$/)
    if (!match) {
      throw new Error(`Invalid blog filename format: ${filename}`)
    }

    const dateFromFilename = match[1]
    const slugFromFilename = match[2]
    const slug = slugSchema.parse(slugFromFilename)
    const filenameDate = isoDateSchema.parse(dateFromFilename)

    const parsed = matter(raw)
    const fm = frontmatterSchema.parse(parsed.data ?? {})

    const date = fm.date ?? filenameDate
    if (fm.date && fm.date !== filenameDate) {
      throw new Error(
        `Frontmatter date (${fm.date}) must match filename date (${filenameDate}) in ${filename}`,
      )
    }

    const { summary, fullText } = await extractSummaryAndText(parsed.content)
    if (!summary) {
      throw new Error(`Missing summary (first paragraph) in ${filename}`)
    }

    const readingTime = getReadingTimeMinutes(fullText)

    const vfile = await processor.process(parsed.content.trim())
    const html = String(vfile)
    const toc = Array.isArray(vfile.data.toc) ? vfile.data.toc : []

    const meta = {
      title: fm.title,
      slug,
      date,
      tags: fm.tags,
      summary,
      readingTime,
      published: fm.published,
    }

    metas.push(meta)

    if (meta.published) {
      for (const tag of meta.tags) {
        tagsToSlugs[tag] = tagsToSlugs[tag] ?? []
        tagsToSlugs[tag].push(meta.slug)
      }
    }

    const outPostPath = path.join(outPostsDir, `${slug}.json`)
    await fs.writeFile(outPostPath, JSON.stringify({ meta, html, toc }, null, 2) + '\n', 'utf8')
  }

  metas.sort(sortByDateDesc)

  for (const [tag, slugs] of Object.entries(tagsToSlugs)) {
    slugs.sort((a, b) => a.localeCompare(b))
  }

  const indexJson = {
    generatedAt: new Date().toISOString(),
    posts: metas,
  }

  const tagsJson = {
    generatedAt: new Date().toISOString(),
    tags: Object.fromEntries(
      Object.entries(tagsToSlugs)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([tag, slugs]) => [tag, { tag, count: slugs.length, slugs }]),
    ),
  }

  await fs.writeFile(path.join(outDir, 'index.json'), JSON.stringify(indexJson, null, 2) + '\n', 'utf8')
  await fs.writeFile(path.join(outDir, 'tags.json'), JSON.stringify(tagsJson, null, 2) + '\n', 'utf8')

  // Generate a static import map for per-post code splitting
  const importLines = metas
    .map((m) => `  ${JSON.stringify(m.slug)}: () => import('./posts/${m.slug}.json'),`)
    .join('\n')

  const postsTs = `/* eslint-disable */\n// This file is generated by scripts/blog-generate.mjs\nexport const postImporters = {\n${importLines}\n} as const\n`

  await fs.writeFile(path.join(outDir, 'posts.ts'), postsTs, 'utf8')

  await highlighter.dispose()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

