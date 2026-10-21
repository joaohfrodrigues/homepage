'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  title: string
  eyebrow: string
  onClose: () => void
  width?: 'narrow' | 'wide'
  children: React.ReactNode
}

/**
 * Calls `onEscape` when Escape is pressed anywhere, not only while focus is
 * inside the window: a click on the house outside it drops focus to the body.
 */
export function useEscapeKey(onEscape: () => void) {
  const handler = useRef(onEscape)
  useEffect(() => {
    handler.current = onEscape
  })
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.preventDefault()
      handler.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

/**
 * A pixel window over the house for things that aren't pages: the directory,
 * the wardrobe and the kitchen games. Escape or a click outside closes it.
 */
export function PanelWindow({ title, eyebrow, onClose, width = 'wide', children }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
  }, [])
  useEscapeKey(onClose)

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="panel-title"
        className={cn(
          'pixel-window relative max-h-[90dvh] w-full overflow-y-auto p-5 sm:p-7',
          width === 'wide' ? 'max-w-3xl' : 'max-w-lg',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="font-pixel text-xs uppercase tracking-widest text-[#8e2a20]">{eyebrow}</p>
            <h2 id="panel-title" className="font-pixel text-2xl">
              {title}
            </h2>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} className="pixel-button" aria-label={`Close ${title}`}>
            <X size={14} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
