/**
 * Lisbon's sun, worked out from the date alone (no API): where it sits in the
 * sky, and what that means for the house's light. The house follows Lisbon's
 * sky wherever the visitor is, as it does Lisbon's weather.
 */

const LISBON = { lat: 38.7223, lon: -9.1393 }
/** The sun's centre at this elevation means its top edge is on the horizon, refraction included. */
const HORIZON = -0.833

const RAD = Math.PI / 180

/** The house's light for a moment of the day. */
export interface Sky {
  /** 0 by day, 1 once dusk is over: how far the house has sunk into the night. */
  night: number
  /** 0 to 1: how golden the light is, with the sun low around sunrise and sunset. */
  warmth: number
  /** The moon's age: 0 new, 0.5 full (see `moonAge`). */
  moon: number
}

/** The sun's elevation over Lisbon in degrees (negative below the horizon), to about a tenth of a degree. */
export function sunElevation(date: Date): number {
  // Days since J2000.0.
  const n = date.getTime() / 86_400_000 + 2440587.5 - 2451545
  const meanLongitude = (280.46 + 0.9856474 * n) % 360
  const anomaly = ((357.528 + 0.9856003 * n) % 360) * RAD
  const longitude = (meanLongitude + 1.915 * Math.sin(anomaly) + 0.02 * Math.sin(2 * anomaly)) * RAD
  const obliquity = (23.439 - 0.0000004 * n) * RAD
  const ascension = Math.atan2(Math.cos(obliquity) * Math.sin(longitude), Math.cos(longitude))
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(longitude))
  const siderealHours = (18.697374558 + 24.06570982441908 * n) % 24
  const hourAngle = (siderealHours * 15 + LISBON.lon) * RAD - ascension
  const lat = LISBON.lat * RAD
  return (
    Math.asin(Math.sin(lat) * Math.sin(declination) + Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle)) / RAD
  )
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const smooth = (x: number) => x * x * (3 - 2 * x)

/**
 * The house's light at `date`. Night deepens from just before sunset until
 * the end of civil twilight (the sun 6° down, and a little past it), and lifts
 * the same way at dawn; the light goes golden while the sun is low.
 */
export function skyAt(date: Date): Sky {
  const elevation = sunElevation(date)
  const night = smooth(clamp01((2 - elevation) / 10))
  const rising = clamp01((elevation + 4) / 5)
  const setting = clamp01((12 - elevation) / 10)
  return { night, warmth: smooth(rising * setting), moon: moonAge(date) }
}

/** Whether the house counts as at night: lamps on, the moon in the HUD, João's night-time lines. */
export function isNight(sky: Sky): boolean {
  return sky.night >= 0.5
}

/** The next sunrise (or sunset) after `from`, to the minute. */
export function nextSun(event: 'sunrise' | 'sunset', from: Date): Date {
  const step = 60_000
  let previous = sunElevation(from) - HORIZON
  // Lisbon's sun always rises and sets within a day; two days is plenty.
  for (let t = from.getTime() + step; t < from.getTime() + 2 * 86_400_000; t += step) {
    const current = sunElevation(new Date(t)) - HORIZON
    if (event === 'sunrise' ? previous < 0 && current >= 0 : previous >= 0 && current < 0) return new Date(t)
    previous = current
  }
  return new Date(from.getTime() + 86_400_000)
}

/** The time it is in Lisbon at `date`, in minutes past midnight. */
function lisbonMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Lisbon',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  return part('hour') * 60 + part('minute')
}

/**
 * How far to move the clock, in ms, so that it reads `hhmm` (e.g. "21:15")
 * in Lisbon on the day of `now`; null if `hhmm` isn't a time.
 */
export function offsetToLisbonTime(hhmm: string, now: Date): number | null {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(hhmm)
  if (!match) return null
  const target = Number(match[1]) * 60 + Number(match[2])
  return (target - lisbonMinutes(now)) * 60_000 - (now.getTime() % 60_000)
}

/** A synodic month, new moon to new moon, in days. */
const SYNODIC_MONTH = 29.530588853
/** A new moon to count from: 6 January 2000, 18:14 UTC. */
const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14)

/** How far through its cycle the moon is at `date`: 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter. */
export function moonAge(date: Date): number {
  const days = (date.getTime() - NEW_MOON) / 86_400_000
  return (((days / SYNODIC_MONTH) % 1) + 1) % 1
}
