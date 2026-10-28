/// <reference types="bun" />
import { describe, expect, test } from 'bun:test'
import { buildDialogue, joaoTips } from '../../src/components/house/dialogues'
import type { VisitorStats } from '../../src/components/house/visitor-stats'
import type { HouseData } from '../../src/lib/house'

const DATA: HouseData = { trips: [], geoPhotos: [], contactLinks: [], workstation: null }

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
    doorTries: 0,
    pets: 0,
    scoops: 0,
    naps: 0,
    outfits: 0,
    cheats: 0,
    missionSteps: [],
    overdoses: 0,
    beers: 0,
    dozes: 0,
    paracetamols: 0,
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
      'What do you do for work?',
      'More about me',
      'See you around',
    ])
  })

  test('skips the introduction on later chats and gives a tip instead', () => {
    const dialogue = buildDialogue('joao', DATA, { night: false, stats: stats({ chats: 2 }) })
    expect(dialogue.lines.join(' ')).not.toContain("I'm João")
    expect(dialogue.lines.join(' ')).not.toContain('front door')
    const tips = joaoTips(stats(), false)
    expect(dialogue.lines.at(-1)).toBe(tips[2 % tips.length])
    expect(dialogue.choices[0].kind).toBe('next')
  })

  test('the follow-up tip is not the one he just gave', () => {
    const later = stats({ chats: 2 })
    const greeting = buildDialogue('joao', DATA, { night: false, stats: later })
    const followUp = buildDialogue('joao-tip', DATA, { night: false, stats: later })
    expect(followUp.lines[0]).not.toBe(greeting.lines.at(-1)!)
  })

  test('a later chat opens on a different tip, greeting and goodbye than the one before', () => {
    const say = (chats: number) => buildDialogue('joao', DATA, { night: false, stats: stats({ chats }) })
    for (const chats of [2, 3, 4, 5]) {
      const before = say(chats)
      const after = say(chats + 1)
      expect(after.lines[0]).not.toBe(before.lines[0])
      expect(after.lines.at(-1)).not.toBe(before.lines.at(-1))
      expect(after.choices.at(-1)!.label).not.toBe(before.choices.at(-1)!.label)
    }
  })

  test('mentions the season on the first chat and now and then, not every time', () => {
    const say = (chats: number) =>
      buildDialogue('joao', DATA, { night: false, season: 'xmas', stats: stats({ chats }) }).lines.join(' ')
    expect(say(1)).toContain('Feliz Natal')
    expect(say(2)).not.toContain('Feliz Natal')
    expect(say(5)).toContain('Feliz Natal')
  })

  test('tips drop out once done, and the balcony one only shows at night', () => {
    expect(joaoTips(stats(SEEN_IT_ALL), true)).toEqual([])
    const noBalcony = { ...SEEN_IT_ALL, rooms: { study: 1, bedroom: 1 } }
    expect(joaoTips(stats(noBalcony), false)).toEqual([])
    expect(joaoTips(stats(noBalcony), true)).toHaveLength(1)
  })

  test('with nothing left to point at, he makes small talk and offers no more tips', () => {
    const say = (chats: number) => buildDialogue('joao', DATA, { night: false, stats: stats({ ...SEEN_IT_ALL, chats }) })
    expect(say(4).lines.at(-1)).toContain('Make yourself at home')
    expect(say(5).lines.at(-1)).not.toBe(say(4).lines.at(-1))
    expect(say(5).choices.some((choice) => choice.kind === 'next')).toBe(false)
  })
})

describe('The bathroom cabinet', () => {
  const kinds = (dialogue: { choices: { kind: string }[] }) => dialogue.choices.map((choice) => choice.kind)

  test('offers paracetamol only for a hangover', () => {
    const hungover = buildDialogue('cabinet', DATA, { night: false, hungover: true, stats: stats() })
    expect(kinds(hungover)).toEqual(['paracetamol', 'close'])
    const fine = buildDialogue('cabinet', DATA, { night: false, stats: stats() })
    expect(kinds(fine)).toEqual(['close'])
  })

  test('says paracetamol is no cure for still drinking or too much coffee', () => {
    const tipsy = buildDialogue('cabinet', DATA, { night: false, beers: 3, stats: stats() })
    expect(tipsy.lines.join(' ')).toContain('won’t sober you up')
    expect(kinds(tipsy)).toEqual(['close'])
    const buzzing = buildDialogue('cabinet', DATA, { night: false, buzzing: true, stats: stats() })
    expect(buzzing.lines.join(' ')).toContain('too much coffee')
  })

  test('João points at it on waking, door or no door', () => {
    const shut = buildDialogue('sofa-wake', DATA, { night: false, stats: stats() })
    expect(shut.lines.at(-1)).toContain('if you can get that door open')
    const opened = stats({ doorTries: 3, missionSteps: ['ask', 'bica', 'deliver', 'shove'].map((step) => `bathroom/${step}`) })
    expect(buildDialogue('sofa-wake', DATA, { night: false, stats: opened }).lines.at(-1)).toContain('over the bathroom sink')
  })
})
