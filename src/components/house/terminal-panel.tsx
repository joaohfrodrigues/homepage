'use client'

import Link from 'next/link'
import { Briefcase } from 'lucide-react'
import { PanelWindow } from './panel-window'
import { workstationSession, type WorkstationInfo } from './terminal-session'
import { Prompt, Terminal } from './writing-centerpieces'

const LINK = 'underline-offset-4 hover:text-[#f4ecd8] hover:underline focus-visible:text-[#f4ecd8] focus-visible:underline'

interface Props {
  info: WorkstationInfo
  onClose: () => void
}

/**
 * The study workstation: a terminal session on the desk monitor, with the
 * Work page one link away. The Pi at the end of the desk has its own terminal
 * (the home server series).
 */
export function TerminalPanel({ info, onClose }: Props) {
  return (
    <PanelWindow title="Workstation" eyebrow="Study" onClose={onClose}>
      <Terminal>
        {workstationSession(info).map((entry) => (
          <div key={entry.command} className="mb-3">
            <Prompt host="desk" command={entry.command} />
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
        <Prompt host="desk" />
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
