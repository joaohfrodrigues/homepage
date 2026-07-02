'use client'

import { useState } from 'react'
import type { GearItem } from '@/lib/gear'
import { Tag } from '@/components/tag'
import { PhotoCarousel } from './photo-carousel'

export function GearCard({ item, date }: { item: GearItem; date: string | null }) {
  const [hovered, setHovered] = useState(false)
  const [tapped, setTapped] = useState(false)
  const revealed = hovered || tapped

  return (
    <div
      className="group mb-6 break-inside-avoid rounded-lg bg-muted/40 p-5"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => setTapped((current) => !current)}
    >
      <div className="mb-3 flex items-center gap-2 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <p className="shrink-0 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Gear
        </p>
        <span className="shrink-0">
          <Tag label={item.hobbyTitle} />
        </span>
        <span className="shrink-0">
          <Tag label={item.category} />
        </span>
      </div>
      {item.photo && <PhotoCarousel images={[{ src: item.photo, alt: item.name }]} />}
      <h3 className="mt-4 text-xl font-semibold tracking-tight">{item.name}</h3>
      {item.note && (
        <p
          className={`mt-2 text-sm text-muted-foreground transition-all duration-300 ${
            revealed ? 'max-h-40 opacity-100' : 'max-h-0 overflow-hidden opacity-0'
          }`}
        >
          {item.note}
        </p>
      )}
      <div className="mt-3 flex items-center justify-between gap-2">
        {date && <p className="text-xs text-muted-foreground">{date}</p>}
        {item.link && (
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-sm font-medium text-foreground underline underline-offset-4 hover:text-muted-foreground"
          >
            View product
          </a>
        )}
      </div>
    </div>
  )
}
