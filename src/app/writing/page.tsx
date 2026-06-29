import Link from 'next/link'
import { getAllTags, getPublishedArticles } from '@/lib/articles'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Writing — João Rodrigues',
  description: 'Articles on home servers, photography, and technology.',
}

export default async function WritingPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>
}) {
  const { tag } = await searchParams
  const [articles, tags] = await Promise.all([
    getPublishedArticles(tag),
    getAllTags(),
  ])

  return (
    <main className="container max-w-3xl py-12">
      <h1 className="text-3xl font-bold tracking-tight mb-2">Writing</h1>
      <p className="text-muted-foreground mb-8">
        Articles on home servers, photography, and technology.
      </p>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-10">
          <Link
            href="/writing"
            className={`px-3 py-1 rounded-full text-sm border transition-colors ${
              !tag
                ? 'bg-foreground text-background border-foreground'
                : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
            }`}
          >
            All
          </Link>
          {tags.map((t) => (
            <Link
              key={t}
              href={`/writing?tag=${encodeURIComponent(t)}`}
              className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                tag === t
                  ? 'bg-foreground text-background border-foreground'
                  : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
              }`}
            >
              {t}
            </Link>
          ))}
        </div>
      )}

      {articles.length === 0 ? (
        <p className="text-muted-foreground">No articles found.</p>
      ) : (
        <ul className="space-y-10">
          {articles.map((article) => (
            <li key={article.slug}>
              <article>
                <time className="text-sm text-muted-foreground">
                  {new Date(article.publishedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </time>
                <h2 className="text-xl font-semibold mt-1 mb-2">
                  <Link
                    href={`/writing/${article.slug}`}
                    className="hover:underline underline-offset-4"
                  >
                    {article.title}
                  </Link>
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed mb-3">
                  {article.description}
                </p>
                {article.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {article.tags.map((t) => (
                      <Link
                        key={t}
                        href={`/writing?tag=${encodeURIComponent(t)}`}
                        className="px-2 py-0.5 text-xs rounded border border-border text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
                      >
                        {t}
                      </Link>
                    ))}
                  </div>
                )}
              </article>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
