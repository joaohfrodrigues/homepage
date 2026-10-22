'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { openPage } from './house-navigation'
import { PanelWindow } from './panel-window'

interface Props {
  onClose: () => void
}

const PROMPT = 'pi@homeserver:~$'
const SERIES = '/writing/projects/raspberry-pi'
/** The day Part 1 went up, which the Pi counts as its last reboot. */
const BOOTED = new Date('2026-01-13T09:00:00Z')

interface Reply {
  lines: string[]
  /** The part of the series the output comes from. */
  link?: { label: string; href: string }
}

interface Entry extends Reply {
  command: string
}

const ARTICLES = {
  foundation: { label: 'Part 1: The Foundation', href: `${SERIES}/home-server-part-1-foundation` },
  media: { label: 'Part 2: The Media Center', href: `${SERIES}/home-server-part-2-media-center` },
  vpn: { label: 'Part 3: VPN split-tunneling', href: `${SERIES}/home-server-part-3-vpn-split-tunneling` },
  tunnel: { label: 'Part 4: The Secure Tunnel', href: `${SERIES}/home-server-part-4-secure-tunnel` },
  das: { label: 'Part 5: Scaling up with a DAS', href: `${SERIES}/home-server-part-5-das-upgrade` },
}

const FILES: Record<string, Reply> = {
  'about.txt': {
    lines: [
      'Raspberry Pi 5, 8 GB, with an NVMe SSD mounted at /media/storage.',
      'Runs a media center, a VPN gateway for the TV and a tunnel home,',
      'all while sipping less power than a lightbulb.',
    ],
    link: { label: 'The home server series', href: SERIES },
  },
  'todo.txt': {
    lines: ['- [x] media center', '- [x] split-tunnel the Smart TV', '- [x] reach it from anywhere', '- [ ] buy a DAS before the SSD fills up'],
    link: ARTICLES.das,
  },
}

const DOCKER_PS = [
  'CONTAINER ID   IMAGE                       STATUS        PORTS                NAMES',
  '3f9a1c2e7b4d   runtipi/runtipi:latest      Up 6 months   0.0.0.0:80->80/tcp   runtipi',
  '8c21d0e5a6f3   plexinc/pms-docker          Up 6 months   0.0.0.0:32400->32400 plex',
  'a4e7b9130c5d   linuxserver/qbittorrent     Up 6 months   0.0.0.0:8080->8080   qbittorrent',
  '5b0d3f8e2a71   linuxserver/sonarr          Up 6 months   0.0.0.0:8989->8989   sonarr',
  'e6c42a9d1f08   linuxserver/radarr          Up 6 months   0.0.0.0:7878->7878   radarr',
]

function uptime(now: Date): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - BOOTED.getTime()) / 60_000))
  const days = Math.floor(minutes / 1440)
  const clock = `${Math.floor((minutes % 1440) / 60)}:${String(minutes % 60).padStart(2, '0')}`
  const time = now.toTimeString().slice(0, 8)
  return ` ${time} up ${days} days, ${clock},  1 user,  load average: 0.42, 0.37, 0.31`
}

/** What the fake shell answers; null closes the terminal. */
function run(input: string): Reply | null {
  const [command = '', ...args] = input.trim().split(/\s+/)
  switch (command) {
    case '':
      return { lines: [] }
    case 'help':
      return { lines: ['Try: ls, cat about.txt, uptime, docker ps, df -h, wg show, tailscale status, clear, exit'] }
    case 'ls':
      return { lines: ['about.txt  todo.txt  media/'] }
    case 'cat': {
      const file = FILES[args[0] ?? '']
      if (file) return file
      return { lines: [args[0] ? `cat: ${args[0]}: No such file or directory` : 'cat: missing file operand'] }
    }
    case 'uptime':
      return { lines: [uptime(new Date())] }
    case 'docker':
      if (args[0] === 'ps') return { lines: DOCKER_PS, link: ARTICLES.media }
      return { lines: ['Usage: docker ps'] }
    case 'df':
      return {
        lines: [
          'Filesystem      Size  Used Avail Use% Mounted on',
          '/dev/mmcblk0p2   29G  6.1G   22G  22% /',
          '/dev/nvme0n1p1  916G  841G   75G  92% /media/storage',
        ],
        link: ARTICLES.das,
      }
    case 'wg':
      return {
        lines: ['interface: wg0', '  listening port: 51820', '  fwmark: 0xca6c', '', 'peer: (the VPN provider)', '  allowed ips: 0.0.0.0/0'],
        link: ARTICLES.vpn,
      }
    case 'tailscale':
      return {
        lines: ['100.101.12.7    homeserver   linux   -', '100.101.12.31   phone        iOS     active; direct'],
        link: ARTICLES.tunnel,
      }
    case 'lsblk':
      return {
        lines: ['NAME         SIZE MOUNTPOINT', 'mmcblk0     29.7G', '└─mmcblk0p2  29G /', 'nvme0n1      932G', '└─nvme0n1p1  916G /media/storage'],
        link: ARTICLES.foundation,
      }
    case 'sudo':
      return { lines: ['Nice try.'] }
    case 'exit':
    case 'logout':
      return null
    default:
      return { lines: [`bash: ${command}: command not found`] }
  }
}

/** A link out of the terminal: the page takes over the panel's history entry and closes it. */
function PageLink({ href, className, children }: { href: string; className: string; children: React.ReactNode }) {
  const router = useRouter()
  return (
    <Link
      href={href}
      scroll={false}
      onClick={(e) => {
        // New-tab and other modified clicks behave like any link.
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
        e.preventDefault()
        openPage(router, href)
      }}
      className={className}
    >
      {children}
    </Link>
  )
}

/**
 * A fake shell on the study's Raspberry Pi: a handful of commands answer
 * with what the home server series built, and link to the part that did.
 */
export function PiTerminalPanel({ onClose }: Props) {
  const [entries, setEntries] = useState<Entry[]>([
    { command: 'cat motd', lines: ['Welcome to homeserver. Type `help` to look around.'] },
  ])
  const [input, setInput] = useState('')
  // Commands typed so far, newest last; ↑ and ↓ step through them.
  const [history, setHistory] = useState<string[]>([])
  const [recall, setRecall] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const screenRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    screenRef.current?.scrollTo({ top: screenRef.current.scrollHeight })
  }, [entries])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const command = input.trim()
    setInput('')
    setRecall(null)
    if (command) setHistory((previous) => [...previous, command])
    const reply = run(command)
    if (reply === null) onClose()
    else if (command === 'clear') setEntries([])
    else setEntries((previous) => [...previous, { command, ...reply }])
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    if (history.length === 0) return
    const step = e.key === 'ArrowUp' ? -1 : 1
    const next = Math.min(history.length, Math.max(0, (recall ?? history.length) + step))
    setRecall(next)
    setInput(history[next] ?? '')
  }

  return (
    <PanelWindow eyebrow="Study · Raspberry Pi" title="pi@homeserver" onClose={onClose}>
      <div
        ref={screenRef}
        className="font-pixel h-80 overflow-y-auto border-4 border-[#2a2233] bg-[#141019] p-3 text-sm text-[#9ee07a]"
        onClick={() => inputRef.current?.focus()}
      >
        <div role="log" aria-label="Terminal output" aria-live="polite">
          {entries.map((entry, i) => (
            <div key={i} className="mb-2">
              <p>
                <span className="text-[#e8c95a]">{PROMPT}</span> {entry.command}
              </p>
              {entry.lines.map((line, j) => (
                <p key={j} className="whitespace-pre-wrap">
                  {line || ' '}
                </p>
              ))}
              {entry.link && (
                <p>
                  <PageLink href={entry.link.href} className="text-[#f4ecd8] underline">
                    → {entry.link.label}
                  </PageLink>
                </p>
              )}
            </div>
          ))}
        </div>
        <form onSubmit={submit} className="flex gap-2">
          <label htmlFor="pi-terminal-input" className="text-[#e8c95a]">
            {PROMPT}
          </label>
          <input
            ref={inputRef}
            id="pi-terminal-input"
            aria-label="Command"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent text-[#9ee07a] caret-[#9ee07a] outline-none"
          />
        </form>
      </div>
      <p className="mt-3 text-xs text-[#6d6359]">
        Type <kbd>help</kbd> for commands, <kbd>exit</kbd> or Escape to step away. The real thing is written up in{' '}
        <PageLink href={SERIES} className="underline">
          the home server series
        </PageLink>
        .
      </p>
    </PanelWindow>
  )
}
