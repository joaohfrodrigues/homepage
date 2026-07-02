'use client'

import { useState } from 'react'
import type { HobbySummary } from '@/lib/hobbies'
import { PhotoCarousel } from './photo-carousel'

export function HobbyCard({ hobby, date }: { hobby: HobbySummary; date: string | null }) {
  const [hovered, setHovered] = useState(false)
  const [tapped, setTapped] = useState(false)
  const revealed = hovered || tapped

  const images =
    hobby.tiles.length > 0
      ? hobby.tiles
          .filter((tile) => tile.image)
          .map((tile) => ({ src: tile.image as string, alt: tile.caption || hobby.title }))
      : hobby.coverImage
        ? [{ src: hobby.coverImage, alt: hobby.title }]
        : []

  const wide = images.length > 1

  return (
    <div
      className={`group flex h-full flex-col rounded-lg bg-muted/40 p-5 ${wide ? 'sm:col-span-2' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => setTapped((current) => !current)}
    >
      <p className="mb-3 shrink-0 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Hobbies
      </p>
      {images.length > 0 ? (
        <div className="relative min-h-0 flex-1">
          <PhotoCarousel images={images} />
          <div
            className={`absolute inset-0 flex items-end rounded-md bg-gradient-to-t from-black/80 via-black/30 to-transparent p-3 transition-[opacity,visibility] duration-300 ${
              revealed ? 'visible opacity-100' : 'invisible opacity-0'
            }`}
          >
            <p className="text-sm text-white">{hobby.blurb}</p>
          </div>
        </div>
      ) : (
        <p className="min-h-0 flex-1 overflow-hidden text-sm text-muted-foreground">
          {hobby.blurb}
        </p>
      )}
      <h2 className="mt-4 shrink-0 truncate text-xl font-semibold tracking-tight">
        {hobby.title}
      </h2>
      {date && <p className="mt-3 shrink-0 text-xs text-muted-foreground">{date}</p>}
    </div>
  )
}
