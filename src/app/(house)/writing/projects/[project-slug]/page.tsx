import { notFound } from 'next/navigation'
import { getAllProjectSlugs, getProject } from '@/lib/projects'
import { getProjectArticles } from '@/lib/articles'
import { ArticleBody } from '@/components/article-body'
import { buildOpenGraphMetadata } from '@/lib/site-config'
import type { Metadata } from 'next'
import { ArticleListItem } from '@/components/writing/article-list-item'
import { HouseOverlay } from '@/components/house/house-overlay'
import { DeskTerminal } from '@/components/house/writing-centerpieces'

export async function generateStaticParams() {
  const slugs = await getAllProjectSlugs()
  return slugs.map((slug) => ({ 'project-slug': slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ 'project-slug': string }>
}): Promise<Metadata> {
  const { 'project-slug': projectSlug } = await params
  const project = await getProject(projectSlug)
  if (!project) return {}
  return {
    title: project.title,
    description: project.description,
    ...buildOpenGraphMetadata({
      type: 'website',
      title: project.title,
      description: project.description,
      image: project.coverImage,
      url: `/writing/projects/${projectSlug}`,
    }),
  }
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ 'project-slug': string }>
}) {
  const { 'project-slug': projectSlug } = await params
  const [project, articles] = await Promise.all([
    getProject(projectSlug),
    getProjectArticles(projectSlug),
  ])

  if (!project) notFound()

  return (
    <HouseOverlay title={project.title} back={{ href: '/writing', label: 'Bookshelves' }}>
      <DeskTerminal project={project} articles={articles} />

      {(project.body as unknown[]).length > 0 && (
        <div className="mt-8 prose-sm">
          <ArticleBody document={project.body} />
        </div>
      )}

      <section className="mt-10" aria-label="Articles">
        <h2 className="font-pixel mb-6 text-xl">Articles</h2>
        {articles.length === 0 ? (
          <p className="text-[#6d6359]">No articles yet.</p>
        ) : (
          <ul className="space-y-8">
            {articles.map((article) => (
              <ArticleListItem
                key={article.slug}
                href={`/writing/projects/${projectSlug}/${article.slug}`}
                title={article.title}
                publishedAt={article.publishedAt}
                description={article.description}
              />
            ))}
          </ul>
        )}
      </section>
    </HouseOverlay>
  )
}
