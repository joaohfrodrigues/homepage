import { Tag } from '@/components/tag'
import { CARD_ASPECT_RATIO } from '@/lib/aspect-ratio'
import { PhotoCarousel } from './photo-carousel'
import { TextTile } from './text-tile'

/**
 * The square pixel card behind every hobby feed entry: the photo with a caption
 * plate when there is one, otherwise a text tile. Links open in a new tab.
 */
export function FeedCard({
  tag,
  title,
  meta,
  note,
  photo,
  link,
  testId,
}: {
  tag: string
  title: string
  meta?: string | null
  note?: string | null
  photo?: string | null
  link?: string | null
  testId?: string
}) {
  const content = (
    <>
      <div className="absolute left-2 top-2 z-10">
        <Tag label={tag} />
      </div>

      {photo ? (
        <PhotoCarousel
          images={[{ src: photo, alt: title }]}
          aspectRatio={CARD_ASPECT_RATIO}
          overlay={
            <>
              <h3 className="font-pixel line-clamp-2 text-lg leading-tight">{title}</h3>
              {meta && <p className="font-pixel mt-0.5 text-xs uppercase tracking-widest text-[#e8c95a]">{meta}</p>}
              {note && <p className="mt-1 line-clamp-1 text-xs text-[#f4ecd8]/80">{note}</p>}
            </>
          }
        />
      ) : (
        <TextTile title={title} meta={meta} description={note} clickToReveal={!link} />
      )}
    </>
  )

  const className = 'pixel-card group flex h-full flex-col'

  if (link) {
    return (
      <a href={link} target="_blank" rel="noopener noreferrer" className={className} data-testid={testId}>
        {content}
      </a>
    )
  }

  return (
    <div className={className} data-testid={testId}>
      {content}
    </div>
  )
}
