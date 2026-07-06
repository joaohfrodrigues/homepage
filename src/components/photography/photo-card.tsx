'use client'

import Image from 'next/image'
import { useState } from 'react'
import type { CSSProperties } from 'react'
import type { Photo } from '@/lib/photos'

const SIZES = '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw'

/**
 * The image rendered inside a react-photo-album cell. `className`/`style` are the
 * props the album passes to `render.image` — they carry the `--photo-width/height`
 * aspect-ratio sizing, so we apply them to the wrapper and let next/image `fill`.
 *
 * A tiny blurDataURL backdrop shows instantly; the optimized image fades in on load
 * (opacity + slight rise) instead of popping.
 */
export function PhotoImage({
  photo,
  priority = false,
  className,
  style,
}: {
  photo: Photo
  priority?: boolean
  className?: string
  style?: CSSProperties
}) {
  const [loaded, setLoaded] = useState(false)
  const alt = photo.altDescription || photo.title || 'Photograph by João Rodrigues'

  return (
    <div
      data-testid="photo-card"
      className={`${className ?? ''} relative bg-muted`}
      style={style}
    >
      {photo.blurDataURL && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo.blurDataURL}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full scale-110 object-cover blur-xl"
        />
      )}
      <Image
        src={photo.url}
        alt={alt}
        fill
        sizes={SIZES}
        priority={priority}
        onLoad={() => setLoaded(true)}
        className={`object-cover transition duration-700 ease-out group-hover:scale-[1.03] ${
          loaded ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'
        }`}
      />
    </div>
  )
}

/** Unsplash attribution overlay — fades in on hover. Rendered as album `extras`. */
export function PhotoOverlay({ photo }: { photo: Photo }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
      <a
        href={photo.photographer.profileUrl || `https://unsplash.com/@${photo.photographer.username}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="pointer-events-auto text-xs text-white/90 hover:text-white hover:underline"
      >
        {photo.photographer.name}
      </a>{' '}
      {photo.unsplashUrl && (
        <a
          href={photo.unsplashUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="pointer-events-auto text-xs text-white/70 hover:text-white/90 hover:underline"
        >
          on Unsplash
        </a>
      )}
    </div>
  )
}
