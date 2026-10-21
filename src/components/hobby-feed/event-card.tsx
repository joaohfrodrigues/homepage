import type { EventItem } from '@/lib/events'
import { FeedCard } from './feed-card'

export function EventCard({ item }: { item: EventItem }) {
  return (
    <FeedCard
      tag={item.hobbyTitle}
      title={item.name}
      meta={item.location}
      note={item.note}
      photo={item.photo}
      link={item.link}
    />
  )
}
