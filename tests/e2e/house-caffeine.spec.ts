import { test, expect, type Page } from '@playwright/test'

/** What the house scene knows about effects on the guest (the game is exposed in dev). */
async function guestEffect(page: Page) {
  return page.evaluate(() => {
    const game = (window as unknown as { __house: { scene: { getScene(key: string): unknown } } }).__house
    const scene = game.scene.getScene('house') as {
      effects: Map<string, unknown>
      effect: { speed?: number; shake?: number; jitter?: number; tint?: number }
      player: { sprite: { isTinted: boolean } }
    }
    return { sources: [...scene.effects.keys()], ...scene.effect, tinted: scene.player.sprite.isTinted }
  })
}

/** Opens João's dialogue as if the guest had walked up to him. */
async function talkToJoao(page: Page) {
  await page.evaluate(() => {
    const game = (window as unknown as { __house: { scene: { getScene(key: string): unknown } } }).__house
    const scene = game.scene.getScene('house') as {
      cfg: { bridge: { game: { emit(event: string, payload: unknown): void } } }
    }
    scene.cfg.bridge.game.emit('interact', { type: 'dialogue', id: 'joao' })
  })
}

async function openBica(page: Page) {
  await page.keyboard.press('m')
  await page
    .getByRole('dialog', { name: 'What are you after?' })
    .getByRole('navigation', { name: 'Subjects' })
    .getByRole('button', { name: /^Pull a bica/ })
    .click()
  return page.getByRole('dialog', { name: 'Pull a bica' })
}

async function pull(page: Page, times: number) {
  const bica = page.getByRole('dialog', { name: 'Pull a bica' })
  for (let i = 0; i < times; i++) {
    await bica.getByRole('button', { name: /Start the pull|Another one/ }).click()
    await bica.getByRole('button', { name: 'Stop!' }).click()
  }
}

test.describe('Too many bicas', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('house:welcomed', '1'))
  })

  test('ten in a row set the guest vibrating, until a nap', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
    const bica = await openBica(page)
    await pull(page, 4)
    await expect(bica.getByText(/Are you sure/)).toHaveCount(0)
    await page.keyboard.press('Escape')

    // Five makes João notice.
    await openBica(page)
    await pull(page, 1)
    await page.keyboard.press('Escape')
    await talkToJoao(page)
    const talk = page.getByRole('dialog', { name: 'Talking to João' })
    // The aside comes after his hello: one click finishes typing that line or moves on.
    await talk.click()
    await talk.click()
    await expect(talk).toContainText('you’re buzzing a bit')
    await page.keyboard.press('Escape')

    await openBica(page)
    await pull(page, 3)
    await expect(bica.getByText('Are you sure? That’s your 9th.')).toBeVisible()
    await pull(page, 1)
    await expect(bica.getByText('Are you sure? That’s your 10th.')).toBeVisible()
    expect((await guestEffect(page)).sources).toEqual([])
    await pull(page, 1)

    // The tenth: the machine closes and João comments.
    await expect(bica).not.toBeVisible()
    await expect(talk).toContainText('You’re vibrating.')
    // The scene takes the effect on at its next frame.
    await expect.poll(() => guestEffect(page)).toMatchObject({ sources: ['caffeine'], speed: 1.5, tinted: true })
    const effect = await guestEffect(page)
    expect(effect.shake).toBeGreaterThan(0)
    expect(effect.jitter).toBeGreaterThan(0)
    await page.keyboard.press('Escape')

    // The lifetime tally is just ten bicas, plus a new sticker.
    await page.keyboard.press('g')
    const guestbook = page.getByRole('dialog', { name: 'Guestbook' })
    await expect(guestbook.getByRole('region', { name: 'Coffee machine' })).toContainText('10bicas pulled')
    await expect(guestbook.getByText('Wired (earned)')).toBeVisible()
    await page.keyboard.press('Escape')

    // A nap sleeps it off, and the count starts again.
    await page.keyboard.press('m')
    await page.getByRole('dialog', { name: 'What are you after?' }).getByRole('button', { name: /^Nap until evening|^Wake up/ }).click()
    await expect.poll(() => guestEffect(page).then((e) => e.sources)).toEqual([])
    await openBica(page)
    await expect(bica.getByText(/Are you sure/)).toHaveCount(0)
  })

  test('nothing carries over a reload', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
    await openBica(page)
    await pull(page, 10)
    await expect(page.getByRole('dialog', { name: 'Talking to João' })).toBeVisible()
    await page.reload()
    await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: /Directory/ }).waitFor()
    expect((await guestEffect(page)).sources).toEqual([])
    const bica = await openBica(page)
    await expect(bica.getByText(/Are you sure/)).toHaveCount(0)
  })

  test('the count forgets bicas older than five minutes', async ({ page }) => {
    await page.clock.install()
    await page.goto('/')
    await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
    const bica = await openBica(page)
    await pull(page, 9)
    await expect(bica.getByText('Are you sure? That’s your 10th.')).toBeVisible()
    await page.clock.fastForward('05:01')
    await pull(page, 1)
    await expect(bica).toBeVisible()
    await expect(bica.getByText(/Are you sure/)).toHaveCount(0)
    expect((await guestEffect(page)).sources).toEqual([])
  })

  test('the jitters wear off on their own', async ({ page }) => {
    await page.clock.install()
    await page.goto('/')
    await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
    await openBica(page)
    await pull(page, 10)
    await page.keyboard.press('Escape')
    expect((await guestEffect(page)).sources).toEqual(['caffeine'])
    await page.clock.fastForward('01:30')
    await expect.poll(() => guestEffect(page)).toMatchObject({ sources: [], tinted: false })
  })

  test('under reduced motion the overdose is a flush, not a shake', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
    await openBica(page)
    await pull(page, 10)
    await expect(page.getByRole('dialog', { name: 'Talking to João' })).toContainText('You’re vibrating.')
    await expect.poll(() => guestEffect(page)).toMatchObject({ sources: ['caffeine'], tinted: true })
    const effect = await guestEffect(page)
    expect(effect.shake).toBeUndefined()
    expect(effect.jitter).toBeUndefined()
  })
})
