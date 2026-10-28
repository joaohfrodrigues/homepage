import type { Redis } from '@upstash/redis'
import { isOutfit, type Outfit } from '@/game/characters'
import { secretMatches } from './scores/api'
import { redisFromEnv } from './scores/store'

/**
 * João's look for every visitor, set by the site's owner from the wardrobe
 * (after the Konami code) with HOUSE_OWNER_SECRET. Kept apart from the route
 * file so tests can call it with a plain Request and a memory store. Without a
 * saved look, or without a store, the house dresses João as `LOOKS.joao`.
 */

export interface LookStore {
  get(): Promise<Outfit | null>
  set(look: Outfit): Promise<void>
}

const KEY = 'house:joao-look'

const json = (body: unknown, status = 200, headers?: HeadersInit) => Response.json(body, { status, headers })

export function memoryLookStore(): LookStore {
  let saved: Outfit | null = null
  return {
    async get() {
      return saved
    },
    async set(look) {
      saved = look
    },
  }
}

export function redisLookStore(redis: Redis): LookStore {
  return {
    async get() {
      const saved = await redis.get<unknown>(KEY)
      return isOutfit(saved) ? saved : null
    },
    async set(look) {
      await redis.set(KEY, look)
    },
  }
}

let shared: LookStore | null | undefined

/** Upstash when it's configured (SCORES_STORE=memory keeps this in memory too), else null. */
export function getLookStore(): LookStore | null {
  if (shared !== undefined) return shared
  const redis = redisFromEnv()
  if (process.env.SCORES_STORE === 'memory') shared = memoryLookStore()
  else if (redis) shared = redisLookStore(redis)
  else shared = null
  return shared
}

/** `GET`: `{ look }`, null when the owner hasn't set one (or there's no store). */
export async function readLook(store: LookStore | null): Promise<Response> {
  try {
    // Briefly cached at the edge: a new look reaches everyone within a minute.
    return json({ look: store ? await store.get() : null }, 200, { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' })
  } catch (error) {
    console.error('joao-look: read failed', error)
    return json({ look: null })
  }
}

/**
 * `PUT { look }` with `Authorization: Bearer <HOUSE_OWNER_SECRET>`: dresses João
 * for everyone. Without a secret configured the route is shut.
 */
export async function saveLook(request: Request, store: LookStore | null, secret: string | undefined): Promise<Response> {
  const given = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (!secret || !secretMatches(given, secret)) return json({ error: 'That pass isn’t right.' }, 401)
  let body: { look?: unknown }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Send a JSON object.' }, 400)
  }
  if (!isOutfit(body.look)) return json({ error: 'That isn’t a look the wardrobe has.' }, 400)
  if (!store) return json({ error: 'There’s nowhere to save it right now.', offline: true }, 503)
  await store.set(body.look)
  return json({ look: body.look })
}
