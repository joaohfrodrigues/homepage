'use client'

import Link from 'next/link'
import { Camera, Clapperboard, PenLine, User } from 'lucide-react'
import { PanelWindow } from './panel-window'

const SHORTCUTS = [
  { label: 'Photos', href: '/photography', icon: Camera },
  { label: 'Writing', href: '/writing', icon: PenLine },
  { label: 'Films & series', href: '/hobbies/watching', icon: Clapperboard },
  { label: 'About', href: '/about', icon: User },
]

interface Props {
  onClose: () => void
}

/**
 * A first visit's hello from João: who he is, the shortcuts most visitors are
 * after, and a way into the house for everyone else.
 */
export function WelcomeCard({ onClose }: Props) {
  return (
    <PanelWindow eyebrow="Welcome" title="Hi, I’m João" width="narrow" onClose={onClose}>
      <p className="text-sm leading-relaxed">
        I’m a data engineer in Lisbon who takes photos, writes now and then and watches a lot of films.
        This is my flat: walk around, or skip straight to the good stuff.
      </p>
      <nav aria-label="Shortcuts" className="mt-5 grid grid-cols-2 gap-3">
        {SHORTCUTS.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            scroll={false}
            onClick={onClose}
            className="pixel-button justify-center pointer-coarse:min-h-11"
          >
            <Icon size={14} />
            {label}
          </Link>
        ))}
      </nav>
      <button
        type="button"
        onClick={onClose}
        className="pixel-button mt-4 w-full justify-center bg-[#8e2a20] pointer-coarse:min-h-11 hover:bg-[#a5372b] focus-visible:bg-[#a5372b]"
      >
        Explore the house
      </button>
    </PanelWindow>
  )
}
