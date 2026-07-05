import type { EventItem } from '@/lib/events'
import type { TileColor } from '@/lib/tile-colors'
import { Tag } from '@/components/tag'
import { CARD_ASPECT_RATIO } from '@/lib/aspect-ratio'
import { PhotoCarousel } from './photo-carousel'
import { TextTile } from './text-tile'

export function EventCard({ item, color }: { item: EventItem; color: TileColor }) {
  return (
    <div className="group flex h-full flex-col">
      {item.photo ? (
        <PhotoCarousel
          images={[{ src: item.photo, alt: item.name }]}
          aspectRatio={CARD_ASPECT_RATIO}
          overlay={
            <>
              <Tag label={item.location} />
              <h3 className="mt-2 line-clamp-2 font-serif text-lg leading-tight tracking-tight text-white">
                {item.name}
              </h3>
              {item.note && <p className="mt-1 line-clamp-1 text-sm text-white/80">{item.note}</p>}
            </>
          }
        />
      ) : (
        <TextTile color={color} category={item.location} title={item.name} description={item.note} />
      )}
    </div>
  )
}
