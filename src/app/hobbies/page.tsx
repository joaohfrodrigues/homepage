import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { getLandingHobbies } from '@/lib/hobbies'
import { buildOpenGraphMetadata } from '@/lib/site-config'

const description = 'Photos and write-ups from the hobbies João keeps outside of work.'

export const metadata: Metadata = {
  title: 'Hobbies',
  description,
  ...buildOpenGraphMetadata({
    type: 'website',
    title: 'Hobbies',
    description,
    url: '/hobbies',
  }),
}

export default async function HobbiesPage() {
  const hobbies = await getLandingHobbies()

  return (
    <main className="container mx-auto max-w-5xl px-4 py-16">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight mb-3">Hobbies</h1>
        <p className="text-muted-foreground text-lg">{description}</p>
      </header>

      <div className="columns-1 sm:columns-2 lg:columns-3 gap-6">
        {hobbies.map((hobby) => (
          <Link
            key={hobby.slug}
            href={hobby.route || `/hobbies/${hobby.slug}`}
            className="group mb-6 block break-inside-avoid rounded-lg bg-muted/40 p-5 transition-colors hover:bg-muted/70"
          >
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Hobbies
            </p>
            {hobby.coverImage && (
              <div className="relative mb-4 aspect-[4/3] overflow-hidden rounded-md bg-muted">
                <Image
                  src={hobby.coverImage}
                  alt={hobby.title}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
            )}
            <h2 className="text-xl font-semibold tracking-tight">{hobby.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{hobby.blurb}</p>
          </Link>
        ))}
      </div>
    </main>
  )
}
