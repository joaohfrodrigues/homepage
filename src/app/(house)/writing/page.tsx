import Link from 'next/link'
import { getPublishedArticles } from '@/lib/articles'
import { getProjects } from '@/lib/projects'
import type { Metadata } from 'next'
import { buildOpenGraphMetadata } from '@/lib/site-config'
import { EmptyState } from '@/components/ui/empty-state'
import { ArticleListItem } from '@/components/writing/article-list-item'
import { HouseOverlay } from '@/components/house/house-overlay'
import { Bookshelf, articleHref } from '@/components/house/writing-centerpieces'

const description = "What I'm cooking."

export const metadata: Metadata = {
  title: 'Writing',
  description,
  ...buildOpenGraphMetadata({
    type: 'website',
    title: 'Writing',
    description,
    url: '/writing',
  }),
}

export default async function WritingPage() {
  const [articles, projects] = await Promise.all([getPublishedArticles(), getProjects()])
  const projectTitles = new Map(projects.map((project) => [project.slug, project.title]))
  const shelvedProjects = projects.map((project) => ({
    ...project,
    parts: articles.filter((article) => article.project === project.slug).length,
  }))

  return (
    <HouseOverlay eyebrow="Study · Bookshelves" title="Writing">
      <p className="mb-5 text-[#6d6359]">{description} Pull a binder off the shelf, or pick up the latest.</p>

      <Bookshelf projects={shelvedProjects} articles={articles.slice(0, 12)} />

      {articles.length > 0 ? (
        <section className="mt-10" aria-label="All articles">
          <h2 className="font-pixel mb-6 text-xl">All articles</h2>
          <ul className="space-y-10">
            {articles.map((article) => (
              <ArticleListItem
                key={article.slug}
                href={articleHref(article)}
                title={article.title}
                publishedAt={article.publishedAt}
                description={article.description}
                project={
                  article.project
                    ? {
                        slug: article.project,
                        title: projectTitles.get(article.project) ?? article.project,
                      }
                    : null
                }
              />
            ))}
          </ul>
        </section>
      ) : (
        <EmptyState message="No articles yet." />
      )}

      {projects.length > 0 && (
        <section className="mt-12 border-t-4 border-[#2a2233] pt-6" aria-label="Projects">
          <h2 className="font-pixel mb-4 text-xl">Projects</h2>
          <ul className="flex flex-wrap gap-3">
            {projects.map((project) => (
              <li key={project.slug}>
                <Link
                  href={`/writing/projects/${project.slug}`}
                  className="group inline-flex items-center gap-2 border-2 border-[#2a2233] px-4 py-2 hover:bg-[#ebe0c8]"
                >
                  <span className="text-sm font-medium group-hover:underline underline-offset-4">
                    {project.title}
                  </span>
                  {project.status === 'archived' && <span className="text-xs text-[#6d6359]">Archived</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </HouseOverlay>
  )
}
