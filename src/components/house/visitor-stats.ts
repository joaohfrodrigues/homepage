import { METRES_PER_TILE, type RoomId } from '@/game/layout'

const STATS_KEY = 'house:stats'
const VISIT_KEY = 'house:visit-counted'
/** Sticker ids already announced with a toast, so a reload doesn't announce them again. */
const SEEN_KEY = 'house:stickers-seen'

export type BicaResult = 'perfect' | 'good' | 'under' | 'over'

/** Everything the guestbook remembers about a visitor. Lives only in their browser. */
export interface VisitorStats {
  firstVisit: string | null
  visits: number
  rooms: Partial<Record<RoomId, number>>
  steps: number
  bicas: Record<BicaResult, number>
  bicaBestStreak: number
  geoRounds: number
  geoBest: number
  geoGuesses: number
  geoTotalKm: number
  geoClosestKm: number | null
  geoWorstKm: number | null
  chats: number
  knocks: number
  pets: number
  scoops: number
  naps: number
  outfits: number
}

function emptyStats(): VisitorStats {
  return {
    firstVisit: null,
    visits: 0,
    rooms: {},
    steps: 0,
    bicas: { perfect: 0, good: 0, under: 0, over: 0 },
    bicaBestStreak: 0,
    geoRounds: 0,
    geoBest: 0,
    geoGuesses: 0,
    geoTotalKm: 0,
    geoClosestKm: null,
    geoWorstKm: null,
    chats: 0,
    knocks: 0,
    pets: 0,
    scoops: 0,
    naps: 0,
    outfits: 0,
  }
}

let cache: VisitorStats | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null
let visitCounted = false

function load(): VisitorStats {
  if (cache) return cache
  const stats = emptyStats()
  try {
    const saved = window.localStorage.getItem(STATS_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<VisitorStats>
      Object.assign(stats, parsed, { bicas: { ...stats.bicas, ...parsed.bicas }, rooms: { ...parsed.rooms } })
    }
  } catch {
    // Private mode or a mangled entry: start a fresh page.
  }
  cache = stats
  return stats
}

function save() {
  if (saveTimer !== null) clearTimeout(saveTimer)
  saveTimer = null
  if (!cache) return
  try {
    window.localStorage.setItem(STATS_KEY, JSON.stringify(cache))
  } catch {
    // Private mode: the guestbook lasts until the tab closes.
  }
}

/** The live stats. Callers that render them should copy, since walking keeps changing them. */
export function readStats(): VisitorStats {
  return load()
}

/** Changes the stats. Writes are batched so walking doesn't touch storage on every step. */
export function updateStats(change: (stats: VisitorStats) => void) {
  change(load())
  saveTimer ??= setTimeout(save, 1000)
  announceStickers()
}

/** Writes any batched changes now, e.g. before the tab goes away. */
export function flushStats() {
  if (saveTimer !== null) save()
}

/** Counts a new visit once per browser session (reloads and overlay pages don't count). */
export function countVisit() {
  if (visitCounted) return
  visitCounted = true
  try {
    if (window.sessionStorage.getItem(VISIT_KEY)) return
    window.sessionStorage.setItem(VISIT_KEY, '1')
  } catch {
    // No session storage: the module flag above still stops double counting.
  }
  updateStats((stats) => {
    stats.visits++
    stats.firstVisit ??= new Date().toISOString()
  })
}

let seen: Set<string> | null = null
const stickerListeners = new Set<(achievement: Achievement) => void>()

function earnedIds(stats: VisitorStats): string[] {
  return ACHIEVEMENTS.filter((achievement) => achievement.earned(stats)).map((achievement) => achievement.id)
}

function saveSeen(ids: Set<string>): Set<string> {
  seen = ids
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify([...ids]))
  } catch {
    // Private mode: the stickers already shown are remembered until the tab closes.
  }
  return ids
}

function loadSeen(): Set<string> {
  if (seen) return seen
  try {
    const saved = window.localStorage.getItem(SEEN_KEY)
    if (saved) return (seen = new Set(JSON.parse(saved) as string[]))
  } catch {
    // Private mode or a mangled entry: treat it like a first look below.
  }
  // Stickers earned before toasts existed count as seen, so returning visitors aren't flooded.
  return saveSeen(new Set(earnedIds(load())))
}

/** Tells the sticker listeners about any sticker earned since they last heard. */
function announceStickers() {
  // Nobody to show them yet: they wait, unseen, for the next change.
  if (stickerListeners.size === 0) return
  const known = loadSeen()
  const fresh = ACHIEVEMENTS.filter((achievement) => !known.has(achievement.id) && achievement.earned(load()))
  if (fresh.length === 0) return
  saveSeen(new Set([...known, ...fresh.map((achievement) => achievement.id)]))
  fresh.forEach((achievement) => stickerListeners.forEach((fn) => fn(achievement)))
}

/** Calls `fn` with each sticker the visitor newly earns. Returns the unsubscribe. */
export function onStickerEarned(fn: (achievement: Achievement) => void): () => void {
  loadSeen()
  stickerListeners.add(fn)
  return () => stickerListeners.delete(fn)
}

/** Tears the page out of the guestbook: everything starts again from this visit. */
export function resetStats() {
  cache = { ...emptyStats(), visits: 1, firstVisit: new Date().toISOString() }
  save()
  saveSeen(new Set(earnedIds(cache)))
}

export function totalBicas(stats: VisitorStats): number {
  return Object.values(stats.bicas).reduce((sum, n) => sum + n, 0)
}

export function metresWalked(stats: VisitorStats): number {
  return Math.round(stats.steps * METRES_PER_TILE)
}

/** Rooms a visitor can actually walk into (the bathroom stays occupied). */
export const TOUR_ROOMS: RoomId[] = ['hall', 'corridor', 'living', 'kitchen', 'study', 'bedroom', 'balcony']

export interface Achievement {
  id: string
  title: string
  /** How to earn it, shown while it's still locked. */
  hint: string
  earned: (stats: VisitorStats) => boolean
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'grand-tour', title: 'Grand tour', hint: 'Step into every room you can.', earned: (s) => TOUR_ROOMS.every((r) => (s.rooms[r] ?? 0) > 0) },
  { id: 'first-sip', title: 'First sip', hint: 'Pull your first bica.', earned: (s) => totalBicas(s) >= 1 },
  { id: 'caffeine', title: 'Caffeine problem', hint: 'Pull ten bicas.', earned: (s) => totalBicas(s) >= 10 },
  { id: 'barista', title: 'Barista', hint: 'Three perfect bicas in a row.', earned: (s) => s.bicaBestStreak >= 3 },
  { id: 'cartographer', title: 'Cartographer', hint: 'Guess a fridge photo within 50 km.', earned: (s) => s.geoClosestKm !== null && s.geoClosestKm < 50 },
  { id: 'globetrotter', title: 'Globetrotter', hint: 'Score 4000 in one round of fridge magnets.', earned: (s) => s.geoBest >= 4000 },
  { id: 'couch-to-1k', title: 'Couch to 1K', hint: 'Walk a kilometre around the flat.', earned: (s) => metresWalked(s) >= 1000 },
  { id: 'chatterbox', title: 'Chatterbox', hint: 'Talk to João five times.', earned: (s) => s.chats >= 5 },
  { id: 'cat-person', title: 'Cat person', hint: 'Pet Zeno five times.', earned: (s) => s.pets >= 5 },
  { id: 'still-occupied', title: 'Still occupied', hint: 'Knock on the bathroom door three times.', earned: (s) => s.knocks >= 3 },
  { id: 'night-owl', title: 'Night owl', hint: 'Nap until evening.', earned: (s) => s.naps >= 1 },
  { id: 'fashion-week', title: 'Fashion week', hint: 'Change outfit five times.', earned: (s) => s.outfits >= 5 },
  { id: 'regular', title: 'Regular', hint: 'Come back for a fifth visit.', earned: (s) => s.visits >= 5 },
]
