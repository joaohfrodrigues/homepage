/// <reference types="bun" />
import { describe, expect, test } from 'bun:test'
import { buildDialogue, joaoTips } from '../../src/components/house/dialogues'
import type { VisitorStats } from '../../src/components/house/visitor-stats'
import type { HouseData } from '../../src/lib/house'

const DATA: HouseData = { trips: [], geoPhotos: [], contactLinks: [] }

function stats(change: Partial<VisitorStats> = {}): VisitorStats {
  return {
    firstVisit: null,
    visits: 1,
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
    chats: 1,
    knocks: 0,
    pets: 0,
    scoops: 0,
    naps: 0,
    outfits: 0,
    missionSteps: [],
    overdoses: 0,
    beers: 0,
    dozes: 0,
    ...change,
  }
}

/** Stats for a visitor who has done everything João would point at. */
const SEEN_IT_ALL: Partial<VisitorStats> = {
  bicas: { perfect: 1, good: 0, under: 0, over: 0 },
  geoRounds: 1,
  pets: 1,
  rooms: { study: 1, bedroom: 1, balcony: 1 },
}

describe('João', () => {
  test('introduces himself and points at the contact note on the first chat', () => {
    const dialogue = buildDialogue('joao', DATA, { night: false, stats: stats({ chats: 1 }) })
    expect(dialogue.lines[0]).toContain("I'm João")
    expect(dialogue.lines.some((line) => line.includes('front door'))).toBe(true)
    expect(dialogue.choices.map((choice) => choice.label)).toEqual([
      'What should I check out?',
      'More about me →',
      'See you around',
    ])
  })

  test('skips the introduction on later chats and gives a tip instead', () => {
    const dialogue = buildDialogue('joao', DATA, { night: false, stats: stats({ chats: 2 }) })
    expect(dialogue.lines.join(' ')).not.toContain("I'm João")
    expect(dialogue.lines.join(' ')).not.toContain('front door')
    expect(dialogue.lines.at(-1)).toBe(joaoTips(stats(), false)[0])
    expect(dialogue.choices[0].label).toBe('Any other tips?')
  })

  test('the follow-up tip is not the one he just gave', () => {
    const later = stats({ chats: 2 })
    const greeting = buildDialogue('joao', DATA, { night: false, stats: later })
    const followUp = buildDialogue('joao-tip', DATA, { night: false, stats: later })
    expect(followUp.lines[0]).not.toBe(greeting.lines.at(-1)!)
    expect(followUp.lines[0]).toBe(joaoTips(later, false)[1])
  })

  test('tips drop out once done, and the balcony one only shows at night', () => {
    expect(joaoTips(stats(SEEN_IT_ALL), true)).toEqual([])
    const noBalcony = { ...SEEN_IT_ALL, rooms: { study: 1, bedroom: 1 } }
    expect(joaoTips(stats(noBalcony), false)).toEqual([])
    expect(joaoTips(stats(noBalcony), true)).toHaveLength(1)
  })

  test('with nothing left to point at, he just says so and offers no more tips', () => {
    const dialogue = buildDialogue('joao', DATA, { night: false, stats: stats({ ...SEEN_IT_ALL, chats: 5 }) })
    expect(dialogue.lines.at(-1)).toContain('Make yourself at home')
    expect(dialogue.choices.some((choice) => choice.kind === 'next')).toBe(false)
  })
})
