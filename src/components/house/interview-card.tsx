'use client'

import { createContext, useContext, useEffect, useRef } from 'react'
import { ArrowRight, Footprints, X } from 'lucide-react'
import type { ContactLink } from '@/lib/house'
import type { TourStop } from './interview'
import { useEscapeKey } from './panel-window'

interface Props {
  /** The stop to show, or null for the goodbye at the end. */
  stop: TourStop | null
  /** 0-based, and `count` once the stops are done. */
  index: number
  count: number
  /** Ways to get in touch at the end; never the CV or email, which stay off by default. */
  contacts: ContactLink[]
  onNext: () => void
  /** Leaves the tour for one of its pages. */
  onLink: (href: string) => void
  onClose: () => void
}

const PRIMARY = 'pixel-button bg-[#8e2a20] hover:bg-[#a5372b] focus-visible:bg-[#a5372b] pointer-coarse:min-h-11'
const BUTTON = 'pixel-button pointer-coarse:min-h-11'

/** Starts the tour from a page over the house (closing the page first); null when there's no tour to take. */
export const InterviewContext = createContext<(() => void) | null>(null)

/** The About page's way into the tour. */
export function InterviewButton() {
  const start = useContext(InterviewContext)
  if (!start) return null
  return (
    <button type="button" onClick={start} className={BUTTON}>
      <Footprints size={14} />
      Show me around (1 min)
    </button>
  )
}

/**
 * The recruiters' tour, one card per stop along the bottom of the screen so
 * the guest can be seen standing at each thing it's about. Every card can
 * skip the rest; Escape and Back end it too.
 */
export function InterviewCard({ stop, index, count, contacts, onNext, onLink, onClose }: Props) {
  const nextRef = useRef<HTMLButtonElement>(null)
  useEscapeKey(onClose)
  useEffect(() => {
    nextRef.current?.focus()
  }, [index])

  const last = index === count - 1
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center p-4 pb-6 sm:pb-10">
      <div role="dialog" aria-labelledby="interview-title" className="pixel-window pointer-events-auto relative w-full max-w-2xl">
        <div className="font-pixel absolute -top-4 left-5 z-10 bg-[#2a2233] px-3 py-0.5 text-sm text-[#f4ecd8]">The interview</div>
        {/* Scrolls inside, so the tab above isn't clipped. */}
        <div className="max-h-[70dvh] overflow-y-auto p-5 pt-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-pixel text-xs uppercase tracking-widest text-[#8e2a20]">
                {stop ? `${index + 1} of ${count} · ${stop.place}` : 'That’s the tour'}
              </p>
              <h2 id="interview-title" className="font-pixel text-xl">
                {stop ? stop.title : 'Thanks for coming round'}
              </h2>
            </div>
            <button type="button" onClick={onClose} className="pixel-button" aria-label={stop ? 'Skip the tour' : 'Close the tour'}>
              <X size={14} />
            </button>
          </div>

          {stop ? (
            <>
              {stop.lines.map((line) => (
                <p key={line} className="mt-3 max-w-prose text-sm leading-relaxed">
                  {line}
                </p>
              ))}
              {stop.stack && (
                // One line a group, so the card stays short enough on a phone to see the guest above it.
                <dl className="mt-2 space-y-1 text-sm">
                  {stop.stack.map(({ group, items }) => (
                    <div key={group}>
                      <dt className="font-pixel inline text-[#6d6359]">{group}</dt> <dd className="inline">{items.join(', ')}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                {stop.link ? (
                  <button type="button" onClick={() => onLink(stop.link!.href)} className="text-sm text-[#8e2a20] underline underline-offset-4">
                    {stop.link.label}
                  </button>
                ) : (
                  <span />
                )}
                <button ref={nextRef} type="button" onClick={onNext} className={PRIMARY}>
                  {last ? 'Finish' : 'Next stop'}
                  <ArrowRight size={14} />
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="mt-3 max-w-prose text-sm leading-relaxed">
                If you’d like to talk, LinkedIn is the best way to reach me, and the code is on GitHub.
              </p>
              <nav aria-label="Contact" className="mt-4 flex flex-wrap gap-3">
                {contacts.map((contact, i) => (
                  <a key={contact.href} href={contact.href} target="_blank" rel="noopener noreferrer" className={i === 0 ? PRIMARY : BUTTON}>
                    {contact.label} <span aria-hidden>↗</span>
                  </a>
                ))}
                <button type="button" onClick={() => onLink('/about')} className={BUTTON}>
                  Full experience
                </button>
                <button ref={nextRef} type="button" onClick={onClose} className={BUTTON}>
                  Explore the house
                </button>
              </nav>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
