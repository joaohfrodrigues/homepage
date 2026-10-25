/// <reference types="bun" />
import { describe, expect, test } from 'bun:test'
import { isNight, moonAge, nextSun, offsetToLisbonTime, skyAt, sunElevation } from '../../src/lib/sun'

/** Minutes between two dates. */
const minutes = (a: Date, b: Date) => Math.abs(a.getTime() - b.getTime()) / 60_000

describe("Lisbon's sun", () => {
  test('stands high at midsummer noon and well below the horizon at midnight', () => {
    // Solar noon in Lisbon is about 13:36 WEST (12:36 UTC); the sun reaches ~74.7°.
    expect(sunElevation(new Date('2026-06-21T12:36:00Z'))).toBeCloseTo(74.7, 0)
    expect(sunElevation(new Date('2026-06-21T23:36:00Z'))).toBeLessThan(-20)
    // At the winter solstice it only reaches ~27.8°.
    expect(sunElevation(new Date('2026-12-21T12:36:00Z'))).toBeCloseTo(27.8, 0)
  })

  test('rises and sets within a few minutes of the almanac', () => {
    // 21 June 2026: sunrise 06:12 WEST, sunset 21:05 WEST.
    const june = new Date('2026-06-21T00:00:00Z')
    expect(minutes(nextSun('sunrise', june), new Date('2026-06-21T05:12:00Z'))).toBeLessThan(4)
    expect(minutes(nextSun('sunset', june), new Date('2026-06-21T20:05:00Z'))).toBeLessThan(4)
    // 21 December 2026: sunrise 07:51 WET, sunset 17:18 WET.
    const december = new Date('2026-12-21T00:00:00Z')
    expect(minutes(nextSun('sunrise', december), new Date('2026-12-21T07:51:00Z'))).toBeLessThan(4)
    expect(minutes(nextSun('sunset', december), new Date('2026-12-21T17:18:00Z'))).toBeLessThan(4)
  })

  test('turns to night gradually through dusk, golden while the sun is low', () => {
    const sunset = nextSun('sunset', new Date('2026-10-24T00:00:00Z'))
    const at = (mins: number) => skyAt(new Date(sunset.getTime() + mins * 60_000))
    expect(at(-180)).toMatchObject({ night: 0, warmth: 0 })
    expect(at(-30).warmth).toBeGreaterThan(0.5)
    expect(at(-30).night).toBeLessThan(0.3)
    expect(at(10).night).toBeGreaterThan(at(-10).night)
    expect(at(20).night).toBeGreaterThan(at(10).night)
    expect(at(60)).toMatchObject({ night: 1, warmth: 0 })
    expect(isNight(at(-60))).toBe(false)
    expect(isNight(at(45))).toBe(true)
  })

  test('moves the clock to a Lisbon time of day, whatever the season', () => {
    // 24 October 2026 is still summer time in Lisbon (UTC+1).
    const now = new Date('2026-10-24T10:20:30Z')
    expect(offsetToLisbonTime('21:15', now)).toBe((9 * 60 + 55) * 60_000 - 30_000)
    expect(offsetToLisbonTime('nonsense', now)).toBeNull()
    expect(offsetToLisbonTime('25:00', now)).toBeNull()
    // In December Lisbon is on UTC.
    expect(offsetToLisbonTime('12:00', new Date('2026-12-01T12:00:00Z'))).toBe(0)
  })

  test('knows the phase of the moon', () => {
    // The total eclipse of 8 April 2024 fell on a new moon (18:21 UTC).
    const eclipse = moonAge(new Date('2024-04-08T18:21:00Z'))
    expect(Math.min(eclipse, 1 - eclipse)).toBeLessThan(0.02)
    // The full moon of 17 October 2024 (11:26 UTC).
    expect(moonAge(new Date('2024-10-17T11:26:00Z'))).toBeCloseTo(0.5, 1)
  })
})
