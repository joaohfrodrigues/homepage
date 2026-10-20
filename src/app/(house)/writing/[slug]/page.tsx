import { notFound } from 'next/navigation'
import { getAdjacentArticles, getStandaloneArticle, getStandaloneSlugs } from '@/lib/articles'
import { ArticleBody } from '@/components/article-body'
import { buildOpenGraphMetadata } from '@/lib/site-config'
import { HouseOverlay } from '@/components/house/house-overlay'
import { ArticleSheet } from '@/components/house/article-sheet'
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
    <HouseOverlay title={article.title} back={{ href: '/writing', label: 'Bookshelves' }} width="narrow">
      <ArticleMeta
        publishedAt={article.publishedAt}
        readingTime={article.readingTime}
        className="mb-6"
      />

      <ArticleSheet>
        <ArticleBody document={article.body} />
      </ArticleSheet>

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
    </HouseOverlay>
  )
}
