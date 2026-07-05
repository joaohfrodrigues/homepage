import type { EventItem } from '@/lib/events'
import { CARD_ASPECT_RATIO } from '@/lib/aspect-ratio'
import { PhotoCarousel } from './photo-carousel'
import { TextTile } from './text-tile'

export function EventCard({ item }: { item: EventItem }) {
  return (
    <div className="group flex h-full flex-col">
      {item.photo ? (
        <PhotoCarousel
          images={[{ src: item.photo, alt: item.name }]}
          aspectRatio={CARD_ASPECT_RATIO}
          overlay={
            <>
              <h3 className="line-clamp-2 font-serif text-2xl leading-tight tracking-tight text-white">
                {item.name}
              </h3>
              {item.note && <p className="mt-2 line-clamp-1 text-sm text-white/80">{item.note}</p>}
            </>
          }
        />
      ) : (
        <TextTile title={item.name} description={item.note} />
      )}
    </div>
  )
}
