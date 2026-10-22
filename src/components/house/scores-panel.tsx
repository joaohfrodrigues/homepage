'use client'

import type { ChalkboardPage } from '@/game/bridge'
import { BOARDS, type BoardId } from '@/lib/scores/boards'
import { GAME_BOARDS, fetchPodiums, ownEntryId } from '@/lib/scores/client'
import { Leaderboard, useBoard } from './leaderboard'
import { PanelWindow } from './panel-window'

interface Props {
  onClose: () => void
}

/** The chalkboard's boards for the scene: each game's short title and top three. Null while they're offline. */
export async function loadChalkboard(): Promise<ChalkboardPage[] | null> {
  const podiums = await fetchPodiums()
  if (!podiums) return null
  return GAME_BOARDS.flatMap((board) => {
    const entries = podiums[board]
    return entries ? [{ title: BOARDS[board].short, rows: entries.map(({ name, score }) => ({ name, score })) }] : []
  })
}

function BoardSection({ board }: { board: BoardId }) {
  const [state] = useBoard(board)
  const { title } = BOARDS[board]
  return (
    <section className="border-4 border-[#2a2233] bg-[#fbf6ea] p-4" aria-label={title}>
      <h3 className="font-pixel mb-3 text-xs uppercase tracking-widest text-[#8e2a20]">{title}</h3>
      <Leaderboard board={board} state={state} ownId={ownEntryId(board)} />
    </section>
  )
}

/** The kitchen chalkboard up close: every game's top 10. */
export function ScoresPanel({ onClose }: Props) {
  return (
    <PanelWindow eyebrow="Kitchen · Chalkboard" title="Top scores" onClose={onClose}>
      <p className="mb-5 text-sm text-[#6d6359]">
        The best visitors at the kitchen games. Beat your own best at the fridge or the coffee machine to put your name up.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {GAME_BOARDS.map((board) => (
          <BoardSection key={board} board={board} />
        ))}
      </div>
    </PanelWindow>
  )
}
