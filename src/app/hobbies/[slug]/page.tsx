import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAllHobbySlugs, getHobby } from '@/lib/hobbies'
import { TileGrid } from '@/components/hobbies/tile-grid'
import { buildOpenGraphMetadata } from '@/lib/site-config'

export async function generateStaticParams() {
  const slugs = await getAllHobbySlugs()
  const hobbies = await Promise.all(slugs.map((slug) => getHobby(slug)))
  return hobbies
    .filter((hobby): hobby is NonNullable<typeof hobby> => hobby !== null && hobby.tiles.length > 0)
    .map((hobby) => ({ slug: hobby.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const hobby = await getHobby(slug)
  if (!hobby) return {}
  return {
    title: hobby.title,
    description: hobby.blurb,
    ...buildOpenGraphMetadata({
      type: 'website',
      title: hobby.title,
      description: hobby.blurb,
      image: hobby.coverImage,
      url: `/hobbies/${slug}`,
    }),
  }
}

export default async function HobbyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const hobby = await getHobby(slug)

  if (!hobby || hobby.tiles.length === 0) notFound()

  return (
    <main className="container mx-auto max-w-5xl px-4 py-16">
      <div className="mb-6">
        <Link
          href="/hobbies"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Hobbies
        </Link>
      </div>

      <header className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-3">{hobby.title}</h1>
        <p className="text-muted-foreground text-lg">{hobby.blurb}</p>
      </header>

      <TileGrid tiles={hobby.tiles} />
    </main>
  )
}
