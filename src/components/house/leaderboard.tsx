'use client'

import { useEffect, useId, useState } from 'react'
import { BOARDS, type BoardId, type ScoreEntry, type ScoreMeta } from '@/lib/scores/boards'
import { fetchBoard, lastName, ownEntryId, submittedScore, submitToBoard } from '@/lib/scores/client'
import { NAME_MAX, checkName } from '@/lib/scores/validate'
import { cn } from '@/lib/utils'

export type BoardState = { status: 'loading' } | { status: 'offline' } | { status: 'ok'; entries: ScoreEntry[] }

/** A board's top entries, fetched once `enabled`; the setter takes the fresh list a submission returns. */
export function useBoard(board: BoardId, enabled = true): [BoardState, (entries: ScoreEntry[]) => void] {
  const [state, setState] = useState<BoardState>({ status: 'loading' })
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    fetchBoard(board).then((result) => {
      if (!cancelled) setState(result.status === 'ok' ? result : { status: 'offline' })
    })
    return () => {
      cancelled = true
    }
  }, [board, enabled])
  return [state, (entries) => setState({ status: 'ok', entries })]
}

/** The board's entries, the visitor's own (if on it) highlighted. */
export function Leaderboard({ board, state, ownId }: { board: BoardId; state: BoardState; ownId?: string }) {
  const { title, unit } = BOARDS[board]
  if (state.status === 'loading') return <p className="text-sm text-[#6d6359]">Fetching the board…</p>
  if (state.status === 'offline') {
    return <p className="text-sm text-[#6d6359]">The {title} board is offline right now. Your scores are still kept here.</p>
  }
  if (state.entries.length === 0) return <p className="text-sm text-[#6d6359]">No scores yet. Be the first on the board.</p>
  return (
    <ol className="space-y-1 text-sm" aria-label={`${title} top ${state.entries.length}`}>
      {state.entries.map((entry, i) => {
        const own = entry.id === ownId
        return (
          <li
            key={entry.id}
            aria-current={own ? 'true' : undefined}
            className={cn(
              'grid grid-cols-[2rem_1fr_auto] items-baseline gap-2 border-2 px-2 py-0.5',
              own ? 'border-[#2a2233] bg-[#f0dc96]' : 'border-transparent',
            )}
          >
            <span className="font-pixel text-[#8e2a20]">{i + 1}.</span>
            <span className="truncate">
              {entry.name}
              {own && <span className="font-pixel ml-2 text-xs text-[#6d6359]">you</span>}
            </span>
            <span className="font-pixel">
              {entry.score} <span className="text-xs text-[#6d6359]">{unit}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

interface SubmitProps {
  board: BoardId
  score: number
  meta?: ScoreMeta
  /** Called with the saved entry, its message for the visitor, and the board's fresh top list. */
  onSubmitted: (entry: ScoreEntry, message: string, entries: ScoreEntry[]) => void
}

/** The opt-in form: nothing is sent until the visitor presses the button. */
export function SubmitScore({ board, score, meta, onSubmitted }: SubmitProps) {
  const [name, setName] = useState(lastName)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const inputId = useId()
  const { title, unit } = BOARDS[board]

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const checked = checkName(name)
    if (!checked.ok) {
      setProblem(checked.error)
      return
    }
    setBusy(true)
    setProblem(null)
    const result = await submitToBoard(board, checked.value, score, meta)
    setBusy(false)
    if (result.status === 'offline') setProblem('The leaderboard is offline right now. Try again later.')
    else if (result.status === 'error') setProblem(result.message)
    else {
      const message = !result.improved
        ? `Your best of ${result.entry.score} is already on the board.`
        : result.rank
          ? `You’re number ${result.rank} on the ${title} board!`
          : `Saved. Not in the top ${result.entries.length} yet.`
      onSubmitted(result.entry, message, result.entries)
    }
  }

  return (
    <form onSubmit={submit} className="border-2 border-dashed border-[#b5aa94] p-3 text-sm">
      <label htmlFor={inputId} className="mb-2 block">
        Put your best, <span className="font-pixel">{score} {unit}</span>, on the {title} board?
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id={inputId}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={NAME_MAX}
          autoComplete="nickname"
          placeholder="Your name"
          aria-invalid={problem !== null}
          className="min-w-0 flex-1 basis-40 border-2 border-[#2a2233] bg-[#fbf6ea] px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-[#c9a227]"
        />
        <button type="submit" className="pixel-button" disabled={busy}>
          {busy ? 'Sending…' : 'Submit to the leaderboard'}
        </button>
      </div>
      <p className="mt-2 text-xs text-[#6d6359]" aria-live="polite">
        {problem ?? 'Only this name and score are sent, and only when you press the button.'}
      </p>
    </form>
  )
}

interface TabsProps {
  board: BoardId
  /** The visitor's best on this board, kept in their browser. */
  best: number
  /** Offer to submit on the Play tab too, e.g. right after a new best. */
  offer: boolean
  meta?: ScoreMeta
  children: React.ReactNode
}

/**
 * Play and Top 10 tabs for a kitchen game. The board is only fetched once its
 * tab is opened, and a submission form shows wherever the visitor's best beats
 * what this browser already has on the board.
 */
export function BoardTabs({ board, best, offer, meta, children }: TabsProps) {
  const [tab, setTab] = useState<'play' | 'top'>('play')
  const [opened, setOpened] = useState(false)
  const [state, setEntries] = useBoard(board, opened)
  const [submitted, setSubmitted] = useState(() => submittedScore(board))
  const [ownId, setOwnId] = useState(() => ownEntryId(board))
  const [sent, setSent] = useState<{ score: number; message: string } | null>(null)
  const id = useId()

  function show(next: 'play' | 'top') {
    setTab(next)
    if (next === 'top') setOpened(true)
  }

  const eligible = best >= BOARDS[board].min && best > submitted
  const slot = eligible ? (
    <SubmitScore
      key={best}
      board={board}
      score={best}
      meta={meta}
      onSubmitted={(entry, message, entries) => {
        setSubmitted(entry.score)
        setOwnId(entry.id)
        setSent({ score: best, message })
        setEntries(entries)
      }}
    />
  ) : sent && sent.score === best ? (
    <p className="font-pixel text-sm text-[#8e2a20]" role="status">
      {sent.message}
    </p>
  ) : null

  const tabs = [
    { key: 'play', label: 'Play' },
    { key: 'top', label: 'Top 10' },
  ] as const

  return (
    <>
      <div role="tablist" aria-label="Game or leaderboard" className="-mt-2 mb-4 flex gap-2">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`${id}-${key}-tab`}
            aria-selected={tab === key}
            aria-controls={`${id}-${key}`}
            tabIndex={tab === key ? 0 : -1}
            onClick={() => show(key)}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
              e.preventDefault()
              const next = key === 'play' ? 'top' : 'play'
              show(next)
              document.getElementById(`${id}-${next}-tab`)?.focus()
            }}
            className={cn(
              'font-pixel border-2 border-[#2a2233] px-3 py-1 text-xs uppercase tracking-widest',
              tab === key ? 'bg-[#2a2233] text-[#f4ecd8]' : 'bg-[#fbf6ea] text-[#2a2233] hover:bg-[#ebe0c8]',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${id}-play`} aria-labelledby={`${id}-play-tab`} hidden={tab !== 'play'}>
        {children}
        {offer && slot && <div className="mt-4">{slot}</div>}
      </div>
      <div role="tabpanel" id={`${id}-top`} aria-labelledby={`${id}-top-tab`} hidden={tab !== 'top'}>
        <Leaderboard board={board} state={state} ownId={ownId} />
        {slot && <div className="mt-4">{slot}</div>}
      </div>
    </>
  )
}
