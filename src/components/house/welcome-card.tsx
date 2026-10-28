'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Briefcase, Camera, Clapperboard, Footprints, Home, PenLine, Sparkles, User } from 'lucide-react'
import { PanelWindow } from './panel-window'

const SHORTCUTS = [
  { label: 'Photos', href: '/photography', icon: Camera },
  { label: 'Writing', href: '/writing', icon: PenLine },
  { label: 'Films & series', href: '/hobbies/watching', icon: Clapperboard },
  { label: 'About', href: '/about', icon: User },
]

const BUTTON = 'pixel-button justify-center pointer-coarse:min-h-11'
const PRIMARY = `${BUTTON} bg-[#8e2a20] hover:bg-[#a5372b] focus-visible:bg-[#a5372b]`

interface Props {
  onClose: () => void
  /** Starts the recruiters' guided tour; without it, hiring goes straight to the About page. */
  onInterview?: () => void
}

/**
 * A first visit's hello from João, which asks who's visiting: friends go
 * straight into the house, the curious get the shortcuts most visitors are
 * after, and anyone hiring picks the About page or a minute's guided tour.
 */
export function WelcomeCard({ onClose, onInterview }: Props) {
  const [curious, setCurious] = useState(false)
  const [hiring, setHiring] = useState(false)

  return (
    <PanelWindow eyebrow="Welcome" title="Hi, I’m João" width="narrow" onClose={onClose}>
      <p className="text-sm leading-relaxed">
        I’m a data engineer in Lisbon who takes photos, likes sharing side projects and creative ideas, and watches a lot of films.
        This is my flat, drawn tile by tile.
      </p>
      {curious ? (
        <>
          <p className="font-pixel mt-5 text-sm">Skip straight to the good stuff:</p>
          <nav aria-label="Shortcuts" className="mt-3 grid grid-cols-2 gap-3">
            {SHORTCUTS.map(({ label, href, icon: Icon }) => (
              <Link key={href} href={href} scroll={false} onClick={onClose} className={BUTTON}>
                <Icon size={14} />
                {label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 grid grid-cols-[auto_1fr] gap-3">
            <button type="button" onClick={() => setCurious(false)} className={BUTTON} aria-label="Back">
              <ArrowLeft size={14} />
            </button>
            <button type="button" onClick={onClose} className={PRIMARY}>
              Explore the house
            </button>
          </div>
        </>
      ) : hiring && onInterview ? (
        <>
          <p className="font-pixel mt-5 text-sm">Two ways in:</p>
          <div className="mt-3 grid gap-3">
            <button type="button" onClick={onInterview} className={PRIMARY}>
              <Footprints size={14} />
              Show me around (1 min)
            </button>
            <Link href="/about" scroll={false} onClick={onClose} className={BUTTON}>
              <Briefcase size={14} />
              Just read about me
            </Link>
          </div>
          <button type="button" onClick={() => setHiring(false)} className={`${BUTTON} mt-3`} aria-label="Back">
            <ArrowLeft size={14} />
          </button>
        </>
      ) : (
        <>
          <p className="font-pixel mt-5 text-sm" id="welcome-who">
            Who’s visiting?
          </p>
          <div role="group" aria-labelledby="welcome-who" className="mt-3 grid gap-3">
            <button type="button" onClick={onClose} className={PRIMARY}>
              <Home size={14} />
              I’m a friend
            </button>
            <button type="button" onClick={() => setCurious(true)} className={BUTTON}>
              <Sparkles size={14} />
              Just curious
            </button>
            {onInterview ? (
              <button type="button" onClick={() => setHiring(true)} className={BUTTON}>
                <Briefcase size={14} />
                Here to hire
              </button>
            ) : (
              <Link href="/about" scroll={false} onClick={onClose} className={BUTTON}>
                <Briefcase size={14} />
                Here to hire
              </Link>
            )}
          </div>
        </>
      )}
    </PanelWindow>
  )
}
