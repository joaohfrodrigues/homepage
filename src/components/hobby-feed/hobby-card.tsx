import type { HobbySummary } from '@/lib/hobbies'
import { CARD_ASPECT_RATIO } from '@/lib/aspect-ratio'
import { PhotoCarousel } from './photo-carousel'
import { TextTile } from './text-tile'

export function HobbyCard({ hobby }: { hobby: HobbySummary }) {
  const images =
    hobby.tiles.length > 0
      ? hobby.tiles
          .filter((tile) => tile.image)
          .map((tile) => ({ src: tile.image as string, alt: tile.caption || hobby.title }))
      : hobby.coverImage
        ? [{ src: hobby.coverImage, alt: hobby.title }]
        : []

  return (
    <div className="group flex h-full flex-col">
      {images.length > 0 ? (
        <PhotoCarousel
          images={images}
          aspectRatio={CARD_ASPECT_RATIO}
          overlay={
            <>
              <h2 className="line-clamp-2 font-serif text-lg leading-tight tracking-tight text-white">
                {hobby.title}
              </h2>
              <p className="mt-1 line-clamp-1 text-sm text-white/80">{hobby.blurb}</p>
            </>
          }
        />
      ) : (
        <TextTile title={hobby.title} description={hobby.blurb} />
      )}
    </div>
  )
}
