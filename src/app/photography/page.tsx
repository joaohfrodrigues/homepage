import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { getPhotos, getAllCollections } from '@/lib/photos'
import { GalleryClient } from '@/components/photography/gallery-client'
import { buildOpenGraphMetadata } from '@/lib/site-config'

const description = 'Street, travel, and portrait photography by Joao Rodrigues.'

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

  return (
    <main className="container mx-auto max-w-5xl px-4 py-16">
      <header className="mb-10 text-center">
        <h1 className="text-4xl heading-lego mb-3">Photography</h1>
        <p className="text-muted-foreground text-lg">{description}</p>
      </header>

      {/* Collections — the primary way to browse */}
      {collections.length > 0 && (
        <section className="mb-12" aria-label="Collections">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-4">
            Collections
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {collections.map((col) => (
              <Link
                key={col.id}
                href={`/photography/${col.slug}`}
                className="group flex flex-col gap-2"
              >
                <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-muted">
                  {col.coverPhotoUrl && (
                    <Image
                      src={col.coverPhotoUrl}
                      alt={col.title}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                </div>
                <div>
                  <p className="font-medium leading-snug group-hover:underline">{col.title}</p>
                  <p className="text-sm text-muted-foreground">{col.totalPhotos} photos</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* All photos — secondary, searchable feed */}
      <section aria-label="All photos">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-4">
          All photos
        </h2>
        <GalleryClient initialPhotos={photos} initialHasMore={hasMore} />
      </section>
    </main>
  )
}
