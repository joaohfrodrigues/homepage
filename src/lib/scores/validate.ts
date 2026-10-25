import { getBoard, type Board, type ScoreMeta } from './boards'
import { isProfane } from './profanity'

export const NAME_MIN = 2
export const NAME_MAX = 16

/**
 * Latin letters (accents included), digits, and single spaces or . _ ' -
 * between them. Keeps names readable in the pixel font and rules out
 * lookalike letters from other scripts.
 */
const NAME_PATTERN = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9]+(?:[ ._'-][A-Za-zÀ-ÖØ-öø-ÿ0-9]+)*$/

/** A random id each browser makes once, so resubmitting replaces its own entry. */
const PLAYER_PATTERN = /^[A-Za-z0-9_-]{16,64}$/

const META_KEY_PATTERN = /^[a-zA-Z]{1,20}$/
const META_MAX_KEYS = 6

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string; field: string }

const fail = (field: string, error: string): { ok: false; error: string; field: string } => ({ ok: false, error, field })

/** Tidies a name (trimmed, single spaces) and checks it; the same rules run in the browser and on the server. */
export function checkName(raw: unknown): Checked<string> {
  if (typeof raw !== 'string') return fail('name', 'Pick a name for the board.')
  const name = raw.normalize('NFC').trim().replace(/\s+/g, ' ')
  if (name.length < NAME_MIN || name.length > NAME_MAX) {
    return fail('name', `Names need ${NAME_MIN} to ${NAME_MAX} characters.`)
  }
  if (!NAME_PATTERN.test(name)) {
    return fail('name', "Names can use letters, digits, and single spaces or . _ ' - between them.")
  }
  if (isProfane(name)) return fail('name', 'Please pick a different name.')
  return { ok: true, value: name }
}

export function checkScore(board: Board, raw: unknown): Checked<number> {
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < board.min || raw > board.max) {
    return fail('score', `Scores on the ${board.title} board are whole numbers from ${board.min} to ${board.max}.`)
  }
  return { ok: true, value: raw }
}

function checkMeta(board: Board, raw: unknown, score: number): Checked<ScoreMeta | undefined> {
  if (raw === undefined || raw === null) {
    const error = board.checkMeta?.({}, score)
    return error ? fail('meta', error) : { ok: true, value: undefined }
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) return fail('meta', 'Extra details must be an object.')
  const entries = Object.entries(raw)
  const valid =
    entries.length <= META_MAX_KEYS &&
    entries.every(
      ([key, value]) =>
        META_KEY_PATTERN.test(key) && (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))),
    )
  // Numbers and flags only: free text would be a second, unfiltered name field.
  if (!valid) return fail('meta', `Extra details are up to ${META_MAX_KEYS} named numbers or true/false values.`)
  const meta = Object.fromEntries(entries) as ScoreMeta
  const error = board.checkMeta?.(meta, score)
  return error ? fail('meta', error) : { ok: true, value: entries.length > 0 ? meta : undefined }
}

export interface Submission {
  board: Board
  player: string
  name: string
  score: number
  meta?: ScoreMeta
}

/** Checks a POSTed body field by field, stopping at the first problem. */
export function checkSubmission(body: unknown): Checked<Submission> {
  if (typeof body !== 'object' || body === null) return fail('body', 'Send a JSON object.')
  const fields = body as Record<string, unknown>
  const board = typeof fields.board === 'string' ? getBoard(fields.board) : undefined
  if (!board) return fail('board', 'Unknown board.')
  if (typeof fields.player !== 'string' || !PLAYER_PATTERN.test(fields.player)) {
    return fail('player', 'Missing or malformed player id.')
  }
  const name = checkName(fields.name)
  if (!name.ok) return name
  const score = checkScore(board, fields.score)
  if (!score.ok) return score
  const meta = checkMeta(board, fields.meta, score.value)
  if (!meta.ok) return meta
  return { ok: true, value: { board, player: fields.player, name: name.value, score: score.value, meta: meta.value } }
}
