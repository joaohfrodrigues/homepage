import { test, expect, type Locator, type Page } from '@playwright/test'
import { furnishHouse } from '../../src/game/furnishings'
import { TILE, type Point } from '../../src/game/layout'

interface SceneHandle {
  cfg: { bridge: { ui: { emit(event: string, payload?: unknown): void } } }
  effects: Map<string, unknown>
  effect: { sway?: number; drift?: number; vignette?: number; blur?: number; tint?: number }
  vignette?: { style: { opacity: string; transform: string } }
  blur?: { strength: number } | null
  player: { tile: Point; sprite: { isTinted: boolean } }
  lighting: { darkImage: { alpha: number } }
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

/** Opens the mirror cabinet over the bathroom sink, as the scene does when the guest uses it. */
async function openCabinet(page: Page) {
  await page.evaluate(() => {
    const game = (window as unknown as { __house: { scene: { getScene(key: string): unknown } } }).__house
    const scene = game.scene.getScene('house') as { cfg: { bridge: { game: { emit(event: string, payload: unknown): void } } } }
    scene.cfg.bridge.game.emit('interact', { type: 'dialogue', id: 'cabinet' })
  })
}

/**
 * Opens the fridge and takes a beer, clicking past the line as it types: under
 * the hangover's blur a headless browser draws slowly enough that waiting for
 * it to finish runs the long test out of time.
 */
async function grabBeer(page: Page) {
  await page.keyboard.press('e')
  await choose(page.getByRole('dialog', { name: 'Notice' }), 'Grab a Super Bock')
}

/** Naps until evening, or wakes up, from the directory's bed entry. */
async function toggleNight(page: Page) {
  await page.keyboard.press('m')
  await page.getByRole('dialog', { name: 'What are you after?' }).getByRole('button', { name: /^Nap until evening|^Wake up/ }).click()
}

/** Clicks through the dialogue's lines until the choice shows. */
async function reveal(dialogue: Locator, name: string) {
  const choice = dialogue.getByRole('button', { name })
  await expect(async () => {
    if (!(await choice.isVisible())) await dialogue.click()
    await expect(choice).toBeVisible({ timeout: 500 })
  }).toPass({ timeout: 15_000 })
  return choice
}

/** Clicks through the dialogue's lines until the choice shows, then picks it. */
async function choose(dialogue: Locator, name: string) {
  await (await reveal(dialogue, name)).click()
}

async function closeDialogue(page: Page) {
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: /^Notice|^Talking to|^Comic/ })).toHaveCount(0)
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
    // Start at night, so waking up has to bring the morning, and the toggle, round.
    if (await page.getByLabel('Day').isVisible()) await toggleNight(page)
    await expect(page.getByLabel('Night')).toBeVisible()

    await goToFridge(page)
    for (let i = 0; i < 2; i++) {
      await grabBeer(page)
      await expect(page.getByRole('dialog', { name: 'Notice' })).toContainText('Ice cold')
      await closeDialogue(page)
    }
    expect((await guestEffect(page)).sources).toEqual([])

    // The third goes to your head: a close-up of the two of you clinking bottles.
    await grabBeer(page)
    const cheers = page.getByRole('dialog', { name: 'Comic: Saúde!' })
    await expect(cheers).toBeVisible()
    await expect(cheers.getByRole('img', { name: 'You' })).toBeVisible()
    // One click lands every panel at once, the next one moves on.
    await cheers.click()
    await expect(cheers.getByText('CLINK!')).toBeVisible()
    await expect(cheers.getByRole('img', { name: 'João' })).toBeVisible()
    await cheers.click()
    await expect(cheers).toHaveCount(0)
    // The scene takes the effect on at its next frame.
    await expect.poll(() => guestEffect(page)).toMatchObject({ sources: ['beer'], sway: 3, vignette: 0.2, tinted: true })
    expect((await guestEffect(page)).drift).toBeUndefined()

    await grabBeer(page)
    await closeDialogue(page)
    await grabBeer(page)
    await expect(page.getByRole('dialog', { name: 'Notice' })).toContainText('The floor tilts')
    await closeDialogue(page)
    await expect.poll(() => guestEffect(page)).toMatchObject({ sources: ['beer'], sway: 6, drift: 0.15, vignette: 0.5, blur: 0.7 })
    // The edges breathe and the focus comes and goes, rather than sitting still.
    const filters = () => scene(page, (s) => `${s.vignette?.style.opacity} ${s.blur?.strength.toFixed(3)}`)
    const before = await filters()
    await expect.poll(filters).not.toBe(before)

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
    // No warning on the sixth: it's just as wobbly as the fifth.
    await expect(page.getByRole('dialog', { name: 'Notice' })).toContainText('The floor tilts')
    await closeDialogue(page)
    await grabBeer(page)

    // The seventh: you nod off in close-up (still night), then come to in close-up, with João.
    const dozing = page.getByRole('dialog', { name: 'Comic: Nodding off' })
    await expect(dozing).toBeVisible()
    await expect(page.getByLabel('Night')).toBeVisible()
    await page.keyboard.press('Escape')
    const waking = page.getByRole('dialog', { name: 'Comic: Waking up' })
    await expect(waking).toBeVisible({ timeout: 10_000 })
    await expect(waking).toContainText('You alive?')
    await page.keyboard.press('Escape')
    const wake = page.getByRole('dialog', { name: 'Talking to João' })
    await expect(wake).toContainText('Morning, sunshine', { timeout: 10_000 })
    expect(await scene(page, (s) => ({ ...s.player.tile }))).toEqual({ x: sofa.x + 1, y: sofa.y })
    expect(await scene(page, (s) => s.lighting.darkImage.alpha)).toBe(0)
    await expect(page.getByLabel('Day')).toBeVisible()
    // The night is over, but not the hangover.
    expect((await guestEffect(page)).sources).toEqual(['hangover'])

    // Ask what happened, then how many; each answer still offers water or coffee.
    await choose(wake, 'Ughhh… what happened??')
    await expect(wake).toContainText('You found the Super Bock')
    await choose(wake, 'How many did I have?')
    await expect(wake).toContainText('7. In about a minute.')
    const water = await reveal(wake, 'Water, thanks')
    await expect(wake.getByRole('button')).toHaveCount(2)
    await water.click()
    await expect(wake).toHaveCount(0)

    await page.keyboard.press('g')
    const guestbook = page.getByRole('dialog', { name: 'Guestbook' })
    await expect(guestbook.getByRole('region', { name: 'Odds and ends' })).toContainText('7beers from the fridge')
    await expect(guestbook.getByText('Sofa surfer (earned)')).toBeVisible()
    await page.keyboard.press('Escape')

    // The bathroom cabinet has paracetamol for it, and only offers it once.
    await openCabinet(page)
    const cabinet = page.getByRole('dialog', { name: 'Notice' })
    await choose(cabinet, 'Take a paracetamol')
    await expect(cabinet).toContainText('You wash one down')
    await choose(cabinet, 'Never again')
    await expect(cabinet).toHaveCount(0)
    await openCabinet(page)
    await expect(await reveal(cabinet, 'Close it')).toBeVisible()
    await expect(cabinet.getByRole('button', { name: 'Take a paracetamol' })).toHaveCount(0)
    await cabinet.getByRole('button', { name: 'Close it' }).click()
    await page.keyboard.press('g')
    await expect(guestbook.getByText('Never again (earned)')).toBeVisible()
    await page.keyboard.press('Escape')

    // The count starts again.
    await goToFridge(page)
    await grabBeer(page)
    await expect(page.getByRole('dialog', { name: 'Notice' })).toContainText('Ice cold')
  })

  test('a nap sleeps the beers off', async ({ page }) => {
    await goToFridge(page)
    for (let i = 0; i < 3; i++) {
      await grabBeer(page)
      await closeDialogue(page)
    }
    expect((await guestEffect(page)).sources).toEqual(['beer'])

    await toggleNight(page)
    await expect.poll(() => guestEffect(page)).toMatchObject({ sources: [], tinted: false })
    await goToFridge(page)
    await grabBeer(page)
    await expect(page.getByRole('dialog', { name: 'Notice' })).toContainText('Ice cold')
  })

  test('under reduced motion being dizzy is a tint, still edges and a faint blur, not a sway', async ({ page }) => {
    // The scene reads the setting as it boots.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.reload()
    await expect(page.getByRole('button', { name: /Directory/ })).toBeVisible({ timeout: 15_000 })
    await goToFridge(page)
    for (let i = 0; i < 5; i++) {
      await grabBeer(page)
      // The third's close-up has every panel up at once.
      if (i === 2) await expect(page.getByRole('dialog', { name: 'Comic: Saúde!' }).getByText('CLINK!')).toBeVisible()
      await closeDialogue(page)
    }
    await expect.poll(() => guestEffect(page)).toMatchObject({ sources: ['beer'], vignette: 0.5, blur: 0.7, tinted: true })
    const effect = await guestEffect(page)
    expect(effect.sway).toBeUndefined()
    expect(effect.drift).toBeUndefined()
    const filters = () =>
      scene(page, (s) => [s.vignette?.style.opacity, s.vignette?.style.transform, s.blur?.strength])
    await expect.poll(filters).toEqual(['0.85', 'scale(1.04)', expect.closeTo(0.245, 3)])
    const still = await filters()
    await page.waitForTimeout(500)
    expect(await filters()).toEqual(still)
  })
})
