import type { PlayerEffect } from '@/game/bridge'

/**
 * Counts things done within a sliding time window, e.g. bicas in the last five
 * minutes. Kept in memory only, so a reload starts every count again, and
 * separate from the lifetime stats in visitor-stats.ts.
 */
export class Tally {
  private times: number[] = []

  constructor(readonly windowMs: number) {}

  /** Records one more now and returns how many fall within the window. */
  add(now = Date.now()): number {
    this.times.push(now)
    return this.count(now)
  }

  count(now = Date.now()): number {
    this.times = this.times.filter((time) => now - time < this.windowMs)
    return this.times.length
  }

  clear() {
    this.times = []
  }
}

/** Bicas pulled lately. Five makes you buzz; ten is an overdose. */
export const caffeine = new Tally(5 * 60_000)
export const BUZZING_AT = 5
export const OVERDOSE_AT = 10

/** Faster feet, a heartbeat shake and trembling hands; a flush under reduced motion. */
export const CAFFEINE_OVERDOSE: PlayerEffect = { speed: 1.5, shake: 0.002, jitter: 1, tint: 0xffb8a0, ms: 75_000 }

export function ordinal(n: number): string {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`
  return `${n}${{ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th'}`
}
