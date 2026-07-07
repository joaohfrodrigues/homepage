import { reader } from './reader'

export type ProjectSummary = {
  slug: string
  title: string
  description: string
  coverImage: string | null
  status: 'active' | 'archived'
  order: number
}

export type ProjectDetail = ProjectSummary & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any[]
}

function entryTitle(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object' && 'name' in raw) return (raw as { name: string }).name
  return ''
}

export async function getProjects(): Promise<ProjectSummary[]> {
  const entries = await reader.collections.projects.all()
  return entries
    .map((e) => ({
      slug: e.slug,
      title: entryTitle(e.entry.title),
      description: e.entry.description,
      coverImage: e.entry.coverImage ?? null,
      status: (e.entry.status ?? 'active') as 'active' | 'archived',
      order: e.entry.order ?? 99,
    }))
    .sort((a, b) => a.order - b.order)
}

export async function getProject(slug: string): Promise<ProjectDetail | null> {
  const entry = await reader.collections.projects.read(slug, { resolveLinkedFiles: true })
  if (!entry) return null

  return {
    slug,
    title: entryTitle(entry.title),
    description: entry.description,
    coverImage: entry.coverImage ?? null,
    status: (entry.status ?? 'active') as 'active' | 'archived',
    order: entry.order ?? 99,
    body: entry.body as unknown[],
  }
}

export async function getAllProjectSlugs(): Promise<string[]> {
  return reader.collections.projects.list()
}
