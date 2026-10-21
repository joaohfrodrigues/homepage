import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { MapPin } from 'lucide-react'
import { getCollectionBySlug, getCollectionPhotos, getAllCollections, getTrips } from '@/lib/photos'
import { GalleryClient } from '@/components/photography/gallery-client'
import { HouseOverlay } from '@/components/house/house-overlay'
import { buildOpenGraphMetadata } from '@/lib/site-config'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  const collections = getAllCollections()
  return collections.map((c) => ({ slug: c.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const collection = getCollectionBySlug(slug)
  if (!collection) return { title: 'Collection not found' }
  const description = collection.description || `Photography collection: ${collection.title}`
  return {
    title: collection.title,
    description,
    ...buildOpenGraphMetadata({
      type: 'website',
      title: collection.title,
      description,
      image: collection.coverPhotoUrl,
      url: `/photography/${slug}`,
    }),
  }
}

export default async function CollectionPage({ params }: Props) {
  const { slug } = await params
  const collection = getCollectionBySlug(slug)
  if (!collection) notFound()

  const { photos, hasMore } = getCollectionPhotos({
    collectionId: collection.id,
    page: 1,
    perPage: 30,
    sort: 'recent',
  })

  const stops = getTrips().find((trip) => trip.slug === slug)?.stops ?? []

  return (
    <HouseOverlay title={collection.title} back={{ href: '/photography', label: 'Travel map' }}>
      {collection.description && <p className="mb-2 text-[#6d6359]">{collection.description}</p>}
      <p className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#6d6359]">
        <span>
          <span className="font-pixel">{collection.totalPhotos}</span> photos
        </span>
        {stops.length > 0 && (
          <span className="inline-flex flex-wrap items-center gap-1">
            <MapPin size={14} className="text-[#c0392b]" aria-hidden />
            {stops.map((stop) => stop.name).filter(Boolean).join(' · ')}
          </span>
        )}
      </p>

      <GalleryClient
        initialPhotos={photos}
        initialHasMore={hasMore}
        collectionId={collection.id}
      />
    </HouseOverlay>
  )
}
