import type { PlayerEffect } from '@/game/bridge'

/**
 * Counts things done within a sliding time window, e.g. bicas in the last five
 * minutes. Kept in memory only, so a reload starts every count again, and
 * separate from the lifetime stats in visitor-stats.ts.
 */
class Tally {
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

  /** How long ago the oldest one within the window was, in ms; 0 if there are none. */
  span(now = Date.now()): number {
    return this.count(now) ? now - this.times[0] : 0
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

/** Beers lately: tipsy at three, dizzy at five, and at seven you doze off on the sofa. */
export const beer = new Tally(10 * 60_000)
export const TIPSY_AT = 3
export const DIZZY_AT = 5
export const DOZE_AT = 7

/** A gentle sway and faintly breathing edges. Each beer starts the clock again. */
export const BEER_TIPSY: PlayerEffect = { sway: 3, vignette: 0.2, tint: 0xffe0d4, ms: 120_000 }
/**
 * A wider sway, steps that wander a little, darker breathing edges and a view
 * that keeps slipping out of focus; under reduced motion the tint, still edges
 * and a faint steady blur.
 */
export const BEER_DIZZY: PlayerEffect = {
  speed: 0.85,
  sway: 6,
  drift: 0.15,
  vignette: 0.5,
  blur: 0.7,
  tint: 0xffc4cc,
  ms: 120_000,
}

/**
 * The morning after dozing off: slow feet, heavy edges and a head that won't
 * quite focus, for five minutes, or half a minute more once the paracetamol
 * from the bathroom cabinet is down.
 */
export const HANGOVER: PlayerEffect = { speed: 0.8, vignette: 0.3, blur: 0.35, ms: 5 * 60_000 }
export const HANGOVER_TREATED_MS = 30_000

/** Whether the guest is hungover and untreated, kept in memory like the tallies above. */
export const hangover = {
  until: 0,
  start(now = Date.now()) {
    this.until = now + HANGOVER.ms
  },
  /** Slept off, or the paracetamol is down. */
  clear() {
    this.until = 0
  },
  active(now = Date.now()) {
    return now < this.until
  },
}

export function ordinal(n: number): string {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`
  return `${n}${{ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th'}`
}
