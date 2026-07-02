import type { HobbySummary } from '@/lib/hobbies'
import { pickAspectRatio } from '@/lib/aspect-ratio'
import { PhotoCarousel } from './photo-carousel'

export function HobbyCard({ hobby, date }: { hobby: HobbySummary; date: string | null }) {
  const images =
    hobby.tiles.length > 0
      ? hobby.tiles
          .filter((tile) => tile.image)
          .map((tile) => ({ src: tile.image as string, alt: tile.caption || hobby.title }))
      : hobby.coverImage
        ? [{ src: hobby.coverImage, alt: hobby.title }]
        : []

  return (
    <div className="group mb-6 break-inside-avoid rounded-lg bg-muted/40 p-5">
      <p className="mb-2 text-sm text-muted-foreground">Hobbies</p>
      {images.length > 0 && (
        <PhotoCarousel images={images} aspectRatio={pickAspectRatio(hobby.slug)} />
      )}
      <h2 className="mt-3 font-serif text-lg leading-tight tracking-tight">{hobby.title}</h2>
      <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{hobby.blurb}</p>
      {date && <p className="mt-3 text-xs text-muted-foreground">{date}</p>}
    </div>
  )
}
