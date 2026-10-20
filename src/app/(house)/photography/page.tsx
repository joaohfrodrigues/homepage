import type { Metadata } from 'next'
import { getPhotos, getAllCollections, computeAlbumBadges, getTrips } from '@/lib/photos'
import { GalleryClient } from '@/components/photography/gallery-client'
import { AlbumCard } from '@/components/photography/album-card'
import { HouseOverlay } from '@/components/house/house-overlay'
import { TravelMap } from '@/components/house/travel-map'
import { buildOpenGraphMetadata } from '@/lib/site-config'

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
  const trips = getTrips()

  return (
    <HouseOverlay eyebrow="Study · map table" title="Travel map">
      <p className="mb-5 text-[#6d6359]">
        {description} Every pin is a trip with its own exhibition — pick one, or browse every photo
        below.
      </p>

      <TravelMap trips={trips} />

      {collections.length > 0 && (
        <section className="mt-10" aria-label="Collections">
          <h2 className="font-pixel mb-4 text-xl">Exhibitions</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {collections.map((col) => (
              <AlbumCard key={col.id} collection={col} badge={badges.get(col.id)} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-10" aria-label="All photos">
        <h2 className="font-pixel mb-4 text-xl">All photos</h2>
        <GalleryClient initialPhotos={photos} initialHasMore={hasMore} />
      </section>
    </HouseOverlay>
  )
}
