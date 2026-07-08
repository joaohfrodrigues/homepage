import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { getAllCollections, computeAlbumBadges } from '@/lib/photos'
import { getPublishedArticles } from '@/lib/articles'
import { getProjects } from '@/lib/projects'
import { getHobbyFeed, getFeedEntryImage } from '@/lib/hobby-feed'
import { PersonJsonLd } from '@/components/person-jsonld'
import { buildOpenGraphMetadata } from '@/lib/site-config'
import { formatDate } from '@/lib/format-date'
import { PageHeader } from '@/components/ui/page-header'
import { SectionTitle } from '@/components/ui/section-title'
import { PageContainer } from '@/components/ui/page-container'
import { ProjectPill } from '@/components/writing/project-pill'
import { AlbumCard } from '@/components/photography/album-card'

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
  const collections = getAllCollections()
  const albumBadges = computeAlbumBadges(collections)
  const featuredAlbums = collections.slice(0, 6)
  const [allArticles, projects] = await Promise.all([getPublishedArticles(), getProjects()])
  const articles = allArticles.slice(0, 3)
  const projectTitles = new Map(projects.map((project) => [project.slug, project.title]))
  const hobbyFeed = await getHobbyFeed()
  const hobbyPreviews = hobbyFeed
    .map((entry) => getFeedEntryImage(entry))
    .filter((preview): preview is NonNullable<typeof preview> => preview !== null)
    .slice(0, 6)

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
      {featuredAlbums.length > 0 && (
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
            {featuredAlbums.map((album, i) => (
              <AlbumCard
                key={album.id}
                collection={album}
                badge={albumBadges.get(album.id)}
                showCount={false}
                priority={i < 6}
              />
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
              <li key={article.slug} className="py-4">
                <div className="flex items-center gap-2 mb-1">
                  {article.publishedAt && (
                    <time className="text-xs text-muted-foreground">
                      {formatDate(article.publishedAt)}
                    </time>
                  )}
                  {article.project && projectTitles.has(article.project) && (
                    <ProjectPill
                      slug={article.project}
                      title={projectTitles.get(article.project)!}
                    />
                  )}
                </div>
                <Link
                  href={
                    article.project
                      ? `/writing/projects/${article.project}/${article.slug}`
                      : `/writing/${article.slug}`
                  }
                  className="group block"
                >
                  <h3 className="font-medium group-hover:underline underline-offset-4">
                    {article.title}
                  </h3>
                  {article.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                      {article.description}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Hobbies */}
      {hobbyPreviews.length > 0 && (
        <section>
          <SectionTitle
            action={
              <Link
                href="/hobbies"
                className="text-sm text-muted-foreground hover:text-brand transition-colors"
              >
                View all →
              </Link>
            }
          >
            Hobbies
          </SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {hobbyPreviews.map((preview) => (
              <Link
                key={preview.key}
                href="/hobbies"
                className="group relative aspect-square overflow-hidden rounded-md bg-muted"
                aria-label="View hobbies"
              >
                <Image
                  src={preview.src}
                  alt={preview.alt}
                  fill
                  unoptimized={/^https?:\/\//.test(preview.src)}
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </Link>
            ))}
          </div>
        </section>
      )}
    </PageContainer>
  )
}
