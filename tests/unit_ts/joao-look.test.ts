/// <reference types="bun" />
import { describe, expect, test } from 'bun:test'
import { LOOKS, isOutfit } from '../../src/game/characters'
import { memoryLookStore, readLook, saveLook } from '../../src/lib/joao-look'

const SECRET = 'owner-test-secret' // pragma: allowlist secret
const look = { ...LOOKS.joao, hat: null }

function put(body: unknown, pass?: string) {
  return new Request('https://example.test/api/house/joao', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(pass !== undefined && { Authorization: `Bearer ${pass}` }) },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('isOutfit', () => {
  test('takes the house’s own looks', () => {
    expect(isOutfit(LOOKS.joao)).toBe(true)
    expect(isOutfit(LOOKS.guest)).toBe(true)
  })

  test('turns down missing, unknown and wrongly left-off pieces', () => {
    expect(isOutfit({ ...LOOKS.joao, hair: undefined })).toBe(false)
    expect(isOutfit({ ...LOOKS.joao, outfit: 'Outfit_99_99' })).toBe(false)
    expect(isOutfit({ ...LOOKS.joao, skin: null })).toBe(false)
    expect(isOutfit({ ...LOOKS.joao, hair: LOOKS.joao.outfit })).toBe(false)
    expect(isOutfit([])).toBe(false)
    expect(isOutfit(null)).toBe(false)
  })
})

describe('reading', () => {
  test('is null until the owner saves a look, and without a store', async () => {
    expect(await (await readLook(memoryLookStore())).json()).toEqual({ look: null })
    expect(await (await readLook(null)).json()).toEqual({ look: null })
  })
})

describe('saving', () => {
  test('needs the owner’s pass', async () => {
    const store = memoryLookStore()
    expect((await saveLook(put({ look }), store, SECRET)).status).toBe(401)
    expect((await saveLook(put({ look }, 'guess'), store, SECRET)).status).toBe(401)
    expect(await store.get()).toBeNull()
  })

  test('is shut while no secret is configured', async () => {
    expect((await saveLook(put({ look }, ''), memoryLookStore(), undefined)).status).toBe(401)
    expect((await saveLook(put({ look }, 'anything'), memoryLookStore(), '')).status).toBe(401)
  })

  test('only takes looks the wardrobe has', async () => {
    const store = memoryLookStore()
    expect((await saveLook(put({ look: { ...look, hair: 'nope' } }, SECRET), store, SECRET)).status).toBe(400)
    expect((await saveLook(put('not json', SECRET), store, SECRET)).status).toBe(400)
    expect(await store.get()).toBeNull()
  })

  test('saves the look for everyone to read', async () => {
    const store = memoryLookStore()
    const response = await saveLook(put({ look }, SECRET), store, SECRET)
    expect(response.status).toBe(200)
    expect(await (await readLook(store)).json()).toEqual({ look })
  })

  test('answers 503 without a store', async () => {
    expect((await saveLook(put({ look }, SECRET), null, SECRET)).status).toBe(503)
  })
})
