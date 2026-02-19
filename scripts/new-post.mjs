#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'

function slugifyTitle(input) {
  return input
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function formatDateYYYYMMDD(date) {
  const yyyy = String(date.getFullYear())
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

async function main() {
  const title = process.argv.slice(2).join(' ').trim()
  if (!title) {
    console.error('Usage: pnpm new-post "My Title"')
    process.exit(1)
  }

  const slug = slugifyTitle(title)
  if (!slug) {
    console.error('Could not derive a slug from the title.')
    process.exit(1)
  }

  const today = new Date()
  const date = formatDateYYYYMMDD(today)

  const rootDir = process.cwd()
  const dir = path.join(rootDir, 'content', 'blog')
  await fs.mkdir(dir, { recursive: true })

  const filename = `${date}-${slug}.md`
  const filePath = path.join(dir, filename)

  try {
    await fs.access(filePath)
    console.error(`File already exists: ${filePath}`)
    process.exit(1)
  } catch {
    // ok
  }

  const template = `---\n` +
    `title: ${JSON.stringify(title)}\n` +
    `date: ${JSON.stringify(date)}\n` +
    `tags: []\n` +
    `published: false\n` +
    `---\n\n` +
    `Write the first paragraph as a clear summary. It becomes the post summary.\n\n` +
    `## Notes\n\n` +
    `- \n`

  await fs.writeFile(filePath, template, 'utf8')
  console.log(`Created ${filename}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

