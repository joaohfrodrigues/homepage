'use client'

import { useState } from 'react'
import { CARD_ASPECT_RATIO } from '@/lib/aspect-ratio'
import { cn } from '@/lib/utils'

const TITLE_SIZES = ['text-2xl', 'text-xl', 'text-lg', 'text-base'] as const

function titleSizeClass(title: string, shrink: boolean): string {
  let index = title.length > 26 ? 2 : title.length > 16 ? 1 : 0
  if (shrink) index += 1
  return TITLE_SIZES[Math.min(index, TITLE_SIZES.length - 1)]
}

export function TextTile({
  title,
  meta,
  description,
  clickToReveal = false,
}: {
  title: string
  meta?: string | null
  description?: string | null
  clickToReveal?: boolean
}) {
  const [revealed, setRevealed] = useState(false)
  const canReveal = clickToReveal && Boolean(description)
  const showDescription = canReveal && revealed

  return (
    <div
      className={cn(
        // A faint two-tone dither on parchment, so a card without a photo still reads as pixel art.
        'relative flex flex-col overflow-hidden bg-[image:repeating-conic-gradient(rgb(42_34_51/0.05)_0_25%,transparent_0_50%)] bg-[length:6px_6px] p-4',
        CARD_ASPECT_RATIO,
        canReveal && 'cursor-pointer'
      )}
      onClick={canReveal ? () => setRevealed((r) => !r) : undefined}
    >
      <div className="mt-auto">
        <p
          className={cn(
            'font-pixel leading-tight',
            titleSizeClass(title, showDescription),
            showDescription ? 'line-clamp-2' : 'line-clamp-4'
          )}
        >
          {title}
        </p>
        {meta && <p className="font-pixel mt-1 text-xs uppercase tracking-widest text-[#8e2a20]">{meta}</p>}
        {showDescription && <p className="mt-2 line-clamp-2 text-xs text-[#6d6359]">{description}</p>}
      </div>
    </div>
  )
}
