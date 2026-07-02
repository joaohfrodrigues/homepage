import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { getHobbyFeed } from '@/lib/hobby-feed'
import { buildOpenGraphMetadata } from '@/lib/site-config'
import { Tag } from '@/components/tag'

const description = "Hobbies João keeps outside of work, and the gear behind them."

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

function formatDate(dateAdded: string): string | null {
  if (!dateAdded) return null
  return new Date(`${dateAdded}T00:00:00`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
  })
}

export default async function HobbiesPage() {
  const feed = await getHobbyFeed()

  return (
    <main className="container mx-auto max-w-5xl px-4 py-16">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight mb-3">Hobbies</h1>
        <p className="text-muted-foreground text-lg">{description}</p>
      </header>

      <div className="columns-1 sm:columns-2 lg:columns-3 gap-6">
        {feed.map((entry) => {
          const date = formatDate(entry.dateAdded)

          if (entry.kind === 'hobby') {
            const { hobby } = entry
            return (
              <Link
                key={`hobby-${hobby.slug}`}
                href={hobby.route || `/hobbies/${hobby.slug}`}
                className="group mb-6 block break-inside-avoid rounded-lg bg-muted/40 p-5 transition-colors hover:bg-muted/70"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                    Hobbies
                  </p>
                  {date && <p className="text-xs text-muted-foreground">{date}</p>}
                </div>
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
            )
          }

          const { item } = entry
          return (
            <div
              key={`gear-${item.slug}`}
              className="mb-6 break-inside-avoid rounded-lg bg-muted/40 p-5"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                    Gear
                  </p>
                  <Tag label={item.hobbyTitle} />
                  <Tag label={item.category} />
                </div>
                {date && <p className="text-xs text-muted-foreground">{date}</p>}
              </div>
              {item.photo && (
                <div className="relative mb-4 aspect-[4/3] overflow-hidden rounded-md bg-muted">
                  <Image
                    src={item.photo}
                    alt={item.name}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover"
                  />
                </div>
              )}
              <h3 className="text-xl font-semibold tracking-tight">{item.name}</h3>
              {item.note && <p className="mt-2 text-sm text-muted-foreground">{item.note}</p>}
              {item.link && (
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block text-sm font-medium text-foreground underline underline-offset-4 hover:text-muted-foreground"
                >
                  View product
                </a>
              )}
            </div>
          )
        })}
      </div>
    </main>
  )
}
