import { getGearItems, type GearItem } from './gear'
import { getEventItems, type EventItem } from './events'
import { getWatchItems } from './watch-items'

// Hobby entries themselves never render as feed cards — every hobby has
// showOnLandingPage: false and exists only so gear/events/watch items can
// reference it. The feed is always built from those three item kinds.
export type HobbyFeedEntry =
  | { kind: 'gear'; dateAdded: string; item: GearItem }
  | { kind: 'event'; dateAdded: string; item: EventItem }
  | { kind: 'watch'; dateAdded: string; item: GearItem }

export async function getHobbyFeed(): Promise<HobbyFeedEntry[]> {
  const [gearItems, eventItems, watchItems] = await Promise.all([
    getGearItems(),
    getEventItems(),
    getWatchItems(),
  ])

  return [
    ...gearItems.map((item): HobbyFeedEntry => ({ kind: 'gear', dateAdded: item.dateAdded, item })),
    ...eventItems.map((item): HobbyFeedEntry => ({ kind: 'event', dateAdded: item.dateAdded, item })),
    ...watchItems.map((item): HobbyFeedEntry => ({ kind: 'watch', dateAdded: item.dateAdded, item })),
  ].sort((a, b) => b.dateAdded.localeCompare(a.dateAdded))
}

export function getFeedEntryImage(entry: HobbyFeedEntry): { key: string; src: string; alt: string } | null {
  return entry.item.photo
    ? { key: `${entry.kind}-${entry.item.slug}`, src: entry.item.photo, alt: entry.item.name }
    : null
}
