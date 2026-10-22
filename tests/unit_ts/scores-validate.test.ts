/// <reference types="bun" />
import { describe, expect, test } from 'bun:test'
import { BOARDS } from '../../src/lib/scores/boards'
import { isProfane } from '../../src/lib/scores/profanity'
import { checkName, checkScore, checkSubmission } from '../../src/lib/scores/validate'

const PLAYER = 'test-player-0123456789'

describe('names', () => {
  test('are tidied before they are checked', () => {
    expect(checkName('  Ana   Sofia ')).toEqual({ ok: true, value: 'Ana Sofia' })
    expect(checkName('João')).toEqual({ ok: true, value: 'João' })
    expect(checkName("d'Arc-2.0_x")).toEqual({ ok: true, value: "d'Arc-2.0_x" })
  })

  test('need 2 to 16 characters', () => {
    expect(checkName('A')).toMatchObject({ ok: false, field: 'name', error: 'Names need 2 to 16 characters.' })
    expect(checkName('A'.repeat(17))).toMatchObject({ ok: false, field: 'name' })
    expect(checkName('A'.repeat(16)).ok).toBe(true)
    expect(checkName(42)).toMatchObject({ ok: false, field: 'name' })
  })

  test('only use a limited character set', () => {
    for (const name of ['<script>', 'zero\u200bwidth', 'Ωmega', '--ab', 'ab..cd', 'emoji🙂']) {
      expect(checkName(name)).toMatchObject({ ok: false, field: 'name' })
    }
  })

  test('are run through the profanity filter', () => {
    expect(checkName('xXfuckXx')).toMatchObject({ ok: false, error: 'Please pick a different name.' })
  })
})

describe('the profanity filter', () => {
  test('catches spaced, accented and lookalike spellings', () => {
    for (const name of ['f.u.c.k', 'SH1T', 'Fóda-se', 'merda', 'b1tch', 'puta', 'my ass']) expect(isProfane(name)).toBe(true)
  })

  test('leaves ordinary names alone', () => {
    for (const name of ['Cassandra', 'Grapes', 'Computador', 'Scott', 'Ana Lisa', 'Titus', 'Cuca', 'Dickens']) {
      expect(isProfane(name)).toBe(false)
    }
  })
})

describe('scores', () => {
  test('stay within each board’s bounds', () => {
    expect(checkScore(BOARDS.geoguess, 5000)).toEqual({ ok: true, value: 5000 })
    expect(checkScore(BOARDS.geoguess, 0)).toEqual({ ok: true, value: 0 })
    expect(checkScore(BOARDS.geoguess, 5001)).toMatchObject({
      ok: false,
      field: 'score',
      error: 'Scores on the Fridge magnets board are whole numbers from 0 to 5000.',
    })
    expect(checkScore(BOARDS.bica, 0)).toMatchObject({ ok: false })
    expect(checkScore(BOARDS.bica, 101)).toMatchObject({ ok: false })
  })

  test('are whole numbers', () => {
    for (const score of [12.5, NaN, Infinity, '100', null]) expect(checkScore(BOARDS.geoguess, score).ok).toBe(false)
  })
})

describe('submissions', () => {
  const valid = { board: 'geoguess', player: PLAYER, name: 'Ana', score: 3200 }

  test('come back cleaned when valid', () => {
    expect(checkSubmission({ ...valid, name: ' Ana ' })).toEqual({
      ok: true,
      value: { board: BOARDS.geoguess, player: PLAYER, name: 'Ana', score: 3200, meta: undefined },
    })
  })

  test('need a known board and a player id', () => {
    expect(checkSubmission({ ...valid, board: 'tetris' })).toMatchObject({ ok: false, field: 'board' })
    expect(checkSubmission({ ...valid, board: 'toString' })).toMatchObject({ ok: false, field: 'board' })
    expect(checkSubmission({ ...valid, player: 'short' })).toMatchObject({ ok: false, field: 'player' })
    expect(checkSubmission(null)).toMatchObject({ ok: false, field: 'body' })
  })

  test('only carry numbers and flags as extra details', () => {
    expect(checkSubmission({ ...valid, meta: { rounds: 5, hard: true } })).toMatchObject({ ok: true })
    expect(checkSubmission({ ...valid, meta: { note: 'hello' } })).toMatchObject({ ok: false, field: 'meta' })
    expect(checkSubmission({ ...valid, meta: [1, 2] })).toMatchObject({ ok: false, field: 'meta' })
    const many = Object.fromEntries('abcdefg'.split('').map((key) => [key, 1]))
    expect(checkSubmission({ ...valid, meta: many })).toMatchObject({ ok: false, field: 'meta' })
  })

  test('to the Hall of Fame carry the sticker total they were signed with', () => {
    const signing = { board: 'hall-of-fame', player: PLAYER, name: 'Ana', score: 13 }
    expect(checkSubmission({ ...signing, meta: { total: 13 } })).toMatchObject({ ok: true })
    expect(checkSubmission(signing)).toMatchObject({ ok: false, field: 'meta' })
    expect(checkSubmission({ ...signing, meta: { total: 12 } })).toMatchObject({ ok: false, field: 'meta' })
  })
})
