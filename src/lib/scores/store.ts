import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import type { Board, ScoreEntry } from './boards'

/** What the store keeps per entry: the public fields plus the moderation flag. */
export interface StoredEntry extends ScoreEntry {
  hidden?: boolean
}

export interface RateLimit {
  ok: boolean
  /** Seconds until the next submission would be let through. */
  retryAfter: number
}

/**
 * Where scores live. The API only talks to this, so the site runs on Upstash
 * Redis in production and on memory in tests (and local dev, if asked for).
 */
export interface ScoreStore {
  /** The board's visible entries in listing order. */
  top(board: Board, limit: number): Promise<ScoreEntry[]>
  get(board: Board, id: string): Promise<StoredEntry | null>
  /** Saves an entry over any with the same id. Hidden entries stay hidden. */
  put(board: Board, entry: StoredEntry): Promise<void>
  /** Hides or shows an entry; false if there's no such entry. */
  setHidden(board: Board, id: string, hidden: boolean): Promise<boolean>
  /** Counts one submission against `key` (a hashed IP). */
  limit(key: string): Promise<RateLimit>
}

/** Submissions allowed per IP in each window. */
export const SUBMIT_LIMIT = 5
export const SUBMIT_WINDOW_SECONDS = 60

/**
 * Where an entry sits in its board's sorted set: its score, or its time for a
 * board listed newest first. On ties the earlier entry ranks higher, so the
 * submission time goes in as a fraction below the whole score.
 */
export function rankValue(board: Board, entry: ScoreEntry): number {
  const time = Date.parse(entry.at)
  return board.order === 'recent' ? time : entry.score + (1 - time / 1e13)
}

/** An entry without its moderation flag, as the API hands it out. */
export function publicEntry({ id, name, score, meta, at }: StoredEntry): ScoreEntry {
  return { id, name, score, ...(meta && { meta }), at }
}

/** Keeps everything in this process. Fine for tests and `bun run dev`; not for serverless production. */
export function memoryStore(now: () => number = Date.now): ScoreStore {
  const boards = new Map<string, Map<string, StoredEntry>>()
  const hits = new Map<string, number[]>()
  const entriesOf = (board: Board) => {
    let entries = boards.get(board.id)
    if (!entries) boards.set(board.id, (entries = new Map()))
    return entries
  }

  return {
    async top(board, limit) {
      return [...entriesOf(board).values()]
        .filter((entry) => !entry.hidden)
        .sort((a, b) => rankValue(board, b) - rankValue(board, a))
        .slice(0, limit)
        .map(publicEntry)
    },
    async get(board, id) {
      return entriesOf(board).get(id) ?? null
    },
    async put(board, entry) {
      const old = entriesOf(board).get(entry.id)
      entriesOf(board).set(entry.id, { ...entry, hidden: entry.hidden ?? old?.hidden })
    },
    async setHidden(board, id, hidden) {
      const entry = entriesOf(board).get(id)
      if (!entry) return false
      entry.hidden = hidden
      return true
    },
    async limit(key) {
      const windowStart = now() - SUBMIT_WINDOW_SECONDS * 1000
      const recent = (hits.get(key) ?? []).filter((at) => at > windowStart)
      if (recent.length >= SUBMIT_LIMIT) {
        hits.set(key, recent)
        return { ok: false, retryAfter: Math.ceil((recent[0] - windowStart) / 1000) }
      }
      hits.set(key, [...recent, now()])
      return { ok: true, retryAfter: 0 }
    },
  }
}

/**
 * Upstash Redis: per board, a hash of entries by id plus a sorted set of the
 * visible ids by rank. Hiding an entry drops it from the set but keeps it in
 * the hash, so it can be shown again.
 */
export function redisStore(redis: Redis): ScoreStore {
  const entriesKey = (board: Board) => `scores:${board.id}:entries`
  const rankKey = (board: Board) => `scores:${board.id}:rank`
  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(SUBMIT_LIMIT, `${SUBMIT_WINDOW_SECONDS} s`),
    prefix: 'scores:ratelimit',
  })

  const get = async (board: Board, id: string) => (await redis.hget<StoredEntry>(entriesKey(board), id)) ?? null

  return {
    async top(board, limit) {
      const ids = await redis.zrange<string[]>(rankKey(board), 0, limit - 1, { rev: true })
      if (ids.length === 0) return []
      const found = (await redis.hmget<Record<string, StoredEntry | null>>(entriesKey(board), ...ids)) ?? {}
      return ids.flatMap((id) => {
        const entry = found[id]
        return entry && !entry.hidden ? [publicEntry(entry)] : []
      })
    },
    get,
    async put(board, entry) {
      const old = await get(board, entry.id)
      const stored: StoredEntry = { ...entry, hidden: entry.hidden ?? old?.hidden }
      await redis.hset(entriesKey(board), { [entry.id]: stored })
      if (stored.hidden) await redis.zrem(rankKey(board), entry.id)
      else await redis.zadd(rankKey(board), { score: rankValue(board, entry), member: entry.id })
    },
    async setHidden(board, id, hidden) {
      const entry = await get(board, id)
      if (!entry) return false
      await this.put(board, { ...entry, hidden })
      return true
    },
    async limit(key) {
      const { success, reset } = await ratelimit.limit(key)
      return { ok: success, retryAfter: success ? 0 : Math.max(1, Math.ceil((reset - Date.now()) / 1000)) }
    },
  }
}

let shared: ScoreStore | null | undefined

/**
 * The store the API uses, or null when none is configured: then every board
 * reads as offline. Upstash's Vercel integration sets either the UPSTASH_* or
 * the older KV_* names, so both are accepted. SCORES_STORE=memory forces the
 * in-memory store for local development.
 */
export function getScoreStore(): ScoreStore | null {
  if (shared !== undefined) return shared
  const redis = redisFromEnv()
  if (process.env.SCORES_STORE === 'memory') shared = memoryStore()
  else if (redis) shared = redisStore(redis)
  else shared = null
  return shared
}

/** The site's Upstash Redis, from either naming of its env vars, or null when there isn't one. */
export function redisFromEnv(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN
  return url && token ? new Redis({ url, token }) : null
}
