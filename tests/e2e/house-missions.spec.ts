import { test, expect, type Page } from '@playwright/test'
import type { DialogueId } from '../../src/game/bridge'
import { MISSIONS } from '../../src/game/missions'
import { ACHIEVEMENTS } from '../../src/components/house/visitor-stats'

/** Does what the scene does when the guest uses something that opens a dialogue (via the dev-only `__house`). */
async function interact(page: Page, id: DialogueId) {
  await page.evaluate((id) => {
    const game = (window as unknown as { __house: { scene: { getScene(key: string): unknown } } }).__house
    const scene = game.scene.getScene('house') as { cfg: { bridge: { game: { emit(event: string, payload: unknown): void } } } }
    scene.cfg.bridge.game.emit('interact', { type: 'dialogue', id })
  }, id)
}

const dialogue = (page: Page) => page.getByRole('dialog', { name: /^(Talking to|Notice)/ })

/** Reads through the dialogue's lines until `label` is on offer, then picks it. */
async function pick(page: Page, label: string | RegExp) {
  const choice = dialogue(page).getByRole('button', { name: label })
  await expect(async () => {
    if (!(await choice.isVisible())) await dialogue(page).click()
    await expect(choice).toBeVisible({ timeout: 250 })
  }).toPass({ timeout: 10_000 })
  await choice.click()
}

async function knock(page: Page) {
  await interact(page, 'bathroom')
  await pick(page, 'Better leave it')
  await expect(dialogue(page)).not.toBeVisible()
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

  test('“Who’s in there?” opens the bathroom, for good until the guestbook is torn out', async ({ page }) => {
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

    // 1. Three knocks start the mission (and earn the old running joke's sticker).
    for (let i = 0; i < 3; i++) await knock(page)
    await page.keyboard.press('g')
    await expect(missions).toContainText('Who’s in there?')
    await expect(missions).toContainText('1 of 4')
    await expect(guestbook.getByText('Still occupied (earned)')).toBeVisible()
    await page.keyboard.press('Escape')

    // 2. João knows who it is.
    await interact(page, 'joao')
    await pick(page, 'Who’s always in the bathroom?')
    await expect(dialogue(page)).toContainText('Dona Rosa')
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
    await expect(bica).toContainText('Take it to the bathroom door')
    await page.clock.resume()
    await page.keyboard.press('Escape')

    // Still shut until the bica is handed over.
    expect(await solidDoorTiles(page)).toEqual(doorTiles)

    // 4. Knock with it in hand.
    await interact(page, 'bathroom')
    await pick(page, 'Hold out the bica')
    await expect(dialogue(page)).toContainText('The door opens a crack')
    await pick(page, 'Mission complete!')

    // The door is a doorway now, and the directory can take you through it.
    await expect.poll(() => solidDoorTiles(page)).toEqual([])
    await page.keyboard.press('m')
    await directory.getByRole('button', { name: 'Go to the bathroom' }).click()
    await expect(page.getByText('Bathroom', { exact: true })).toBeVisible()
    await page.keyboard.press('g')
    await expect(missions).toContainText('★ Done')
    await expect(guestbook.getByText('Bath time (earned)')).toBeVisible()
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
    await expect(directory.getByLabel('Bathroom (occupied)')).toBeVisible()
    await expect(directory.getByRole('button', { name: 'Go to the bathroom' })).toHaveCount(0)
  })
})
