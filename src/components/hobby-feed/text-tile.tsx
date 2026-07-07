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
        'relative flex flex-col overflow-hidden rounded-lg bg-muted p-5 transition-transform duration-500 ease-out group-hover:scale-[1.02]',
        CARD_ASPECT_RATIO,
        canReveal && 'cursor-pointer'
      )}
      onClick={canReveal ? () => setRevealed((r) => !r) : undefined}
    >
      <div className="mt-auto">
        <p
          className={cn(
            'font-serif leading-tight tracking-tight',
            titleSizeClass(title, showDescription),
            showDescription ? 'line-clamp-2' : 'line-clamp-4'
          )}
        >
          {title}
        </p>
        {meta && (
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground/70">{meta}</p>
        )}
        {showDescription && (
          <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  )
}
