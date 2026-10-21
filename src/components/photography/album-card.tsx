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
    <Link href={`/photography/${collection.slug}`} className="group flex flex-col gap-3 outline-none">
      <div className="pixel-card aspect-[4/3] overflow-hidden">
        {collection.coverPhotoUrl && (
          <Image
            src={collection.coverPhotoUrl}
            alt={collection.title}
            fill
            priority={priority}
            className="object-cover"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        )}
        {badge && (
          <span
            title={badge.label}
            aria-label={badge.label}
            className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center bg-[#2a2233]/85 text-sm shadow-[0_0_0_1px_#2a2233]"
          >
            {badge.emoji}
          </span>
        )}
      </div>
      <div>
        <p className="font-pixel leading-tight text-[#2a2233] group-hover:text-[#8e2a20]">{collection.title}</p>
        {showCount && (
          <p className="font-pixel text-xs uppercase tracking-widest text-[#6d6359]">
            {collection.totalPhotos} photos
          </p>
        )}
      </div>
    </Link>
  )
}
