import type { Metadata } from 'next'
import { getLandingHobbies, type HobbySummary } from '@/lib/hobbies'
import { getGearItems, type GearItem } from '@/lib/gear'
import { getEventItems, type EventItem } from '@/lib/events'
import { getWatchItems } from '@/lib/watch-items'
import { buildOpenGraphMetadata } from '@/lib/site-config'
import { HobbyCard } from '@/components/hobby-feed/hobby-card'
import { GearCard } from '@/components/hobby-feed/gear-card'
import { EventCard } from '@/components/hobby-feed/event-card'
import { PageHeader } from '@/components/ui/page-header'
import { PageContainer } from '@/components/ui/page-container'

type HobbyFeedEntry =
  | { kind: 'hobby'; dateAdded: string; hobby: HobbySummary }
  | { kind: 'gear'; dateAdded: string; item: GearItem }
  | { kind: 'event'; dateAdded: string; item: EventItem }
  | { kind: 'watch'; dateAdded: string; item: GearItem }

const description = "Out and about."

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
  const [landingHobbies, gearItems, eventItems, watchItems] = await Promise.all([
    getLandingHobbies(),
    getGearItems(),
    getEventItems(),
    getWatchItems(),
  ])
  const feed: HobbyFeedEntry[] = [
    ...landingHobbies.map((hobby): HobbyFeedEntry => ({ kind: 'hobby', dateAdded: hobby.dateAdded, hobby })),
    ...gearItems.map((item): HobbyFeedEntry => ({ kind: 'gear', dateAdded: item.dateAdded, item })),
    ...eventItems.map((item): HobbyFeedEntry => ({ kind: 'event', dateAdded: item.dateAdded, item })),
    ...watchItems.map((item): HobbyFeedEntry => ({ kind: 'watch', dateAdded: item.dateAdded, item })),
  ].sort((a, b) => b.dateAdded.localeCompare(a.dateAdded))

  return (
    <PageContainer as="main" className="py-16">
      <PageHeader title="Hobbies" description={description} className="mb-10" />

      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
        {feed.map((entry) => {
          if (entry.kind === 'hobby') {
            return <HobbyCard key={`hobby-${entry.hobby.slug}`} hobby={entry.hobby} />
          }

          if (entry.kind === 'event') {
            return <EventCard key={`event-${entry.item.slug}`} item={entry.item} />
          }

          if (entry.kind === 'watch') {
            return <GearCard key={`watch-${entry.item.slug}`} item={entry.item} testId="watch-card" />
          }

          return <GearCard key={`gear-${entry.item.slug}`} item={entry.item} />
        })}
      </div>
    </PageContainer>
  )
}
