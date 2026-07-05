import type { Metadata } from 'next'
import { getLandingHobbies, type HobbySummary } from '@/lib/hobbies'
import { getGearItems, type GearItem } from '@/lib/gear'
import { getEventItems, type EventItem } from '@/lib/events'
import { getWatchItems } from '@/lib/watch-items'
import { assignTileColors } from '@/lib/tile-colors'
import { buildOpenGraphMetadata } from '@/lib/site-config'
import { HobbyCard } from '@/components/hobby-feed/hobby-card'
import { GearCard } from '@/components/hobby-feed/gear-card'
import { EventCard } from '@/components/hobby-feed/event-card'
import { ColorLegend } from '@/components/hobby-feed/color-legend'
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

  const groups = Array.from(
    feed
      .reduce((map, entry) => {
        if (entry.kind === 'hobby') {
          map.set(entry.hobby.slug, entry.hobby.title)
        } else {
          map.set(entry.item.hobbySlug, entry.item.hobbyTitle)
        }
        return map
      }, new Map<string, string>())
      .entries(),
    ([slug, title]) => ({ slug, title })
  ).sort((a, b) => a.title.localeCompare(b.title))

  const tileColors = assignTileColors(groups.map((group) => group.slug))
  const legendItems = groups.map((group) => ({ ...group, color: tileColors.get(group.slug)! }))

  return (
    <PageContainer as="main" className="py-16">
      <PageHeader title="Hobbies" description={description} className="mb-10" />

      <ColorLegend items={legendItems} />

      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
        {feed.map((entry) => {
          if (entry.kind === 'hobby') {
            return (
              <HobbyCard
                key={`hobby-${entry.hobby.slug}`}
                hobby={entry.hobby}
                color={tileColors.get(entry.hobby.slug)!}
              />
            )
          }

          if (entry.kind === 'event') {
            return <EventCard key={`event-${entry.item.slug}`} item={entry.item} color={tileColors.get(entry.item.hobbySlug)!} />
          }

          if (entry.kind === 'watch') {
            return <GearCard key={`watch-${entry.item.slug}`} item={entry.item} color={tileColors.get(entry.item.hobbySlug)!} />
          }

          return <GearCard key={`gear-${entry.item.slug}`} item={entry.item} color={tileColors.get(entry.item.hobbySlug)!} />
        })}
      </div>
    </PageContainer>
  )
}
