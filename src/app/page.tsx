import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { getPhotos } from '@/lib/photos'
import { getPublishedArticles } from '@/lib/articles'
import { PersonJsonLd } from '@/components/person-jsonld'

export const metadata: Metadata = {
  title: 'João Rodrigues',
  description:
    'Personal site of João Rodrigues — photography, writing, film & TV, and music.',
}

export default async function HomePage() {
  const { photos } = getPhotos({ page: 1, perPage: 6, sort: 'popular' })
  const articles = (await getPublishedArticles()).slice(0, 3)

  return (
    <div className="container mx-auto px-4 py-16 flex flex-col gap-16 max-w-5xl">
      <PersonJsonLd />
      {/* Hero */}
      <header className="flex flex-col gap-3 text-center items-center pt-8">
        <h1 className="text-5xl font-bold tracking-tight">João Rodrigues</h1>
        <p className="text-xl text-muted-foreground">
          Data engineer by day — photographer, writer, film watcher, and drummer otherwise.
        </p>
      </header>

      {/* Photography */}
      {photos.length > 0 && (
        <section className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-2xl font-semibold tracking-tight">Photography</h2>
            <Link
              href="/photography"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {photos.map((photo) => (
              <Link
                key={photo.id}
                href="/photography"
                className="group relative aspect-square overflow-hidden rounded-md bg-muted"
                aria-label="View photography"
              >
                <Image
                  src={photo.url}
                  alt={photo.altDescription || photo.title || 'Photograph by João Rodrigues'}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  placeholder={photo.blurDataURL ? 'blur' : 'empty'}
                  blurDataURL={photo.blurDataURL || undefined}
                />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Writing */}
      {articles.length > 0 && (
        <section className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-2xl font-semibold tracking-tight">Writing</h2>
            <Link
              href="/writing"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              View all →
            </Link>
          </div>
          <ul className="flex flex-col divide-y divide-border">
            {articles.map((article) => (
              <li key={article.slug}>
                <Link
                  href={
                    article.project
                      ? `/writing/projects/${article.project}/${article.slug}`
                      : `/writing/${article.slug}`
                  }
                  className="group flex flex-col gap-1 py-4"
                >
                  {article.publishedAt && (
                    <time className="text-xs text-muted-foreground">
                      {new Date(article.publishedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </time>
                  )}
                  <h3 className="font-medium group-hover:underline underline-offset-4">
                    {article.title}
                  </h3>
                  {article.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {article.description}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Secondary */}
      <div className="flex flex-col items-center gap-3 text-center">
        <Button asChild variant="outline">
          <Link href="/about">About me</Link>
        </Button>
        <p className="text-sm text-muted-foreground">
          Also:{' '}
          <Link href="/hobbies" className="hover:text-foreground transition-colors underline-offset-4 hover:underline">
            Hobbies
          </Link>{' '}
          ·{' '}
          <Link href="/watching" className="hover:text-foreground transition-colors underline-offset-4 hover:underline">
            Watching
          </Link>
        </p>
      </div>
    </div>
  )
}
