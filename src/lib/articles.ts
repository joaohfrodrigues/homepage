import { reader } from './reader'

export type ArticleSummary = {
  slug: string
  title: string
  publishedAt: string
  description: string
  tags: readonly string[]
  draft: boolean
}

export type ArticleDetail = ArticleSummary & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any[]
  readingTime: number
}

async function getAllEntries() {
  return reader.collections.articles.all({ resolveLinkedFiles: true })
}

function entryTitle(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object' && 'name' in raw) return (raw as { name: string }).name
  return ''
}

export async function getPublishedArticles(tag?: string): Promise<ArticleSummary[]> {
  const entries = await getAllEntries()
  return entries
    .filter((e) => !e.entry.draft)
    .filter((e) => !tag || e.entry.tags.includes(tag))
    .sort((a, b) =>
      (b.entry.publishedAt ?? '').localeCompare(a.entry.publishedAt ?? '')
    )
    .map((e) => ({
      slug: e.slug,
      title: entryTitle(e.entry.title),
      publishedAt: e.entry.publishedAt ?? '',
      description: e.entry.description,
      tags: e.entry.tags,
      draft: e.entry.draft,
    }))
}

export async function getAllTags(): Promise<string[]> {
  const entries = await getAllEntries()
  const tags = new Set<string>()
  for (const e of entries) {
    if (!e.entry.draft) {
      for (const tag of e.entry.tags) tags.add(tag)
    }
  }
  return Array.from(tags).sort()
}

export async function getAllSlugs(): Promise<string[]> {
  return reader.collections.articles.list()
}

export async function getArticle(slug: string): Promise<ArticleDetail | null> {
  const entry = await reader.collections.articles.read(slug, { resolveLinkedFiles: true })
  if (!entry) return null

  const body = entry.body as unknown[]
  const wordCount = extractText(body as NodeLike[]).split(/\s+/).filter(Boolean).length
  const readingTime = Math.max(1, Math.round(wordCount / 200))

  return {
    slug,
    title: entryTitle(entry.title),
    publishedAt: entry.publishedAt ?? '',
    description: entry.description,
    tags: entry.tags,
    draft: entry.draft,
    body,
    readingTime,
  }
}

export async function getAdjacentArticles(slug: string) {
  const published = await getPublishedArticles()
  const idx = published.findIndex((a) => a.slug === slug)
  return {
    prev: idx < published.length - 1 ? published[idx + 1] : null,
    next: idx > 0 ? published[idx - 1] : null,
  }
}

type NodeLike = { text?: string; children?: NodeLike[] }

function extractText(nodes: NodeLike[]): string {
  return nodes
    .map((n) => (n.text ?? '') + (n.children ? extractText(n.children) : ''))
    .join(' ')
}
