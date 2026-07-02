import type { Metadata } from 'next'
import { getHobbyFeed } from '@/lib/hobby-feed'
import { buildOpenGraphMetadata } from '@/lib/site-config'
import { HobbyCard } from '@/components/hobby-feed/hobby-card'
import { GearCard } from '@/components/hobby-feed/gear-card'

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
            return <HobbyCard key={`hobby-${entry.hobby.slug}`} hobby={entry.hobby} date={date} />
          }

          return <GearCard key={`gear-${entry.item.slug}`} item={entry.item} date={date} />
        })}
      </div>
    </main>
  )
}
