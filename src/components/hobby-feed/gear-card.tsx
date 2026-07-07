import type { GearItem } from '@/lib/gear'
import { Tag } from '@/components/tag'
import { CARD_ASPECT_RATIO } from '@/lib/aspect-ratio'
import { PhotoCarousel } from './photo-carousel'
import { TextTile } from './text-tile'

export function GearCard({ item, testId }: { item: GearItem; testId?: string }) {
  const category =
    item.category && item.category.toLowerCase() !== item.hobbyTitle.toLowerCase() ? item.category : null

  const content = (
    <>
      <div className="absolute left-3 top-3 z-10">
        <Tag label={item.hobbyTitle} />
      </div>

      {item.photo ? (
        <PhotoCarousel
          images={[{ src: item.photo, alt: item.name }]}
          aspectRatio={CARD_ASPECT_RATIO}
          overlay={
            <>
              <h3 className="line-clamp-2 font-serif text-2xl leading-tight tracking-tight text-white">
                {item.name}
              </h3>
              {category && (
                <p className="mt-1 text-xs font-medium uppercase tracking-wide text-white/60">{category}</p>
              )}
              {item.note && <p className="mt-2 line-clamp-1 text-sm text-white/80">{item.note}</p>}
            </>
          }
        />
      ) : (
        <TextTile
          title={item.name}
          meta={category}
          description={item.note}
          clickToReveal={!item.link}
        />
      )}
    </>
  )

  const className = 'group relative flex h-full flex-col'

  if (item.link) {
    return (
      <a
        href={item.link}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        data-testid={testId}
      >
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
