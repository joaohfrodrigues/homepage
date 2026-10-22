import { BOARDS, type BoardId, type ScoreEntry, type ScoreMeta } from './boards'

/**
 * The browser's side of the scores API. Nothing is sent unless the visitor
 * submits; reading a board only fetches it. Any failure to reach the API,
 * including a site with no store configured, reads as offline.
 */

const PLAYER_KEY = 'house:player'
const NAME_KEY = 'house:score-name'
const ENTRIES_KEY = 'house:score-entries'
const PODIUMS_KEY = 'house:podiums'
/** How long the chalkboard's copy of the boards lasts before it's fetched again. */
const PODIUMS_TTL_MS = 5 * 60 * 1000

export type BoardResult = { status: 'ok'; entries: ScoreEntry[] } | { status: 'offline' }

export type SubmitResult =
  | { status: 'ok'; entry: ScoreEntry; improved: boolean; rank: number | null; entries: ScoreEntry[] }
  | { status: 'offline' }
  | { status: 'error'; message: string; field?: string }

export async function fetchBoard(board: BoardId, limit?: number): Promise<BoardResult> {
  const params = new URLSearchParams({ board })
  if (limit) params.set('limit', String(limit))
  try {
    const response = await fetch(`/api/scores?${params}`)
    if (!response.ok) return { status: 'offline' }
    const body = (await response.json()) as { entries: ScoreEntry[] }
    return { status: 'ok', entries: body.entries }
  } catch {
    return { status: 'offline' }
  }
}

export async function submitToBoard(board: BoardId, name: string, score: number, meta?: ScoreMeta): Promise<SubmitResult> {
  try {
    const response = await fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ board, player: playerId(), name, score, meta }),
    })
    const body = await response.json().catch(() => ({}))
    if (response.ok) {
      rememberEntry(board, body.entry)
      rememberName(body.entry.name)
      forgetPodiums()
      return { status: 'ok', ...body }
    }
    if (response.status === 503 || !body.error) return { status: 'offline' }
    return { status: 'error', message: body.error, field: body.field }
  } catch {
    return { status: 'offline' }
  }
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Private mode: forgotten when the tab closes.
  }
}

let sessionPlayer: string | null = null

/** A random id for this browser, so a new best replaces the visitor's old entry rather than adding one. */
function playerId(): string {
  const saved = read(PLAYER_KEY)
  if (saved) return saved
  sessionPlayer ??= crypto.randomUUID()
  write(PLAYER_KEY, sessionPlayer)
  return sessionPlayer
}

/** The name last submitted from this browser, to prefill the next submission. */
export function lastName(): string {
  return read(NAME_KEY) ?? ''
}

function rememberName(name: string) {
  write(NAME_KEY, name)
}

/** What this browser last saw of its own entry on each board. */
function ownEntries(): Partial<Record<BoardId, { id: string; score: number }>> {
  try {
    return JSON.parse(read(ENTRIES_KEY) ?? '{}')
  } catch {
    return {}
  }
}

/** This browser's entry on a board, if it has submitted to it, so the board can highlight it. */
export function ownEntryId(board: BoardId): string | undefined {
  return ownEntries()[board]?.id
}

/** The score this browser's entry on a board holds (0 if it has none), so a panel only offers a better one. */
export function submittedScore(board: BoardId): number {
  return ownEntries()[board]?.score ?? 0
}

function rememberEntry(board: BoardId, { id, score }: ScoreEntry) {
  write(ENTRIES_KEY, JSON.stringify({ ...ownEntries(), [board]: { id, score } }))
}

/** Boards ranked by score: the games, as opposed to the Hall of Fame. */
export const GAME_BOARDS = (Object.keys(BOARDS) as BoardId[]).filter((id) => BOARDS[id].order === 'score')

export type Podiums = Partial<Record<BoardId, ScoreEntry[]>>

/**
 * The top three of every game board, for the kitchen chalkboard. Kept in
 * session storage for a few minutes so walking between pages doesn't refetch.
 * Null when every board is offline.
 */
export async function fetchPodiums(): Promise<Podiums | null> {
  try {
    const cached = JSON.parse(window.sessionStorage.getItem(PODIUMS_KEY) ?? 'null') as { at: number; podiums: Podiums } | null
    if (cached && Date.now() - cached.at < PODIUMS_TTL_MS) return cached.podiums
  } catch {
    // No session storage or a mangled entry: fetch afresh.
  }
  const results = await Promise.all(GAME_BOARDS.map((board) => fetchBoard(board, 3)))
  const podiums: Podiums = {}
  results.forEach((result, i) => {
    if (result.status === 'ok') podiums[GAME_BOARDS[i]] = result.entries
  })
  if (Object.keys(podiums).length === 0) return null
  try {
    window.sessionStorage.setItem(PODIUMS_KEY, JSON.stringify({ at: Date.now(), podiums }))
  } catch {
    // Fetched again next time.
  }
  return podiums
}

/** Drops the chalkboard's cached copy, after a submission changed a board. */
export function forgetPodiums() {
  try {
    window.sessionStorage.removeItem(PODIUMS_KEY)
  } catch {
    // Nothing cached.
  }
}
