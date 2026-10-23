'use client'

import { useEffect, useState } from 'react'
import { onStickerEarned, type Achievement } from './visitor-stats'

/** How long each sticker stays up before the next one (or nothing) takes its place. */
const SHOW_MS = 5000

interface Props {
  onOpen: () => void
}

/**
 * Pops up "★ Barista unlocked" when the visitor earns a sticker, one at a
 * time, and opens the guestbook when clicked. The live region stays mounted so
 * screen readers hear each one arrive.
 */
export function StickerToast({ onOpen }: Props) {
  const [queue, setQueue] = useState<Achievement[]>([])
  const current = queue[0]

  useEffect(() => onStickerEarned((achievement) => setQueue((shown) => [...shown, achievement])), [])

  useEffect(() => {
    if (!current) return
    const timer = setTimeout(() => setQueue((shown) => shown.slice(1)), SHOW_MS)
    return () => clearTimeout(timer)
  }, [current])

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-16 z-40 flex justify-center px-4 sm:top-18"
    >
      {current && (
        <button
          key={current.id}
          type="button"
          className="pixel-button pointer-events-auto motion-safe:animate-[sticker-toast-in_200ms_steps(4)] sm:gap-3 sm:px-5 sm:py-3 sm:text-lg"
          onClick={() => {
            setQueue([])
            onOpen()
          }}
        >
          <span className="text-[#e8c95a] sm:text-2xl" aria-hidden>
            ★
          </span>
          {current.title} unlocked
        </button>
      )}
    </div>
  )
}
