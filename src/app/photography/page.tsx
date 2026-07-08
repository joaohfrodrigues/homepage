import type { Metadata } from 'next'
import { getPhotos, getAllCollections, computeAlbumBadges } from '@/lib/photos'
import { GalleryClient } from '@/components/photography/gallery-client'
import { AlbumCard } from '@/components/photography/album-card'
import { buildOpenGraphMetadata } from '@/lib/site-config'
import { PageHeader } from '@/components/ui/page-header'
import { SectionTitle } from '@/components/ui/section-title'
import { PageContainer } from '@/components/ui/page-container'

const description = 'Street and travel photography.'

export const metadata: Metadata = {
  title: 'Photography',
  description,
  ...buildOpenGraphMetadata({
    type: 'website',
    title: 'Photography',
    description,
    url: '/photography',
  }),
}

export default async function PhotographyPage() {
  const [{ photos, hasMore }, collections] = await Promise.all([
    getPhotos({ page: 1, perPage: 30, sort: 'popular' }),
    getAllCollections(),
  ])
  const badges = computeAlbumBadges(collections)

  return (
    <PageContainer as="main" className="py-16">
      <PageHeader title="Photography" description={description} className="mb-10" />

      {/* Collections — the primary way to browse */}
      {collections.length > 0 && (
        <section className="mb-12" aria-label="Collections">
          <SectionTitle>Collections</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {collections.map((col) => (
              <AlbumCard key={col.id} collection={col} badge={badges.get(col.id)} />
            ))}
          </div>
        </section>
      )}

      {/* All photos — secondary, searchable feed */}
      <section aria-label="All photos">
        <SectionTitle>All photos</SectionTitle>
        <GalleryClient initialPhotos={photos} initialHasMore={hasMore} />
      </section>
    </PageContainer>
  )
}
