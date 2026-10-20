'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef } from 'react'
import { ArrowLeft, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  title: string
  /** Small caps line above the title, usually the room this opened from. */
  eyebrow?: string
  back?: { href: string; label: string }
  width?: 'narrow' | 'wide'
  children: React.ReactNode
}

/**
 * A page shown as a window over the house. Pages under the (house) route group
 * render their content inside one of these, so every overlay keeps a real,
 * server-rendered URL while the game keeps running underneath.
 */
export function HouseOverlay({ title, eyebrow, back, width = 'wide', children }: Props) {
  const router = useRouter()
  const panelRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => router.push('/', { scroll: false }), [router])

  useEffect(() => {
    panelRef.current?.focus()
  }, [title])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      // The photo lightbox handles its own Escape; don't close the window under it.
      if (document.querySelector('[data-testid="lightbox"]')) return
      close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/45 sm:items-center sm:p-6" onClick={close}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="overlay-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'pixel-window relative flex max-h-[92dvh] w-full flex-col outline-none',
          width === 'wide' ? 'sm:max-w-6xl' : 'sm:max-w-2xl',
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b-4 border-[#2a2233] px-5 py-4 sm:px-8">
          <div className="min-w-0">
            {back && (
              <Link
                href={back.href}
                scroll={false}
                className="font-pixel mb-1 inline-flex items-center gap-1 text-xs text-[#8e2a20] hover:underline"
              >
                <ArrowLeft size={12} />
                {back.label}
              </Link>
            )}
            {eyebrow && !back && (
              <p className="font-pixel text-xs uppercase tracking-widest text-[#8e2a20]">{eyebrow}</p>
            )}
            <h1
              id="overlay-title"
              className={cn('font-pixel text-balance', title.length > 40 ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl')}
            >
              {title}
            </h1>
          </div>
          <button type="button" onClick={close} className="pixel-button shrink-0" aria-label="Close and return to the house">
            <X size={14} />
            <span className="hidden sm:inline">Back to the house</span>
          </button>
        </header>
        <div className="overflow-y-auto px-5 py-6 sm:px-8">{children}</div>
      </div>
    </div>
  )
}
