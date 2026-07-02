import type { GearItem } from '@/lib/gear'
import { Tag } from '@/components/tag'
import { CARD_ASPECT_RATIO } from '@/lib/aspect-ratio'
import { PhotoCarousel } from './photo-carousel'

export function GearCard({ item, date }: { item: GearItem; date: string | null }) {
  return (
    <div className="group flex h-full flex-col rounded-lg bg-muted/40 p-5">
      <p className="mb-2 text-sm text-muted-foreground">
        Hobbies · {item.hobbyTitle}
      </p>
      {item.photo && (
        <div className="relative">
          <PhotoCarousel images={[{ src: item.photo, alt: item.name }]} aspectRatio={CARD_ASPECT_RATIO} />
          <div className="absolute left-3 top-3">
            <Tag label={item.category} />
          </div>
        </div>
      )}
      <h3 className="mt-3 line-clamp-2 font-serif text-lg leading-tight tracking-tight">{item.name}</h3>
      {item.note && <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{item.note}</p>}
      {date && <p className="mt-auto pt-3 text-xs text-muted-foreground">{date}</p>}
    </div>
  )
}
