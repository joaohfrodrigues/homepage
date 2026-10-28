'use client'

import Link from 'next/link'
import { Briefcase } from 'lucide-react'
import { PanelWindow } from './panel-window'
import { SESSION_HOST, workstationSession, type WorkstationInfo } from './terminal-session'
import { Prompt, Terminal } from './writing-centerpieces'

const LINK = 'underline-offset-4 hover:text-[#f4ecd8] hover:underline focus-visible:text-[#f4ecd8] focus-visible:underline'

interface Props {
  info: WorkstationInfo
  onClose: () => void
}

/**
 * The study workstation: a terminal on the desk monitor, logged into the Pi at
 * the end of the desk, with the Work page one link away and the home server
 * series (on the bookshelves) one folder away.
 */
export function TerminalPanel({ info, onClose }: Props) {
  return (
    <PanelWindow title="Workstation" eyebrow="Study" onClose={onClose}>
      <Terminal>
        {workstationSession(info).map((entry) => (
          <div key={entry.command} className="mb-3">
            <Prompt host={entry.host} command={entry.command} />
            {entry.output.map((output, i) =>
              output.kind === 'text' ? (
                <p key={i} className="text-[#c9d6c3]">
                  {output.text}
                </p>
              ) : (
                <p key={i} className="flex flex-wrap gap-x-5">
                  {output.links.map((link) =>
                    link.download ? (
                      <a key={link.href} href={link.href} target="_blank" rel="noopener" className={LINK}>
                        {link.label}
                      </a>
                    ) : (
                      <Link key={link.href} href={link.href} scroll={false} className={LINK}>
                        {link.label}
                      </Link>
                    ),
                  )}
                </p>
              ),
            )}
          </div>
        ))}
        <Prompt host={SESSION_HOST} />
      </Terminal>
      <div className="mt-5 flex justify-center">
        <Link href="/work" scroll={false} className="pixel-button pointer-coarse:min-h-11">
          <Briefcase size={14} />
          Open the Work page
        </Link>
      </div>
    </PanelWindow>
  )
}
