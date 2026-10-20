import Link from 'next/link'
import { getPublishedArticles } from '@/lib/articles'
import { getProjects } from '@/lib/projects'
import type { Metadata } from 'next'
import { buildOpenGraphMetadata } from '@/lib/site-config'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { SectionTitle } from '@/components/ui/section-title'
import { PageContainer } from '@/components/ui/page-container'
import { ArticleListItem } from '@/components/writing/article-list-item'

const description = "What I'm cooking.";

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

  return (
    <PageContainer as="main" width="narrow" className="py-12">
      <PageHeader title="Writing" description={description} className="mb-12" />

      {articles.length > 0 ? (
        <section>
          <ul className="space-y-10">
            {articles.map((article) => (
              <ArticleListItem
                key={article.slug}
                href={
                  article.project
                    ? `/writing/projects/${article.project}/${article.slug}`
                    : `/writing/${article.slug}`
                }
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
        <section className="mt-16 pt-8 border-t border-border">
          <SectionTitle>Projects</SectionTitle>
          <ul className="flex flex-wrap gap-3">
            {projects.map((project) => (
              <li key={project.slug}>
                <Link
                  href={`/writing/projects/${project.slug}`}
                  className="group inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 hover:border-brand transition-colors"
                >
                  <span className="text-sm font-medium group-hover:underline underline-offset-4">
                    {project.title}
                  </span>
                  {project.status === 'archived' && (
                    <span className="text-xs text-muted-foreground">Archived</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </PageContainer>
  )
}
