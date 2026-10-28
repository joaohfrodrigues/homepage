'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Briefcase, Camera, Clapperboard, Home, PenLine, Sparkles, User } from 'lucide-react'
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
}

/**
 * A first visit's hello from João, which asks who's visiting: friends go
 * straight into the house, the curious get the shortcuts most visitors are
 * after, and anyone hiring goes to the Work page.
 */
export function WelcomeCard({ onClose }: Props) {
  const [curious, setCurious] = useState(false)

  return (
    <PanelWindow eyebrow="Welcome" title="Hi, I’m João" width="narrow" onClose={onClose}>
      <p className="text-sm leading-relaxed">
        I’m a data engineer in Lisbon who takes photos, writes now and then and watches a lot of films.
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
            <Link href="/work" scroll={false} onClick={onClose} className={BUTTON}>
              <Briefcase size={14} />
              Here to hire
            </Link>
          </div>
        </>
      )}
    </PanelWindow>
  )
}
