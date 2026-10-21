import type { GearItem } from '@/lib/gear'
import { FeedCard } from './feed-card'

export function GearCard({ item, testId }: { item: GearItem; testId?: string }) {
  const category =
    item.category && item.category.toLowerCase() !== item.hobbyTitle.toLowerCase() ? item.category : null

  return (
    <FeedCard
      tag={item.hobbyTitle}
      title={item.name}
      meta={category}
      note={item.note}
      photo={item.photo}
      link={item.link}
      testId={testId}
    />
  )
}
