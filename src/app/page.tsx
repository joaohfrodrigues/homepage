import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { getPhotos } from '@/lib/photos'
import { getPublishedArticles } from '@/lib/articles'
import { PersonJsonLd } from '@/components/person-jsonld'
import { buildOpenGraphMetadata } from '@/lib/site-config'
import { formatDate } from '@/lib/format-date'
import { PageHeader } from '@/components/ui/page-header'
import { SectionTitle } from '@/components/ui/section-title'
import { PageContainer } from '@/components/ui/page-container'

const description =
  'Personal site of João Rodrigues — photography, writing, film & TV, and music.'

export const metadata: Metadata = {
  description,
  ...buildOpenGraphMetadata({
    type: 'website',
    title: 'João Rodrigues',
    description,
    url: '/',
  }),
}

export default async function HomePage() {
  const { photos } = getPhotos({ page: 1, perPage: 6, sort: 'popular' })
  const articles = (await getPublishedArticles()).slice(0, 3)

  return (
    <PageContainer className="py-16 flex flex-col gap-16">
      <PersonJsonLd />
      {/* Hero */}
      <PageHeader
        title={
          <>
            Jo<span className="text-brand">a</span>o Rodrigues
          </>
        }
        description="Tech, photography and some other stuff."
        size="hero"
        className="pt-8"
      />

      {/* Photography */}
      {photos.length > 0 && (
        <section>
          <SectionTitle
            action={
              <Link
                href="/photography"
                className="text-sm text-muted-foreground hover:text-brand transition-colors"
              >
                View all →
              </Link>
            }
          >
            Photography
          </SectionTitle>
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
        <section>
          <SectionTitle
            action={
              <Link
                href="/writing"
                className="text-sm text-muted-foreground hover:text-brand transition-colors"
              >
                View all →
              </Link>
            }
          >
            Writing
          </SectionTitle>
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
                      {formatDate(article.publishedAt)}
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
        <p className="text-sm text-muted-foreground">
          Also:{' '}
          <Link href="/hobbies" className="hover:text-brand transition-colors underline-offset-4 hover:underline">
            Hobbies
          </Link>{' '}
          ·{' '}
          <Link href="/watching" className="hover:text-brand transition-colors underline-offset-4 hover:underline">
            Watching
          </Link>
        </p>
      </div>
    </PageContainer>
  )
}
