import { test, expect, type Page } from './fixtures'
import type { DialogueId } from '../../src/game/bridge'
import { MISSIONS } from '../../src/game/missions'
import { ACHIEVEMENTS } from '../../src/components/house/visitor-stats'

/** Does what the scene does when the guest uses something that opens a dialogue (via `__house`, exposed in dev and in the e2e build). */
async function interact(page: Page, id: DialogueId) {
  await page.evaluate((id) => {
    const game = (window as unknown as { __house: { scene: { getScene(key: string): unknown } } }).__house
    const scene = game.scene.getScene('house') as { cfg: { bridge: { game: { emit(event: string, payload: unknown): void } } } }
    scene.cfg.bridge.game.emit('interact', { type: 'dialogue', id })
  }, id)
}

const dialogue = (page: Page) => page.getByRole('dialog', { name: /^(Talking to|Notice)/ })

/** Reads through the dialogue's lines until `label` is on offer. */
async function readUntil(page: Page, label: string | RegExp) {
  const choice = dialogue(page).getByRole('button', { name: label })
  await expect(async () => {
    if (!(await choice.isVisible())) await dialogue(page).click()
    await expect(choice).toBeVisible({ timeout: 250 })
  }).toPass({ timeout: 10_000 })
}

/** Reads through the dialogue's lines until `label` is on offer, then picks it. */
async function pick(page: Page, label: string | RegExp) {
  await readUntil(page, label)
  await dialogue(page).getByRole('button', { name: label }).click()
}

const doorTiles = ['13,13', '14,13', '13,14', '14,14']

/** The bathroom door's tiles that still block the way. */
async function solidDoorTiles(page: Page): Promise<string[]> {
  return page.evaluate((tiles) => {
    const game = (window as unknown as { __house: { scene: { getScene(key: string): unknown } } }).__house
    const { solid } = game.scene.getScene('house') as { solid: Set<string> }
    return tiles.filter((tile) => solid.has(tile))
  }, doorTiles)
}

test('every mission has steps that can be done, and its sticker is a real one', () => {
  for (const mission of MISSIONS) {
    expect(mission.steps.length).toBeGreaterThan(0)
    if (mission.reward.sticker) expect(ACHIEVEMENTS.map((a) => a.id)).toContain(mission.reward.sticker)
    for (const step of mission.steps) expect(step.stat ?? step.event ?? step.prompt).toBeDefined()
  }
})

test.describe('Missions', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('house:welcomed', '1'))
  })

  test('“The stuck door” opens the bathroom, for good until the guestbook is torn out', async ({ page }) => {
    // A controllable clock, so the bica can be stopped right on 9 bar.
    await page.clock.install()
    await page.goto('/')
    await expect(page.getByRole('button', { name: /Directory/ })).toBeVisible({ timeout: 15_000 })
    const guestbook = page.getByRole('dialog', { name: 'Guestbook' })
    const directory = page.getByRole('dialog', { name: 'What are you after?' })
    const missions = guestbook.getByRole('region', { name: 'Missions' })

    await page.keyboard.press('g')
    await expect(missions).toContainText('???')
    await page.keyboard.press('Escape')

    // 1. Three tries of the handle start the mission. Only the third points the guest at João.
    for (let i = 1; i <= 3; i++) {
      await interact(page, 'bathroom')
      await readUntil(page, 'Leave it')
      if (i < 3) await expect(dialogue(page)).not.toContainText('João')
      else await expect(dialogue(page)).toContainText('Maybe João knows a trick.')
      await pick(page, 'Leave it')
      await expect(dialogue(page)).not.toBeVisible()
    }
    await page.keyboard.press('g')
    await expect(missions).toContainText('The stuck door')
    await expect(missions).toContainText('1 of 5')
    await page.keyboard.press('Escape')

    // 2. João knows the knack, for a price.
    await interact(page, 'joao')
    await pick(page, 'The bathroom door won’t open')
    await expect(dialogue(page)).toContainText('the wood swells')
    await pick(page, 'Will do')

    // 3. A perfect bica: step the clock until the needle sits on 9 bar.
    await page.keyboard.press('m')
    await directory.getByRole('navigation', { name: 'Subjects' }).getByRole('button', { name: /^Pull a bica/ }).click()
    const bica = page.getByRole('dialog', { name: 'Pull a bica' })
    const start = bica.getByRole('button', { name: 'Start the pull' })
    await expect(start).toBeVisible()
    await page.clock.pauseAt(Date.now() + 1000)
    await start.click()
    const reading = bica.getByText(/^\d+\.\d bar$/)
    for (let i = 0; i < 200; i++) {
      await page.clock.runFor(16)
      const text = await reading.textContent()
      if (text && Math.abs(parseFloat(text) - 9) <= 0.3) break
    }
    await bica.getByRole('button', { name: 'Stop!' }).click()
    await expect(bica).toContainText('Perfect bica!')
    await expect(bica).toContainText('Take it to him')
    await page.clock.resume()
    await page.keyboard.press('Escape')

    // 4. The bica buys the knack.
    await interact(page, 'joao')
    await pick(page, 'Here’s your bica')
    await expect(dialogue(page)).toContainText('here’s the knack')
    await pick(page, 'Will do')

    // Still shut until the guest puts their shoulder into it.
    expect(await solidDoorTiles(page)).toEqual(doorTiles)

    // 5. Lift and shove.
    await interact(page, 'bathroom')
    await pick(page, 'Lift the handle and shove')
    await expect(dialogue(page)).toContainText('You lift the handle')
    await pick(page, 'Mission complete!')

    // The door is a doorway now, and the directory can take you through it.
    await expect.poll(() => solidDoorTiles(page)).toEqual([])
    await page.keyboard.press('m')
    await directory.getByRole('button', { name: 'Go to the bathroom' }).click()
    await expect(page.getByText('Bathroom', { exact: true })).toBeVisible()
    await page.keyboard.press('g')
    await expect(missions).toContainText('★ Done')
    await expect(guestbook.getByText('Shoulder to it (earned)')).toBeVisible()
    await page.keyboard.press('Escape')

    // It stays open after a reload.
    await page.reload()
    await expect(page.getByRole('button', { name: /Directory/ })).toBeVisible({ timeout: 15_000 })
    expect(await solidDoorTiles(page)).toEqual([])
    await page.keyboard.press('m')
    await directory.getByRole('button', { name: 'Go to the bathroom' }).click()
    await expect(page.getByText('Bathroom', { exact: true })).toBeVisible()

    // Tearing out the guestbook page shuts it again, and walks the guest out.
    await page.keyboard.press('g')
    await guestbook.getByRole('button', { name: 'Tear out this page' }).click()
    await guestbook.getByRole('button', { name: 'Sure? Click again' }).click()
    await expect(missions).toContainText('???')
    await page.keyboard.press('Escape')
    await expect(page.getByText('Corridor', { exact: true })).toBeVisible()
    await expect.poll(() => solidDoorTiles(page)).toEqual(doorTiles)
    await page.keyboard.press('m')
    await expect(directory.getByLabel('Bathroom (stuck shut)')).toBeVisible()
    await expect(directory.getByRole('button', { name: 'Go to the bathroom' })).toHaveCount(0)
  })
})
