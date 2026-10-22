/// <reference types="bun" />
import { describe, expect, test } from 'bun:test'
import type { Redis } from '@upstash/redis'
import { BOARDS } from '../../src/lib/scores/boards'
import { rankValue, redisStore } from '../../src/lib/scores/store'

/** Just the commands the store uses, with Upstash's JSON (de)serialisation. */
function fakeRedis() {
  const hashes = new Map<string, Map<string, string>>()
  const sets = new Map<string, Map<string, number>>()
  const hash = (key: string) => hashes.get(key) ?? hashes.set(key, new Map()).get(key)!
  const set = (key: string) => sets.get(key) ?? sets.set(key, new Map()).get(key)!
  const fake = {
    async hget(key: string, field: string) {
      const value = hash(key).get(field)
      return value === undefined ? null : JSON.parse(value)
    },
    async hmget(key: string, ...fields: string[]) {
      return Object.fromEntries(fields.map((field) => [field, JSON.parse(hash(key).get(field) ?? 'null')]))
    },
    async hset(key: string, values: Record<string, unknown>) {
      for (const [field, value] of Object.entries(values)) hash(key).set(field, JSON.stringify(value))
      return 1
    },
    async zadd(key: string, { score, member }: { score: number; member: string }) {
      set(key).set(member, score)
      return 1
    },
    async zrem(key: string, member: string) {
      return set(key).delete(member) ? 1 : 0
    },
    async zrange(key: string, start: number, stop: number, opts: { rev: boolean }) {
      const sorted = [...set(key)].sort((a, b) => (opts.rev ? b[1] - a[1] : a[1] - b[1])).map(([member]) => member)
      return sorted.slice(start, stop + 1)
    },
  }
  return fake as unknown as Redis
}

const entry = (id: string, score: number, at: string) => ({ id, name: id, score, at })

describe('the Redis store', () => {
  test('lists by score, earlier entries first on a tie', async () => {
    const store = redisStore(fakeRedis())
    await store.put(BOARDS.geoguess, entry('late', 4000, '2026-10-02T00:00:00Z'))
    await store.put(BOARDS.geoguess, entry('early', 4000, '2026-10-01T00:00:00Z'))
    await store.put(BOARDS.geoguess, entry('top', 4800, '2026-10-03T00:00:00Z'))
    expect((await store.top(BOARDS.geoguess, 10)).map((e) => e.id)).toEqual(['top', 'early', 'late'])
    expect((await store.top(BOARDS.geoguess, 1)).map((e) => e.id)).toEqual(['top'])
  })

  test('hides and shows entries without losing them', async () => {
    const store = redisStore(fakeRedis())
    await store.put(BOARDS.bica, entry('a', 5, '2026-10-01T00:00:00Z'))
    expect(await store.setHidden(BOARDS.bica, 'a', true)).toBe(true)
    expect(await store.top(BOARDS.bica, 10)).toEqual([])
    await store.put(BOARDS.bica, entry('a', 7, '2026-10-02T00:00:00Z'))
    expect(await store.top(BOARDS.bica, 10)).toEqual([])
    expect(await store.get(BOARDS.bica, 'a')).toMatchObject({ score: 7, hidden: true })
    await store.setHidden(BOARDS.bica, 'a', false)
    expect(await store.top(BOARDS.bica, 10)).toEqual([entry('a', 7, '2026-10-02T00:00:00Z')])
    expect(await store.setHidden(BOARDS.bica, 'missing', true)).toBe(false)
  })
})

test('rank values keep whole scores apart from the tie-break', () => {
  const a = rankValue(BOARDS.geoguess, entry('a', 4999, '2030-01-01T00:00:00Z'))
  const b = rankValue(BOARDS.geoguess, entry('b', 5000, '2020-01-01T00:00:00Z'))
  expect(Math.floor(a)).toBe(4999)
  expect(b).toBeGreaterThan(a)
})
