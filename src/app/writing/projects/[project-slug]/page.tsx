import { notFound } from 'next/navigation'
import { getAllProjectSlugs, getProject } from '@/lib/projects'
import { getProjectArticles } from '@/lib/articles'
import { ArticleBody } from '@/components/article-body'
import { buildOpenGraphMetadata } from '@/lib/site-config'
import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/page-header'
import { SectionTitle } from '@/components/ui/section-title'
import { PageContainer } from '@/components/ui/page-container'
import { BackLink } from '@/components/ui/back-link'
import { ArticleListItem } from '@/components/writing/article-list-item'

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
    <PageContainer as="main" width="narrow" className="py-12">
      <div className="mb-6">
        <BackLink href="/writing" label="Writing" />
      </div>

      <PageHeader
        title={project.title}
        description={project.description}
        eyebrow="Project"
        size="compact"
        align="left"
        className="mb-8"
      />

      {(project.body as unknown[]).length > 0 && (
        <div className="mb-12 prose-sm">
          <ArticleBody document={project.body} />
        </div>
      )}

      <section>
        <SectionTitle>Articles</SectionTitle>
        {articles.length === 0 ? (
          <p className="text-muted-foreground">No articles yet.</p>
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
    </PageContainer>
  )
}
