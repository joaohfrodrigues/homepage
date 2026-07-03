import { notFound } from 'next/navigation'
import { getAdjacentArticles, getStandaloneArticle, getStandaloneSlugs } from '@/lib/articles'
import { ArticleBody } from '@/components/article-body'
import { buildOpenGraphMetadata } from '@/lib/site-config'
import { PageHeader } from '@/components/ui/page-header'
import { PageContainer } from '@/components/ui/page-container'
import { BackLink } from '@/components/ui/back-link'
import { ArticleMeta } from '@/components/writing/article-meta'
import { ArticlePrevNext } from '@/components/writing/article-prev-next'
import type { Metadata } from 'next'

export async function generateStaticParams() {
  const slugs = await getStandaloneSlugs()
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const article = await getStandaloneArticle(slug)
  if (!article) return {}
  return {
    title: article.title,
    description: article.description,
    ...buildOpenGraphMetadata({
      type: 'article',
      title: article.title,
      description: article.description,
      publishedTime: article.publishedAt,
      url: `/writing/${slug}`,
    }),
  }
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const [article, adjacent] = await Promise.all([
    getStandaloneArticle(slug),
    getAdjacentArticles(slug),
  ])

  if (!article) notFound()

  return (
    <PageContainer as="main" width="narrow" className="py-12">
      <div className="mb-2">
        <BackLink href="/writing" label="Writing" />
      </div>

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
            ? { href: `/writing/${adjacent.prev.slug}`, title: adjacent.prev.title }
            : undefined
        }
        next={
          adjacent.next
            ? { href: `/writing/${adjacent.next.slug}`, title: adjacent.next.title }
            : undefined
        }
      />
    </PageContainer>
  )
}
