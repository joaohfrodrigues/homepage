import { reader } from './reader'

export type ArticleSummary = {
  slug: string
  title: string
  publishedAt: string
  description: string
  project: string
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

/** True once publishedAt (YYYY-MM-DD) has arrived — keeps future-dated entries hidden until then. */
function isPublished(publishedAt: string | null | undefined): boolean {
  if (!publishedAt) return false
  const today = new Date().toISOString().slice(0, 10)
  return publishedAt <= today
}

export async function getPublishedArticles(): Promise<ArticleSummary[]> {
  const entries = await getAllEntries()
  return entries
    .filter((e) => !e.entry.draft && isPublished(e.entry.publishedAt))
    .sort((a, b) =>
      (b.entry.publishedAt ?? '').localeCompare(a.entry.publishedAt ?? '')
    )
    .map((e) => ({
      slug: e.slug,
      title: entryTitle(e.entry.title),
      publishedAt: e.entry.publishedAt ?? '',
      description: e.entry.description,
      project: e.entry.project ?? '',
      draft: e.entry.draft,
    }))
}

export async function getStandaloneArticles(): Promise<ArticleSummary[]> {
  const articles = await getPublishedArticles()
  return articles.filter((a) => !a.project)
}

export async function getProjectArticles(projectSlug: string): Promise<ArticleSummary[]> {
  const articles = await getPublishedArticles()
  return articles.filter((a) => a.project === projectSlug)
}

export async function getAllSlugs(): Promise<string[]> {
  return reader.collections.articles.list()
}

export async function getStandaloneSlugs(): Promise<string[]> {
  const entries = await reader.collections.articles.all()
  return entries.filter((e) => !e.entry.project).map((e) => e.slug)
}

async function getArticle(slug: string): Promise<ArticleDetail | null> {
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
    project: entry.project ?? '',
    draft: entry.draft,
    body,
    readingTime,
  }
}

/** A standalone article page: published, and not owned by a project. */
export async function getStandaloneArticle(slug: string): Promise<ArticleDetail | null> {
  const article = await getArticle(slug)
  if (!article || article.draft || article.project || !isPublished(article.publishedAt)) return null
  return article
}

/** A project article page: published, and owned by the given project. */
export async function getProjectArticle(
  projectSlug: string,
  slug: string
): Promise<ArticleDetail | null> {
  const article = await getArticle(slug)
  if (
    !article ||
    article.draft ||
    article.project !== projectSlug ||
    !isPublished(article.publishedAt)
  )
    return null
  return article
}

export async function getAdjacentArticles(slug: string, projectSlug?: string) {
  const pool = projectSlug
    ? await getProjectArticles(projectSlug)
    : await getStandaloneArticles()
  const idx = pool.findIndex((a) => a.slug === slug)
  return {
    prev: idx < pool.length - 1 ? pool[idx + 1] : null,
    next: idx > 0 ? pool[idx - 1] : null,
  }
}

type NodeLike = { text?: string; children?: NodeLike[] }

function extractText(nodes: NodeLike[]): string {
  return nodes
    .map((n) => (n.text ?? '') + (n.children ? extractText(n.children) : ''))
    .join(' ')
}
