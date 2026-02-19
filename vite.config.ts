import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, URL } from 'url'
import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'

function getBlogPrerenderPages() {
  const root = fileURLToPath(new URL('.', import.meta.url))
  const generatedDir = path.join(root, 'src', 'lib', 'blog', 'generated')
  const indexPath = path.join(generatedDir, 'index.json')
  const tagsPath = path.join(generatedDir, 'tags.json')

  if (!fs.existsSync(indexPath) || !fs.existsSync(tagsPath)) {
    throw new Error(
      `Missing generated blog manifest. Run \"node scripts/blog-generate.mjs\" before starting Vite.`,
    )
  }

  const indexJson = JSON.parse(fs.readFileSync(indexPath, 'utf8')) as {
    posts: Array<{ slug: string; published: boolean; date: string }>
  }
  const tagsJson = JSON.parse(fs.readFileSync(tagsPath, 'utf8')) as {
    tags: Record<string, { tag: string; count: number; slugs: string[] }>
  }

  const pages: Array<{ path: string; prerender?: { enabled?: boolean } }> = [
    { path: '/blogs', prerender: { enabled: true } },
  ]

  for (const post of indexJson.posts) {
    if (!post.published) continue
    pages.push({ path: `/blogs/${post.slug}`, prerender: { enabled: true } })
  }

  for (const tag of Object.keys(tagsJson.tags)) {
    pages.push({ path: `/blogs/tags/${tag}`, prerender: { enabled: true } })
  }

  return pages
}

const config = defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    devtools(),
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),

    tanstackStart({
      pages: getBlogPrerenderPages(),
      prerender: {
        enabled: true,
        crawlLinks: false,
        failOnError: true,
      },
    }),
    viteReact(),
    tailwindcss(),
  ],
  optimizeDeps: {
    exclude: [
      'onnxruntime-web'
    ],
  },
})

export default config
