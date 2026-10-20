import { notFound } from 'next/navigation'
import { getProjectArticle, getAdjacentArticles, getAllSlugs } from '@/lib/articles'
import { getProject, getAllProjectSlugs } from '@/lib/projects'
import { ArticleBody } from '@/components/article-body'
import { buildOpenGraphMetadata } from '@/lib/site-config'
import { PageHeader } from '@/components/ui/page-header'
import { PageContainer } from '@/components/ui/page-container'
import { Breadcrumb } from '@/components/writing/breadcrumb'
import { ArticleMeta } from '@/components/writing/article-meta'
import { ArticlePrevNext } from '@/components/writing/article-prev-next'
import type { Metadata } from 'next'

export async function generateStaticParams() {
  const [articleSlugs, projectSlugs] = await Promise.all([
    getAllSlugs(),
    getAllProjectSlugs(),
  ])
  // We need to pair each article with its project — read all articles
  const { reader } = await import('@/lib/reader')
  const entries = await reader.collections.articles.all()

  return entries
    .filter((e) => e.entry.project && projectSlugs.includes(e.entry.project))
    .map((e) => ({
      'project-slug': e.entry.project as string,
      'article-slug': e.slug,
    }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ 'project-slug': string; 'article-slug': string }>
}): Promise<Metadata> {
  const { 'project-slug': projectSlug, 'article-slug': articleSlug } = await params
  const article = await getProjectArticle(projectSlug, articleSlug)
  if (!article) return {}
  return {
    title: article.title,
    description: article.description,
    ...buildOpenGraphMetadata({
      type: 'article',
      title: article.title,
      description: article.description,
      publishedTime: article.publishedAt,
      url: `/writing/projects/${projectSlug}/${articleSlug}`,
    }),
  }
}

export default async function ProjectArticlePage({
  params,
}: {
  params: Promise<{ 'project-slug': string; 'article-slug': string }>
}) {
  const { 'project-slug': projectSlug, 'article-slug': articleSlug } = await params

  const [article, project, adjacent] = await Promise.all([
    getProjectArticle(projectSlug, articleSlug),
    getProject(projectSlug),
    getAdjacentArticles(articleSlug, projectSlug),
  ])

  if (!article || !project) notFound()

  return (
    <PageContainer as="main" width="narrow" className="py-12">
      <Breadcrumb
        items={[
          { label: 'Writing', href: '/writing' },
          { label: project.title, href: `/writing/projects/${projectSlug}` },
          { label: article.title },
        ]}
      />

      <PageHeader title={article.title} align="left" size="compact" className="mb-3" />
      <ArticleMeta
        publishedAt={article.publishedAt}
        readingTime={article.readingTime}
        className="mb-8"
      />

      <ArticleBody document={article.body} />

      <ArticlePrevNext
        prev={
          adjacent.prev
            ? {
                href: `/writing/projects/${projectSlug}/${adjacent.prev.slug}`,
                title: adjacent.prev.title,
              }
            : undefined
        }
        next={
          adjacent.next
            ? {
                href: `/writing/projects/${projectSlug}/${adjacent.next.slug}`,
                title: adjacent.next.title,
              }
            : undefined
        }
      />
    </PageContainer>
  )
}
