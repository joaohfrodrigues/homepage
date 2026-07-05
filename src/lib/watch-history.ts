import { readFileSync } from 'fs'
import { join } from 'path'

export type WatchEntryType = 'film' | 'series'

export type WatchEntry = {
  id: string
  title: string
  type: WatchEntryType
  watchedAt: string
  year: number | null
  posterUrl: string | null
  rating: number | null
  note: string | null
}

const WATCH_HISTORY_PATH = join(process.cwd(), 'data', 'watch-history.json')

export async function getWatchHistory(): Promise<WatchEntry[]> {
  let raw: string
  try {
    raw = readFileSync(WATCH_HISTORY_PATH, 'utf-8')
  } catch {
    return []
  }

  const entries = JSON.parse(raw) as WatchEntry[]
  return [...entries].sort((a, b) => b.watchedAt.localeCompare(a.watchedAt))
}
