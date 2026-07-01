'use client'

import Image from 'next/image'
import { useState } from 'react'
import type { HobbyTile } from '@/lib/hobbies'

export function TileGrid({ tiles }: { tiles: HobbyTile[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [tappedIndex, setTappedIndex] = useState<number | null>(null)

  if (tiles.length === 0) return null

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
      {tiles.map((tile, index) => {
        const revealed = hoveredIndex === index || tappedIndex === index

        return (
          <button
            key={index}
            type="button"
            className="relative aspect-square overflow-hidden rounded-md bg-muted text-left"
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex((current) => (current === index ? null : current))}
            onClick={() => setTappedIndex((current) => (current === index ? null : index))}
            aria-expanded={revealed}
          >
            {tile.image && (
              <Image
                src={tile.image}
                alt={tile.caption || 'Hobby photo'}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className={`object-cover transition-transform duration-300 ${revealed ? 'scale-105' : ''}`}
              />
            )}
            {tile.caption && revealed && (
              <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/80 via-black/20 to-transparent p-3">
                <p className="text-sm text-white">{tile.caption}</p>
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
