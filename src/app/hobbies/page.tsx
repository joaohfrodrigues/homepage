import type { Metadata } from 'next'
import { getLandingHobbies, type HobbySummary } from '@/lib/hobbies'
import { getGearItems, type GearItem } from '@/lib/gear'
import { buildOpenGraphMetadata } from '@/lib/site-config'
import { formatMonthYear } from '@/lib/format-date'
import { HobbyCard } from '@/components/hobby-feed/hobby-card'
import { GearCard } from '@/components/hobby-feed/gear-card'

type HobbyFeedEntry =
  | { kind: 'hobby'; dateAdded: string; hobby: HobbySummary }
  | { kind: 'gear'; dateAdded: string; item: GearItem }

const description = "Hobbies Joao keeps outside of work, and the gear behind them."

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
  const [landingHobbies, gearItems] = await Promise.all([getLandingHobbies(), getGearItems()])
  const feed: HobbyFeedEntry[] = [
    ...landingHobbies.map((hobby): HobbyFeedEntry => ({ kind: 'hobby', dateAdded: hobby.dateAdded, hobby })),
    ...gearItems.map((item): HobbyFeedEntry => ({ kind: 'gear', dateAdded: item.dateAdded, item })),
  ].sort((a, b) => b.dateAdded.localeCompare(a.dateAdded))

  return (
    <main className="container mx-auto max-w-5xl px-4 py-16">
      <header className="mb-10 text-center">
        <h1 className="text-4xl heading-lego mb-3">Hobbies</h1>
        <p className="text-muted-foreground text-lg">{description}</p>
      </header>

      <div className="columns-2 sm:columns-3 lg:columns-4 gap-6">
        {feed.map((entry) => {
          const date = formatMonthYear(entry.dateAdded)

          if (entry.kind === 'hobby') {
            return <HobbyCard key={`hobby-${entry.hobby.slug}`} hobby={entry.hobby} date={date} />
          }

          return <GearCard key={`gear-${entry.item.slug}`} item={entry.item} date={date} />
        })}
      </div>
    </main>
  )
}
