import Image from 'next/image'
import Link from 'next/link'
import type { AlbumBadge, Collection } from '@/lib/photos'

interface Props {
  collection: Collection
  badge?: AlbumBadge
  showCount?: boolean
  priority?: boolean
}

export function AlbumCard({ collection, badge, showCount = true, priority = false }: Props) {
  return (
    <Link href={`/photography/${collection.slug}`} className="group flex flex-col gap-2">
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-muted">
        {collection.coverPhotoUrl && (
          <Image
            src={collection.coverPhotoUrl}
            alt={collection.title}
            fill
            priority={priority}
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
        {badge && (
          <span
            title={badge.label}
            aria-label={badge.label}
            className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-sm backdrop-blur"
          >
            {badge.emoji}
          </span>
        )}
      </div>
      <div>
        <p className="font-medium leading-snug group-hover:underline">{collection.title}</p>
        {showCount && (
          <p className="text-sm text-muted-foreground">{collection.totalPhotos} photos</p>
        )}
      </div>
    </Link>
  )
}
