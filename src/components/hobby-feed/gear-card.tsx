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
      className="group rounded-lg bg-muted/40 p-5"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false)
        setTapped(false)
      }}
      onClick={() => setTapped((current) => !current)}
    >
      <div className="mb-2 flex items-center gap-2 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
      {item.photo ? (
        <div className="relative">
          <PhotoCarousel images={[{ src: item.photo, alt: item.name }]} />
          {item.note && (
            <div
              className={`absolute inset-0 flex items-end rounded-md bg-gradient-to-t from-black/80 via-black/30 to-transparent p-3 transition-[opacity,visibility] duration-300 ${
                revealed ? 'visible opacity-100' : 'invisible opacity-0'
              }`}
            >
              <p className="text-sm text-white">{item.note}</p>
            </div>
          )}
        </div>
      ) : (
        item.note && <p className="text-sm text-muted-foreground">{item.note}</p>
      )}
      <h3 className="mt-2 text-base font-medium tracking-tight">{item.name}</h3>
      <div className="mt-1 flex items-center justify-between gap-2">
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
