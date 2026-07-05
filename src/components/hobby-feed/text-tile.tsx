import type { TileColor } from '@/lib/tile-colors'
import { CARD_ASPECT_RATIO } from '@/lib/aspect-ratio'
import { Tag } from '@/components/tag'

export function TextTile({
  color,
  category,
  title,
  description,
}: {
  color: TileColor
  category?: string
  title: string
  description?: string | null
}) {
  const { bg } = color

  return (
    <div
      className={`relative flex flex-col overflow-hidden rounded-lg p-5 transition-transform duration-500 ease-out group-hover:scale-[1.02] ${bg} ${CARD_ASPECT_RATIO}`}
    >
      {category && <Tag label={category} />}
      <div className="mt-auto">
        <p className="line-clamp-4 font-serif text-2xl leading-tight tracking-tight">{title}</p>
        {description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{description}</p>}
      </div>
    </div>
  )
}
