import { createHash, timingSafeEqual } from 'node:crypto'
import { getBoard, TOP_DEFAULT, TOP_MAX, type ScoreEntry } from './boards'
import { publicEntry, type ScoreStore } from './store'
import { checkSubmission } from './validate'

/**
 * The scores API, kept apart from the route files so tests can call it with a
 * plain Request and a memory store. Every response is JSON; failures carry an
 * `error` message meant to be shown to the visitor as is.
 */

/** Bodies are a name, a number and a few details: anything bigger isn't a score. */
const MAX_BODY_BYTES = 2048

const OFFLINE = { error: 'The scoreboards are offline right now.', offline: true }

const json = (body: unknown, status = 200, headers?: HeadersInit) => Response.json(body, { status, headers })

/** Short, stable and not reversible: entry ids and rate-limit keys never expose what they're made from. */
function digest(...parts: string[]): string {
  return createHash('sha256').update(parts.join(':')).digest('base64url').slice(0, 16)
}

/** The visitor's IP as Vercel passes it on, or a shared bucket when there isn't one. */
function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || request.headers.get('x-real-ip') || 'unknown'
}

/** `GET ?board=geoguess&limit=10`: the board's top entries. */
export async function listScores(request: Request, store: ScoreStore | null): Promise<Response> {
  const params = new URL(request.url).searchParams
  const board = getBoard(params.get('board') ?? '')
  if (!board) return json({ error: 'Unknown board.', field: 'board' }, 400)
  const limit = Math.min(TOP_MAX, Math.max(1, parseInt(params.get('limit') ?? '', 10) || TOP_DEFAULT))
  if (!store) return json(OFFLINE, 503)
  try {
    const entries = await store.top(board, limit)
    // A short shared cache keeps a busy house from reading the store on every visit.
    return json({ board: board.id, entries }, 200, { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=300' })
  } catch (error) {
    console.error('scores: listing failed', error)
    return json(OFFLINE, 503)
  }
}

/**
 * `POST { board, player, name, score, meta? }`: saves the visitor's entry. A
 * board ranked by score keeps each visitor's best; one listed by date keeps
 * their latest. Answers with the saved entry, its rank and the fresh top list.
 */
export async function submitScore(request: Request, store: ScoreStore | null): Promise<Response> {
  const text = await request.text()
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return json({ error: 'That submission is too large.', field: 'body' }, 413)
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return json({ error: 'Send a JSON object.', field: 'body' }, 400)
  }
  // Checked before the store, so bad input gets a useful answer even offline.
  const checked = checkSubmission(body)
  if (!checked.ok) return json({ error: checked.error, field: checked.field }, 400)
  if (!store) return json(OFFLINE, 503)

  const { board, player, name, score, meta } = checked.value
  try {
    const limit = await store.limit(digest('ip', clientIp(request)))
    if (!limit.ok) {
      return json({ error: 'Too many submissions. Try again in a minute.' }, 429, { 'Retry-After': String(limit.retryAfter) })
    }

    const id = digest(board.id, player)
    const old = await store.get(board, id)
    // Not a new best: the old score and date stand, under the name just given.
    const keepOld = board.order === 'score' && old !== null && old.score >= score
    const entry: ScoreEntry = keepOld && old
      ? { ...publicEntry(old), name }
      : { id, name, score, ...(meta && { meta }), at: new Date().toISOString() }
    await store.put(board, entry)

    const entries = await store.top(board, TOP_DEFAULT)
    const index = entries.findIndex((e) => e.id === id)
    return json({ entry, improved: !keepOld, rank: index === -1 ? null : index + 1, entries }, 201)
  } catch (error) {
    console.error('scores: submit failed', error)
    return json(OFFLINE, 503)
  }
}

function secretMatches(given: string, secret: string): boolean {
  const a = Buffer.from(given)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * `POST { board, id, hidden }` with `Authorization: Bearer <SCORES_ADMIN_SECRET>`:
 * hides an entry (or shows it again). Without a secret configured the route is shut.
 */
export async function moderateScore(request: Request, store: ScoreStore | null, secret: string | undefined): Promise<Response> {
  const given = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (!secret || !secretMatches(given, secret)) return json({ error: 'Not allowed.' }, 401)
  let body: { board?: unknown; id?: unknown; hidden?: unknown }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Send a JSON object.', field: 'body' }, 400)
  }
  const board = typeof body.board === 'string' ? getBoard(body.board) : undefined
  if (!board) return json({ error: 'Unknown board.', field: 'board' }, 400)
  if (typeof body.id !== 'string' || typeof body.hidden !== 'boolean') {
    return json({ error: 'Send the entry id and hidden: true or false.', field: 'id' }, 400)
  }
  if (!store) return json(OFFLINE, 503)
  const found = await store.setHidden(board, body.id, body.hidden)
  return found ? json({ id: body.id, hidden: body.hidden }) : json({ error: 'No such entry.', field: 'id' }, 404)
}
