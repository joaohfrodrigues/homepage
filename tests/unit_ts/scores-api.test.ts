/// <reference types="bun" />
import { describe, expect, test } from 'bun:test'
import { listScores, moderateScore, submitScore } from '../../src/lib/scores/api'
import { memoryStore, SUBMIT_LIMIT } from '../../src/lib/scores/store'

const URL_BASE = 'https://example.test/api/scores'

function post(body: unknown, ip = '203.0.113.7') {
  return new Request(URL_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `${ip}, 10.0.0.1` },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

const get = (query: string) => new Request(`${URL_BASE}?${query}`)

let players = 0
/** A fresh browser each time, from its own IP so the rate limit stays out of the way. */
function visitor(name: string, score: number, board = 'geoguess') {
  players++
  return post({ board, player: `player-${String(players).padStart(12, '0')}`, name, score }, `198.51.100.${players}`)
}

describe('without a store', () => {
  test('boards read as offline', async () => {
    const response = await listScores(get('board=geoguess'), null)
    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ offline: true })
  })

  test('submissions are still checked, then read as offline', async () => {
    expect((await submitScore(visitor('A', 100), null)).status).toBe(400)
    const response = await submitScore(visitor('Ana', 100), null)
    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ offline: true })
  })
})

describe('with a store', () => {
  test('a submission lands on the board in rank order', async () => {
    const store = memoryStore()
    await submitScore(visitor('Ana', 3000), store)
    await submitScore(visitor('Bruno', 4500), store)
    const response = await submitScore(visitor('Carla', 3500), store)
    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body).toMatchObject({ improved: true, rank: 2, entry: { name: 'Carla', score: 3500 } })
    expect(body.entries.map((e: { name: string }) => e.name)).toEqual(['Bruno', 'Carla', 'Ana'])

    const listed = await (await listScores(get('board=geoguess&limit=2'), store)).json()
    expect(listed.entries.map((e: { name: string }) => e.name)).toEqual(['Bruno', 'Carla'])
  })

  test('out-of-range scores, bad names and unknown boards are rejected with a reason', async () => {
    const store = memoryStore()
    for (const [body, field] of [
      [{ board: 'geoguess', player: 'player-aaaaaaaaaaaa', name: 'Ana', score: 99999 }, 'score'],
      [{ board: 'bica', player: 'player-aaaaaaaaaaaa', name: 'Ana', score: 0 }, 'score'],
      [{ board: 'geoguess', player: 'player-aaaaaaaaaaaa', name: '<b>hi</b>', score: 10 }, 'name'],
      [{ board: 'geoguess', player: 'player-aaaaaaaaaaaa', name: 'sh1thead', score: 10 }, 'name'],
      [{ board: 'pong', player: 'player-aaaaaaaaaaaa', name: 'Ana', score: 10 }, 'board'],
      ['not json', 'body'],
    ] as const) {
      const response = await submitScore(post(body), store)
      expect(response.status).toBe(400)
      const answer = await response.json()
      expect(answer.field).toBe(field)
      expect(answer.error).toBeString()
    }
    expect((await submitScore(post({ name: 'x'.repeat(4000) }), store)).status).toBe(413)
    expect((await listScores(get('board=pong'), store)).status).toBe(400)
  })

  test('each browser keeps one entry, its best', async () => {
    const store = memoryStore()
    const player = 'player-bbbbbbbbbbbb'
    const first = await (await submitScore(post({ board: 'bica', player, name: 'Ana', score: 6 }), store)).json()
    const worse = await (await submitScore(post({ board: 'bica', player, name: 'Ana B', score: 4 }), store)).json()
    expect(worse).toMatchObject({ improved: false, entry: { id: first.entry.id, name: 'Ana B', score: 6 } })
    const better = await (await submitScore(post({ board: 'bica', player, name: 'Ana', score: 9 }), store)).json()
    expect(better).toMatchObject({ improved: true, entry: { id: first.entry.id, score: 9 } })
    expect(better.entries).toHaveLength(1)
  })

  test('the Hall of Fame lists newest first and keeps the latest signing', async () => {
    let now = Date.parse('2026-10-01T12:00:00Z')
    const realNow = Date.now
    Date.now = () => (now += 60_000)
    try {
      const store = memoryStore()
      const sign = (player: string, name: string, score: number) =>
        submitScore(post({ board: 'hall-of-fame', player, name, score, meta: { total: score } }, `192.0.2.${score}`), store)
      await sign('player-cccccccccccc', 'Ana', 13)
      await sign('player-dddddddddddd', 'Bruno', 13)
      const resigned = await (await sign('player-cccccccccccc', 'Ana', 15)).json()
      expect(resigned.entries.map((e: { name: string; score: number }) => [e.name, e.score])).toEqual([
        ['Ana', 15],
        ['Bruno', 13],
      ])
      expect(resigned.entry.meta).toEqual({ total: 15 })
    } finally {
      Date.now = realNow
    }
  })

  test('floods from one IP are turned away', async () => {
    const store = memoryStore()
    const flood = (i: number) =>
      submitScore(post({ board: 'geoguess', player: `player-flood${String(i).padStart(8, '0')}`, name: 'Spam', score: i }), store)
    for (let i = 0; i < SUBMIT_LIMIT; i++) expect((await flood(i)).status).toBe(201)
    const response = await flood(SUBMIT_LIMIT)
    expect(response.status).toBe(429)
    expect(Number(response.headers.get('Retry-After'))).toBeGreaterThan(0)
    expect((await response.json()).error).toContain('Too many submissions')
    // Someone else is unaffected.
    expect((await submitScore(visitor('Ana', 10), store)).status).toBe(201)
  })
})

describe('moderation', () => {
  const SECRET = 'a-long-moderation-secret' // pragma: allowlist secret
  const moderate = (body: unknown, token?: string) =>
    new Request(`${URL_BASE}/moderate`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: JSON.stringify(body),
    })

  test('hides an entry behind the secret, and keeps it hidden on resubmission', async () => {
    const store = memoryStore()
    const player = 'player-eeeeeeeeeeee'
    const { entry } = await (await submitScore(post({ board: 'geoguess', player, name: 'Rude', score: 4000 }), store)).json()

    expect((await moderateScore(moderate({ board: 'geoguess', id: entry.id, hidden: true }), store, undefined)).status).toBe(401)
    expect((await moderateScore(moderate({ board: 'geoguess', id: entry.id, hidden: true }, 'wrong'), store, SECRET)).status).toBe(401)
    expect((await moderateScore(moderate({ board: 'geoguess', id: 'nope', hidden: true }, SECRET), store, SECRET)).status).toBe(404)
    const hidden = await moderateScore(moderate({ board: 'geoguess', id: entry.id, hidden: true }, SECRET), store, SECRET)
    expect(await hidden.json()).toEqual({ id: entry.id, hidden: true })

    const listed = async () => (await (await listScores(get('board=geoguess'), store)).json()).entries
    expect(await listed()).toEqual([])
    await submitScore(post({ board: 'geoguess', player, name: 'Rude', score: 4500 }), store)
    expect(await listed()).toEqual([])

    await moderateScore(moderate({ board: 'geoguess', id: entry.id, hidden: false }, SECRET), store, SECRET)
    expect(await listed()).toMatchObject([{ id: entry.id, score: 4500 }])
  })
})
