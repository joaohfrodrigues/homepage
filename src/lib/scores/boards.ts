/**
 * The public scoreboards. Shared by the API (bounds checked on the server) and
 * the house (titles and formatting), so it must stay free of server-only code.
 * Adding a board is one entry here; the store and API pick it up by id.
 */

/** Small numeric facts stored with an entry, e.g. the sticker total at signing time. */
export type ScoreMeta = Record<string, number | boolean>

export interface Board {
  id: string
  title: string
  /** Lowest and highest score accepted, inclusive. Scores are whole numbers. */
  min: number
  max: number
  /**
   * How the board is listed: by score (highest first) or by when entries were
   * submitted (newest first, like the Hall of Fame).
   */
  order: 'score' | 'recent'
  /** Board-specific checks on `meta`; returns an error message, or null if it's fine. */
  checkMeta?: (meta: ScoreMeta, score: number) => string | null
}

export const BOARDS = {
  // Five photos at up to 1000 points each.
  geoguess: { id: 'geoguess', title: 'Fridge magnets', min: 0, max: 5000, order: 'score' },
  // The needle tops out at its fastest after eight perfect pulls; past 100 in
  // a row is a script, not a barista.
  bica: { id: 'bica', title: 'Bica streak', min: 1, max: 100, order: 'score' },
  // Score is the stickers earned when signing; `total` is how many existed then.
  'hall-of-fame': {
    id: 'hall-of-fame',
    title: 'Hall of Fame',
    min: 1,
    max: 100,
    order: 'recent',
    checkMeta: (meta, score) =>
      Number.isInteger(meta.total) && (meta.total as number) >= score && (meta.total as number) <= 100
        ? null
        : 'A Hall of Fame entry needs the sticker total it was signed with.',
  },
} satisfies Record<string, Board>

export type BoardId = keyof typeof BOARDS

export function getBoard(id: string): Board | undefined {
  return Object.hasOwn(BOARDS, id) ? BOARDS[id as BoardId] : undefined
}

/** One line on a board, as the API returns it. */
export interface ScoreEntry {
  /** Stable per board and browser, so a visitor can spot (and improve) their own entry. */
  id: string
  name: string
  score: number
  meta?: ScoreMeta
  /** When the entry was last saved (ISO 8601). */
  at: string
}

/** How many entries a board lists by default, and at most. */
export const TOP_DEFAULT = 10
export const TOP_MAX = 50
