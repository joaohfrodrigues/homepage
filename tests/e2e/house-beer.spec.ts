import { test, expect, type Page } from '@playwright/test'
import { furnishHouse } from '../../src/game/furnishings'
import { TILE, type Point } from '../../src/game/layout'

interface SceneHandle {
  cfg: { bridge: { ui: { emit(event: string, payload?: unknown): void } } }
  effects: Map<string, unknown>
  effect: { sway?: number; drift?: number; vignette?: number; tint?: number }
  player: { tile: Point; sprite: { isTinted: boolean } }
  nightOverlay: { alpha: number }
  cameras: { main: { worldView: { x: number; y: number }; zoom: number } }
}

/** Reads from the house scene (the game is exposed in dev). */
async function scene<T>(page: Page, read: (scene: SceneHandle) => T): Promise<T> {
  return page.evaluate(`(${read.toString()})(window.__house.scene.getScene('house'))`) as Promise<T>
}

const guestEffect = (page: Page) =>
  scene(page, (s) => ({ sources: [...s.effects.keys()], ...s.effect, tinted: s.player.sprite.isTinted }))

const sofa = furnishHouse().decor.find((item) => item.kind === 'prop' && item.prop === 'sofa') as unknown as Point

async function goToFridge(page: Page) {
  await page.evaluate(() => {
    const game = (window as unknown as { __house: { scene: { getScene(key: string): unknown } } }).__house
    ;(game.scene.getScene('house') as SceneHandle).cfg.bridge.ui.emit('visit', 'fridge')
  })
  await expect(page.getByRole('button', { name: /^E Fridge/ })).toBeVisible()
}

/** Opens the fridge and takes a beer; returns the dialogue that follows. */
async function grabBeer(page: Page) {
  await page.keyboard.press('e')
  const fridge = page.getByRole('dialog', { name: 'Notice' })
  await fridge.getByRole('button', { name: 'Grab a Super Bock' }).click()
}

async function closeDialogue(page: Page) {
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: /^Notice|^Talking to/ })).toHaveCount(0)
}

test.describe('Beers from the fridge', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('house:welcomed', '1'))
    await page.goto('/')
    await expect(page.getByRole('button', { name: /Directory/ })).toBeVisible({ timeout: 15_000 })
  })

  test('the fridge still has the magnets game', async ({ page }) => {
    await goToFridge(page)
    await page.keyboard.press('e')
    await page.getByRole('dialog', { name: 'Notice' }).getByRole('button', { name: 'Look at the magnets' }).click()
    await expect(page.getByRole('dialog', { name: 'Where was this taken?' })).toBeVisible()
  })

  test('tipsy, then dizzy, then a doze that ends on the sofa', async ({ page }) => {
    test.slow()
    await goToFridge(page)
    for (let i = 0; i < 2; i++) {
      await grabBeer(page)
      await expect(page.getByRole('dialog', { name: 'Notice' })).toContainText('Ice cold')
      await closeDialogue(page)
    }
    expect((await guestEffect(page)).sources).toEqual([])

    await grabBeer(page)
    await expect(page.getByRole('dialog', { name: 'Talking to João' })).toContainText('Saúde!')
    await closeDialogue(page)
    expect(await guestEffect(page)).toMatchObject({ sources: ['beer'], sway: 3, tinted: true })
    expect((await guestEffect(page)).drift).toBeUndefined()

    await grabBeer(page)
    await closeDialogue(page)
    await grabBeer(page)
    await expect(page.getByRole('dialog', { name: 'Notice' })).toContainText('The floor tilts')
    await closeDialogue(page)
    expect(await guestEffect(page)).toMatchObject({ sources: ['beer'], sway: 6, drift: 0.15, vignette: 0.5 })

    // Clicking the floor still walks straight there, however wobbly the keys are.
    const start = await scene(page, (s) => ({ ...s.player.tile }))
    const goal = { x: start.x, y: start.y + 2 }
    const box = (await page.locator('canvas').boundingBox())!
    const view = await scene(page, (s) => ({ ...s.cameras.main.worldView, zoom: s.cameras.main.zoom }))
    await page.mouse.click(
      box.x + ((goal.x + 0.5) * TILE - view.x) * view.zoom,
      box.y + ((goal.y + 0.5) * TILE - view.y) * view.zoom,
    )
    await expect.poll(() => scene(page, (s) => ({ ...s.player.tile }))).toEqual(goal)

    await goToFridge(page)
    await grabBeer(page)
    await closeDialogue(page)
    await grabBeer(page)

    // The seventh: lights out, and João is there when you come to.
    const wake = page.getByRole('dialog', { name: 'Talking to João' })
    await expect(wake).toContainText('Morning. You had seven.', { timeout: 10_000 })
    expect(await scene(page, (s) => ({ ...s.player.tile }))).toEqual({ x: sofa.x + 1, y: sofa.y + 1 })
    expect(await scene(page, (s) => s.nightOverlay.alpha)).toBe(0)
    expect((await guestEffect(page)).sources).toEqual([])
    // One click finishes typing the first line or moves on; two always reach the second.
    await wake.click()
    await wake.click()
    await expect(wake).toContainText('glass of water')
    await expect(wake.getByRole('button', { name: 'Coffee, please' })).toBeVisible()
    await closeDialogue(page)

    await page.keyboard.press('g')
    const guestbook = page.getByRole('dialog', { name: 'Guestbook' })
    await expect(guestbook.getByRole('region', { name: 'Odds and ends' })).toContainText('7beers from the fridge')
    await expect(guestbook.getByText('Sofa surfer (earned)')).toBeVisible()
    await page.keyboard.press('Escape')

    // The count starts again.
    await goToFridge(page)
    await grabBeer(page)
    await expect(page.getByRole('dialog', { name: 'Notice' })).toContainText('Ice cold')
  })

  test('under reduced motion being dizzy is a tint and fuzzy edges, not a sway', async ({ page }) => {
    // The scene reads the setting as it boots.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.reload()
    await expect(page.getByRole('button', { name: /Directory/ })).toBeVisible({ timeout: 15_000 })
    await goToFridge(page)
    for (let i = 0; i < 5; i++) {
      await grabBeer(page)
      await closeDialogue(page)
    }
    const effect = await guestEffect(page)
    expect(effect).toMatchObject({ sources: ['beer'], vignette: 0.5, tinted: true })
    expect(effect.sway).toBeUndefined()
    expect(effect.drift).toBeUndefined()
  })
})
