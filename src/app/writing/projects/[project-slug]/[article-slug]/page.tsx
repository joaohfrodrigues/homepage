import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getArticle, getAdjacentArticles, getAllSlugs } from '@/lib/articles'
import { getProject, getAllProjectSlugs } from '@/lib/projects'
import { ArticleBody } from '@/components/article-body'
import { buildOpenGraphMetadata } from '@/lib/site-config'
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
  const article = await getArticle(articleSlug)
  if (!article || article.draft || article.project !== projectSlug) return {}
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
    getArticle(articleSlug),
    getProject(projectSlug),
    getAdjacentArticles(articleSlug, projectSlug),
  ])

  if (!article || article.draft || !project || article.project !== projectSlug) notFound()

  return (
    <main className="container max-w-3xl py-12">
      <nav
        aria-label="Breadcrumb"
        className="mb-6 flex items-center gap-2 text-sm text-muted-foreground"
      >
        <Link href="/writing" className="hover:text-foreground transition-colors">
          Writing
        </Link>
        <span>/</span>
        <Link
          href={`/writing/projects/${projectSlug}`}
          className="hover:text-foreground transition-colors"
        >
          {project.title}
        </Link>
        <span>/</span>
        <span className="text-foreground">{article.title}</span>
      </nav>

      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-3">{article.title}</h1>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <time>
            {new Date(article.publishedAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </time>
          <span>{article.readingTime} min read</span>
        </div>
      </header>

      <ArticleBody document={article.body} />

      <nav
        className="mt-16 pt-8 border-t border-border grid grid-cols-2 gap-4"
        aria-label="Article navigation"
      >
        <div>
          {adjacent.prev && (
            <Link
              href={`/writing/projects/${projectSlug}/${adjacent.prev.slug}`}
              className="group flex flex-col gap-1"
            >
              <span className="text-xs text-muted-foreground">← Previous</span>
              <span className="text-sm font-medium group-hover:underline underline-offset-4">
                {adjacent.prev.title}
              </span>
            </Link>
          )}
        </div>
        <div className="text-right">
          {adjacent.next && (
            <Link
              href={`/writing/projects/${projectSlug}/${adjacent.next.slug}`}
              className="group flex flex-col gap-1 items-end"
            >
              <span className="text-xs text-muted-foreground">Next →</span>
              <span className="text-sm font-medium group-hover:underline underline-offset-4">
                {adjacent.next.title}
              </span>
            </Link>
          )}
        </div>
      </nav>
    </main>
  )
}
