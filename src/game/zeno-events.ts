/**
 * Zeno's rare moments, on top of his usual ambling: knocking something off a
 * shelf, sleeping on the study keyboard, meowing for food (or for a scooped
 * litter box), and following the visitor after a pet. The odds live here, free
 * of Phaser, so the guestbook can name them and tests can pick them.
 */

export type ZenoEventId = 'crash' | 'keyboard' | 'meow' | 'follow'
export const ZENO_EVENTS: ZenoEventId[] = ['crash', 'keyboard', 'meow', 'follow']

/** The ones that happen on their own; following only ever starts with a pet. */
export type ZenoRandomEvent = Exclude<ZenoEventId, 'follow'>

/** Gaps between random events: rare enough to feel special. The first comes a little sooner. */
export const ZENO_EVENT_GAP_MS: [number, number] = [150_000, 300_000]
export const ZENO_FIRST_EVENT_MS: [number, number] = [75_000, 150_000]
/** How likely each random event is when one is due. */
export const ZENO_EVENT_WEIGHTS: Record<ZenoRandomEvent, number> = { crash: 2, keyboard: 2, meow: 1 }
/** Chance a pet sends him trotting after the visitor, and for how long. */
export const ZENO_FOLLOW_CHANCE = 0.3
export const ZENO_FOLLOW_MS: [number, number] = [15_000, 25_000]
/** A litter box left dirty this long gets meowed about. */
export const ZENO_LITTER_NAG_MS = 120_000
/** How long a keyboard nap lasts; the desk still works meanwhile. */
export const ZENO_NAP_MS: [number, number] = [40_000, 75_000]

/** Picks the next random event. A neglected litter box makes a meow much likelier. */
export function pickZenoEvent(random: () => number = Math.random, litterNeglected = false): ZenoRandomEvent {
  if (litterNeglected && random() < 0.6) return 'meow'
  const entries = Object.entries(ZENO_EVENT_WEIGHTS) as [ZenoRandomEvent, number][]
  let roll = random() * entries.reduce((sum, [, weight]) => sum + weight, 0)
  for (const [id, weight] of entries) {
    roll -= weight
    if (roll < 0) return id
  }
  return entries[entries.length - 1][0]
}
