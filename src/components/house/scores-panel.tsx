'use client'

import { useId, useState } from 'react'
import { BOARDS, type BoardId } from '@/lib/scores/boards'
import { GAME_BOARDS } from '@/lib/scores/client'
import { HALL, Leaderboard, TabBar, useBoard, useSubmitSlot } from './leaderboard'
import { PanelWindow } from './panel-window'
import { ACHIEVEMENTS, readStats, type VisitorStats } from './visitor-stats'

interface Props {
  onClose: () => void
}

/** The games' boards, then the Hall of Fame. */
const TABS: BoardId[] = [...GAME_BOARDS, HALL]

/** The tab opened last, so the poster opens where the visitor left it. */
const TAB_KEY = 'house:leaderboard-tab'

function stickersEarned(stats: VisitorStats): number {
  return ACHIEVEMENTS.filter((achievement) => achievement.earned(stats)).length
}

/**
 * Where each board finds what the visitor could put on it. For the Hall of
 * Fame that's the full set of stickers, or nothing until they have it.
 */
const LOCAL_BEST: Record<BoardId, (stats: VisitorStats) => number> = {
  geoguess: (stats) => stats.geoBest,
  bica: (stats) => stats.bicaBestStreak,
  [HALL]: (stats) => (stickersEarned(stats) === ACHIEVEMENTS.length ? ACHIEVEMENTS.length : 0),
}

/** Where to find each game, for a visitor who hasn't played it yet. */
const WHERE: Partial<Record<BoardId, string>> = {
  geoguess: 'the fridge in the kitchen',
  bica: 'the coffee machine in the kitchen',
}

function savedTab(): BoardId {
  try {
    const tab = window.localStorage.getItem(TAB_KEY)
    if (TABS.includes(tab as BoardId)) return tab as BoardId
  } catch {
    // No storage: start on the first board.
  }
  return TABS[0]
}

/** Makes `tab` the one the poster opens on next, e.g. the Hall of Fame from the guestbook. */
export function saveTab(tab: BoardId) {
  try {
    window.localStorage.setItem(TAB_KEY, tab)
  } catch {
    // Opens on the first board next time.
  }
}

/** Above the Hall of Fame: how far the visitor is from signing it. */
function HallIntro({ stats }: { stats: VisitorStats }) {
  const earned = stickersEarned(stats)
  if (earned < ACHIEVEMENTS.length) {
    return (
      <>
        Visitors who collected every sticker. You have <span className="font-pixel text-[#2a2233]">{earned} of {ACHIEVEMENTS.length}</span>:
        the guestbook in the hall says how to earn the rest.
      </>
    )
  }
  return (
    <>
      Visitors who collected every sticker, newest first. You have all{' '}
      <span className="font-pixel text-[#2a2233]">{ACHIEVEMENTS.length}</span>.
    </>
  )
}

function BoardTab({ board, stats, id, hidden }: { board: BoardId; stats: VisitorStats; id: string; hidden: boolean }) {
  const best = LOCAL_BEST[board](stats)
  const [state, setEntries] = useBoard(board)
  // The sticker total is kept with each signature, so older ones still read "13/13" once there are more.
  const { slot, ownId } = useSubmitSlot(board, best, setEntries, board === HALL ? { total: ACHIEVEMENTS.length } : undefined)
  const { unit } = BOARDS[board]
  return (
    <div role="tabpanel" id={`${id}-${board}`} aria-labelledby={`${id}-${board}-tab`} hidden={hidden}>
      <p className="mb-3 text-sm text-[#6d6359]">
        {board === HALL ? (
          <HallIntro stats={stats} />
        ) : best > 0 ? (
          <>
            Your best: <span className="font-pixel text-[#2a2233]">{best} {unit}</span>
          </>
        ) : (
          `Not played yet: the game is at ${WHERE[board]}.`
        )}
      </p>
      <Leaderboard board={board} state={state} ownId={ownId} />
      {slot && <div className="mt-4">{slot}</div>}
    </div>
  )
}

/** The corridor's trophy poster up close: a tab for each game's top 10, and the Hall of Fame. */
export function ScoresPanel({ onClose }: Props) {
  const [tab, setTab] = useState(savedTab)
  // Only ever rendered client-side (it opens from the game), so localStorage is safe here.
  const [stats] = useState(readStats)
  const id = useId()

  function show(next: BoardId) {
    setTab(next)
    saveTab(next)
  }

  return (
    <PanelWindow eyebrow="Corridor · Trophy poster" title="Leaderboards" onClose={onClose}>
      <p className="mb-4 text-sm text-[#6d6359]">
        The best visitors at the kitchen games, and the Hall of Fame of everyone who collected every sticker. Beat your own
        best at the fridge or the coffee machine to put your name up.
      </p>
      <TabBar
        id={id}
        label="Leaderboards"
        tabs={TABS.map((board) => ({ key: board, label: BOARDS[board].title }))}
        current={tab}
        onSelect={show}
      />
      {TABS.map((board) => (
        <BoardTab key={board} board={board} stats={stats} id={id} hidden={tab !== board} />
      ))}
    </PanelWindow>
  )
}
