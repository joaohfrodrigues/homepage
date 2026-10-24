'use client'

import { useId, useState } from 'react'
import { BOARDS, type BoardId } from '@/lib/scores/boards'
import { GAME_BOARDS } from '@/lib/scores/client'
import { Leaderboard, TabBar, useBoard, useSubmitSlot } from './leaderboard'
import { PanelWindow } from './panel-window'
import { readStats, type VisitorStats } from './visitor-stats'

interface Props {
  onClose: () => void
}

/** The tab opened last, so the poster opens where the visitor left it. */
const TAB_KEY = 'house:leaderboard-tab'

/** Where each game keeps the visitor's own best in their stats. */
const LOCAL_BEST: Partial<Record<BoardId, (stats: VisitorStats) => number>> = {
  geoguess: (stats) => stats.geoBest,
  bica: (stats) => stats.bicaBestStreak,
}

/** Where to find each game, for a visitor who hasn't played it yet. */
const WHERE: Partial<Record<BoardId, string>> = {
  geoguess: 'the fridge in the kitchen',
  bica: 'the coffee machine in the kitchen',
}

function savedTab(): BoardId {
  try {
    const tab = window.localStorage.getItem(TAB_KEY)
    if (GAME_BOARDS.includes(tab as BoardId)) return tab as BoardId
  } catch {
    // No storage: start on the first board.
  }
  return GAME_BOARDS[0]
}

function BoardTab({ board, best, id, hidden }: { board: BoardId; best: number; id: string; hidden: boolean }) {
  const [state, setEntries] = useBoard(board)
  const { slot, ownId } = useSubmitSlot(board, best, setEntries)
  const { unit } = BOARDS[board]
  return (
    <div role="tabpanel" id={`${id}-${board}`} aria-labelledby={`${id}-${board}-tab`} hidden={hidden}>
      <p className="mb-3 text-sm text-[#6d6359]">
        {best > 0 ? (
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

/** The corridor's trophy poster up close: a tab for each game's top 10. */
export function ScoresPanel({ onClose }: Props) {
  const [tab, setTab] = useState(savedTab)
  // Only ever rendered client-side (it opens from the game), so localStorage is safe here.
  const [stats] = useState(readStats)
  const id = useId()

  function show(next: BoardId) {
    setTab(next)
    try {
      window.localStorage.setItem(TAB_KEY, next)
    } catch {
      // Opens on the first board next time.
    }
  }

  return (
    <PanelWindow eyebrow="Corridor · Trophy poster" title="Leaderboards" onClose={onClose}>
      <p className="mb-4 text-sm text-[#6d6359]">
        The best visitors at the kitchen games. Beat your own best at the fridge or the coffee machine to put your name up.
      </p>
      <TabBar
        id={id}
        label="Leaderboards"
        tabs={GAME_BOARDS.map((board) => ({ key: board, label: BOARDS[board].title }))}
        current={tab}
        onSelect={show}
      />
      {GAME_BOARDS.map((board) => (
        <BoardTab key={board} board={board} best={LOCAL_BEST[board]?.(stats) ?? 0} id={id} hidden={tab !== board} />
      ))}
    </PanelWindow>
  )
}
