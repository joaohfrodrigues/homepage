'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Briefcase } from 'lucide-react'
import type { Weather } from '@/lib/weather'
import { openPage } from './house-navigation'
import { PanelWindow } from './panel-window'
import * as sfx from './sfx'
import {
  complete,
  cwdLabel,
  INITIAL_STATE,
  PLANTED_HISTORY,
  runCommand,
  siteHome,
  type TerminalSound,
} from './terminal-commands'
import { workstationSession, type TerminalEntry, type TerminalLink, type WorkstationInfo } from './terminal-session'
import { updateStats } from './visitor-stats'
import { Prompt, Terminal } from './writing-centerpieces'

const LINK = 'underline-offset-4 hover:text-[#f4ecd8] hover:underline focus-visible:text-[#f4ecd8] focus-visible:underline'

const SOUNDS: Record<TerminalSound, () => void> = { bell: sfx.bell, meow: sfx.meow, steam: sfx.steam }

interface Props {
  info: WorkstationInfo
  weather: Weather
  onClose: () => void
}

/** A link out of the terminal: a page takes over the panel's history entry, a file opens in a new tab. */
function OutputLink({ link }: { link: TerminalLink }) {
  const router = useRouter()
  if (!link.href) return <span>{link.label}</span>
  if (link.download) {
    return (
      <a href={link.href} target="_blank" rel="noopener" className={LINK}>
        {link.label}
      </a>
    )
  }
  const href = link.href
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
      className={LINK}
    >
      {link.label}
    </Link>
  )
}

/** A few seconds of falling green characters over the screen, for `matrix`. */
function MatrixRain({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  })
  useEffect(() => {
    const onDone = () => done.current()
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return onDone()
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight
    const size = 14
    const drops = Array.from({ length: Math.ceil(canvas.width / size) }, () => Math.random() * -20)
    const glyphs = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿ01ZENOBICA'
    let frame = 0
    const timer = window.setInterval(() => {
      ctx.fillStyle = 'rgba(15, 26, 20, 0.2)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#7fd1b9'
      ctx.font = `${size}px monospace`
      drops.forEach((y, i) => {
        ctx.fillText(glyphs[Math.floor(Math.random() * glyphs.length)], i * size, y * size)
        drops[i] = y * size > canvas.height && Math.random() > 0.95 ? 0 : y + 1
      })
      if (++frame > 70) onDone()
    }, 45)
    return () => window.clearInterval(timer)
  }, [])
  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden />
}

/**
 * The study workstation: a terminal on the desk monitor, logged into the Pi at
 * the end of the desk. The session João left on screen links the Work page;
 * from there the visitor can `ls`, `cd` and `open` their way round the site,
 * run the home server series' commands, or look for what `help` leaves out.
 */
export function TerminalPanel({ info, weather, onClose }: Props) {
  const router = useRouter()
  const home = useMemo(() => siteHome(info), [info])
  const [entries, setEntries] = useState<TerminalEntry[]>(() => workstationSession(info))
  const [shell, setShell] = useState(INITIAL_STATE)
  const [input, setInput] = useState('')
  // Commands typed so far, oldest first, starting with João's own; ↑ and ↓ step through them.
  const [history, setHistory] = useState(() => [...PLANTED_HISTORY, ...workstationSession(info).map((entry) => entry.command)])
  const [recall, setRecall] = useState<number | null>(null)
  const [matrix, setMatrix] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const screenRef = useRef<HTMLDivElement>(null)

  // After the window has focused its close button, so typing goes straight to the prompt.
  useEffect(() => {
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    screenRef.current?.scrollTo({ top: screenRef.current.scrollHeight })
  }, [entries])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const command = input
    setInput('')
    setRecall(null)
    const nextHistory = command.trim() ? [...history, command.trim()] : history
    setHistory(nextHistory)
    sfx.keystroke()

    const result = runCommand(shell, command, {
      home,
      now: new Date(),
      weather,
      history: nextHistory,
      random: Math.random,
    })
    const entry: TerminalEntry = { host: shell.host, cwd: cwdLabel(shell.cwd), vim: shell.vim, command, output: result.output }
    setShell(result.state)
    if (result.sound) SOUNDS[result.sound]()
    const { egg } = result
    if (egg || result.reported) {
      updateStats((stats) => {
        if (egg && !stats.terminalEggs.includes(egg)) stats.terminalEggs.push(egg)
        if (result.reported) stats.incidents++
      })
    }

    const effect = result.effect
    if (effect?.type === 'clear') return setEntries([])
    setEntries((previous) => [...previous, entry])
    if (effect?.type === 'close') onClose()
    else if (effect?.type === 'matrix') {
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) setMatrix(true)
    } else if (effect?.type === 'open') {
      if (effect.download) window.open(effect.href, '_blank', 'noopener')
      else openPage(router, effect.href)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // Tab completes, but an empty prompt lets it move focus on as usual.
    if (e.key === 'Tab' && !e.shiftKey && input.trim() && !shell.vim) {
      e.preventDefault()
      setInput(complete(shell, input, home))
      return
    }
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    if (history.length === 0) return
    const step = e.key === 'ArrowUp' ? -1 : 1
    const next = Math.min(history.length, Math.max(0, (recall ?? history.length) + step))
    setRecall(next)
    setInput(history[next] ?? '')
  }

  return (
    <PanelWindow title="Workstation" eyebrow="Study" onClose={onClose}>
      <Terminal>
        <div className="relative">
          <div ref={screenRef} className="max-h-[50dvh] overflow-y-auto" onClick={() => inputRef.current?.focus()}>
            <div role="log" aria-label="Terminal output" aria-live="polite">
              {entries.map((entry, i) => (
                <div key={i} className="mb-3">
                  {entry.vim ? <p>:{entry.command}</p> : <Prompt host={entry.host} cwd={entry.cwd} command={entry.command} />}
                  {entry.output.map((output, j) =>
                    output.kind === 'text' ? (
                      <p key={j} className="overflow-x-auto whitespace-pre text-[#c9d6c3] sm:whitespace-pre-wrap">
                        {output.text}
                      </p>
                    ) : (
                      <p key={j} className="flex flex-wrap gap-x-5">
                        {output.links.map((link) => (
                          <OutputLink key={link.label} link={link} />
                        ))}
                      </p>
                    ),
                  )}
                </div>
              ))}
            </div>
            <form onSubmit={submit} className="flex">
              <label htmlFor="terminal-input" className="shrink-0">
                {shell.vim ? (
                  <span className="text-[#a69cba]">:</span>
                ) : (
                  <>
                    <span className="text-[#e8c95a]">joao@{shell.host}</span>
                    <span className="text-[#a69cba]">:{cwdLabel(shell.cwd)}$&nbsp;</span>
                  </>
                )}
                <span className="sr-only">Command</span>
              </label>
              <input
                ref={inputRef}
                id="terminal-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="send"
                className="min-w-0 flex-1 bg-transparent text-[#7fd1b9] caret-[#7fd1b9] outline-none"
              />
            </form>
          </div>
          {matrix && <MatrixRain onDone={() => setMatrix(false)} />}
        </div>
      </Terminal>
      <p className="mt-3 text-center text-xs text-[#6d6359]">
        Type <kbd>help</kbd> to look around, <kbd>exit</kbd> or Escape to step away.
      </p>
      <div className="mt-4 flex justify-center">
        <Link href="/work" scroll={false} className="pixel-button pointer-coarse:min-h-11">
          <Briefcase size={14} />
          Open the Work page
        </Link>
      </div>
    </PanelWindow>
  )
}
