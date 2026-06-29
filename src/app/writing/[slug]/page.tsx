import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getAdjacentArticles, getArticle, getAllSlugs } from '@/lib/articles'
import { ArticleBody } from '@/components/article-body'
import type { Metadata } from 'next'

export async function generateStaticParams() {
  const slugs = await getAllSlugs()
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const article = await getArticle(slug)
  if (!article) return {}
  return {
    title: `${article.title} — João Rodrigues`,
    description: article.description,
  }
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const [article, adjacent] = await Promise.all([
    getArticle(slug),
    getAdjacentArticles(slug),
  ])

  if (!article || article.draft) notFound()

  return (
    <main className="container max-w-3xl py-12">
      <div className="mb-2">
        <Link
          href="/writing"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Writing
        </Link>
      </div>

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
        {article.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {article.tags.map((tag) => (
              <Link
                key={tag}
                href={`/writing?tag=${encodeURIComponent(tag)}`}
                className="px-2 py-0.5 text-xs rounded border border-border text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
              >
                {tag}
              </Link>
            ))}
          </div>
        )}
      </header>

      <ArticleBody document={article.body} />

      <nav
        className="mt-16 pt-8 border-t border-border grid grid-cols-2 gap-4"
        aria-label="Article navigation"
      >
        <div>
          {adjacent.prev && (
            <Link
              href={`/writing/${adjacent.prev.slug}`}
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
              href={`/writing/${adjacent.next.slug}`}
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
