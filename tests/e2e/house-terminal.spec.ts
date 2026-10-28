import { test, expect, type Page } from './fixtures'

/** Sits at the workstation, as the scene does when the guest uses the desk (via `__house`, exposed in dev and in the e2e build). */
async function openTerminal(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('button', { name: /Directory/ })).toBeVisible({ timeout: 15_000 })
  await page.waitForFunction(() => (window as unknown as { __house?: unknown }).__house)
  await page.evaluate(() => {
    const game = (window as unknown as { __house: { scene: { getScene(key: string): unknown } } }).__house
    const scene = game.scene.getScene('house') as { cfg: { bridge: { game: { emit(event: string, payload: unknown): void } } } }
    scene.cfg.bridge.game.emit('interact', { type: 'panel', panel: 'terminal' })
  })
  const panel = page.getByRole('dialog', { name: 'Workstation' })
  await expect(panel).toBeVisible()
  // Typing goes straight to the prompt.
  await expect(panel.getByRole('textbox', { name: 'Command' })).toBeFocused()
  return panel
}

const BLANK = 'about:blank'

test.describe('The workstation terminal', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('house:welcomed', '1'))
  })

  test('takes commands from the keyboard, with history on ↑ and Tab completion', async ({ page }) => {
    const panel = await openTerminal(page)
    const prompt = panel.getByRole('textbox', { name: 'Command' })
    const log = panel.getByRole('log', { name: 'Terminal output' })

    await page.keyboard.type('cd wr')
    await page.keyboard.press('Tab')
    await expect(prompt).toHaveValue('cd writing/')
    await page.keyboard.press('Enter')
    await expect(panel.getByText('joao@pi:~/writing$')).toBeVisible()

    await page.keyboard.type('ls')
    await page.keyboard.press('Enter')
    await expect(log.getByRole('link', { name: 'raspberry-pi/' })).toBeVisible()

    await page.keyboard.press('ArrowUp')
    await expect(prompt).toHaveValue('ls')
  })

  test('open takes a page over the panel’s history entry, so Back returns to the house', async ({ page }) => {
    const panel = await openTerminal(page)
    await page.keyboard.type('open about.md')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL('/about')
    await expect(panel).not.toBeVisible()
    await page.goBack()
    await expect(page).toHaveURL('/')
    await page.goBack()
    await expect(page).toHaveURL(BLANK)
  })

  test('exit logs out of the Pi first, then closes; Back closes it too', async ({ page }) => {
    let panel = await openTerminal(page)
    await page.keyboard.type('exit')
    await page.keyboard.press('Enter')
    await expect(panel.getByText('Connection to pi closed.')).toBeVisible()
    await page.keyboard.type('exit')
    await page.keyboard.press('Enter')
    await expect(panel).not.toBeVisible()

    await page.goto('/')
    panel = await openTerminal(page)
    await page.goBack()
    await expect(panel).not.toBeVisible()
    await expect(page).toHaveURL('/')
  })

  test('three secrets earn the Root access sticker, and sudo is noted in the guestbook', async ({ page }) => {
    const panel = await openTerminal(page)
    for (const command of ['sudo ls', 'sudo ls', 'sudo ls', 'cat zeno', 'ping tejo']) {
      await page.keyboard.type(command)
      await page.keyboard.press('Enter')
    }
    await expect(panel.getByText(/This incident will be reported/)).toBeVisible()
    await expect(page.getByText(/Root access unlocked/)).toBeVisible()
    await page.keyboard.press('Escape')
    await page.keyboard.press('g')
    await expect(page.getByRole('dialog', { name: /guestbook/i }).getByText('sudo incident reported')).toBeVisible()
  })
})
