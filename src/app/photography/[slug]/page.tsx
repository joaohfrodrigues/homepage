import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getCollectionBySlug, getCollectionPhotos, getAllCollections } from '@/lib/photos'
import { GalleryClient } from '@/components/photography/gallery-client'
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

  return (
    <div className="container mx-auto px-4 py-10">
      <Link
        href="/photography"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8 group"
      >
        <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
        All photos
      </Link>

      <header className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-2">{collection.title}</h1>
        {collection.description && (
          <p className="text-muted-foreground text-lg max-w-prose">{collection.description}</p>
        )}
        <p className="text-sm text-muted-foreground mt-2">{collection.totalPhotos} photos</p>
      </header>

      <GalleryClient
        initialPhotos={photos}
        initialHasMore={hasMore}
        collectionId={collection.id}
      />
    </div>
  )
}
