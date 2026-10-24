import { test, expect } from '@playwright/test'

// Every request here is rejected before it reaches a store, so this runs the
// same with or without Upstash configured, and never writes to a real board.
test.describe('Scores API validation', () => {
  const valid = { board: 'geoguess', player: 'e2e-player-0123456789', name: 'Ana', score: 3200 }

  for (const [label, body, field] of [
    ['an out-of-range score', { ...valid, score: 5001 }, 'score'],
    ['a fractional score', { ...valid, score: 10.5 }, 'score'],
    ['a one-letter name', { ...valid, name: 'A' }, 'name'],
    ['a name with markup', { ...valid, name: '<b>Ana</b>' }, 'name'],
    ['a rude name', { ...valid, name: 'Sh1t' }, 'name'],
    ['an unknown board', { ...valid, board: 'pong' }, 'board'],
    ['free text in the details', { ...valid, meta: { note: 'hi' } }, 'meta'],
  ] as const) {
    test(`rejects ${label} with a reason`, async ({ request }) => {
      const response = await request.post('/api/scores', { data: body })
      expect(response.status()).toBe(400)
      const answer = await response.json()
      expect(answer.field).toBe(field)
      expect(typeof answer.error).toBe('string')
    })
  }

  test('rejects an unknown board when reading', async ({ request }) => {
    const response = await request.get('/api/scores?board=pong')
    expect(response.status()).toBe(400)
  })

  test('a board reads as a list, or as offline when no store is set up', async ({ request }) => {
    const response = await request.get('/api/scores?board=geoguess')
    const body = await response.json()
    if (response.status() === 503) expect(body.offline).toBe(true)
    else expect(Array.isArray(body.entries)).toBe(true)
  })

  test('moderation is shut without the secret', async ({ request }) => {
    const response = await request.post('/api/scores/moderate', { data: { board: 'geoguess', id: 'x', hidden: true } })
    expect(response.status()).toBe(401)
  })
})
