import type { GearItem } from '@/lib/gear'
import { Tag } from '@/components/tag'
import { pickAspectRatio } from '@/lib/aspect-ratio'
import { PhotoCarousel } from './photo-carousel'

export function GearCard({ item, date }: { item: GearItem; date: string | null }) {
  return (
    <div className="group mb-6 break-inside-avoid rounded-lg bg-muted/40 p-5">
      <p className="mb-2 text-sm text-muted-foreground">
        Hobbies · {item.hobbyTitle}
      </p>
      {item.photo && (
        <div className="relative">
          <PhotoCarousel
            images={[{ src: item.photo, alt: item.name }]}
            aspectRatio={pickAspectRatio(item.slug)}
          />
          <div className="absolute left-3 top-3">
            <Tag label={item.category} />
          </div>
        </div>
      )}
      <h3 className="mt-3 font-serif text-lg leading-tight tracking-tight">{item.name}</h3>
      {item.note && <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{item.note}</p>}
      <div className="mt-3 flex items-center justify-between gap-2">
        {date && <p className="text-xs text-muted-foreground">{date}</p>}
        {item.link && (
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-foreground underline underline-offset-4 hover:text-muted-foreground"
          >
            View product
          </a>
        )}
      </div>
    </div>
  )
}
