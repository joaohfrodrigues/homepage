import { test, expect, type Page } from './fixtures'
import { LAYOUT } from '../../src/game/house3d/layout'

// The low-poly house at /house-3d (work in progress, issue #131). Headless
// Chromium draws it in software at a few frames a second, so these tests wait
// for where João ends up rather than timing his walk.

const roomName = (page: Page) => page.getByTestId('room-name')

async function open(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => message.type() === 'error' && errors.push(message.text()))
  await page.goto('/house-3d')
  await expect(roomName(page)).toHaveText('Entrance hall', { timeout: 20_000 })
  return errors
}

test.describe('Low-poly house', () => {
  test.slow()

  test('arrives in the hall, by the front door, without errors', async ({ page }) => {
    const errors = await open(page)
    await expect(page.locator('canvas')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('the room map teleports to every room', async ({ page }) => {
    await open(page)
    for (const room of LAYOUT.rooms) {
      await page.keyboard.press('m')
      const map = page.getByRole('dialog', { name: 'Jump to a room' })
      await expect(map).toBeVisible()
      await map.getByRole('button', { name: `Go to the ${room.name.toLowerCase()}` }).click()
      await expect(map).not.toBeVisible()
      await expect(roomName(page)).toHaveText(room.name)
    }
  })

  test('the arrow keys walk from the hall through the opening into the living room', async ({ page }) => {
    await open(page)
    // Walking is camera-relative: up and left together is due north, through the opening.
    await page.keyboard.down('ArrowUp')
    await page.keyboard.down('ArrowLeft')
    await expect(roomName(page)).toHaveText('Living room', { timeout: 60_000 })
    await page.keyboard.up('ArrowLeft')
    await page.keyboard.up('ArrowUp')
  })

  test('clicking the floor of another room walks there through the doorways', async ({ page }) => {
    await open(page)
    // From the hall, the kitchen's floor is on screen to the left, through its door.
    const canvas = page.locator('canvas')
    const box = (await canvas.boundingBox())!
    await page.mouse.click(box.x + box.width * 0.18, box.y + box.height * 0.62)
    await expect(roomName(page)).toHaveText('Kitchen', { timeout: 60_000 })
  })

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true })

    test('shows the house’s touch controls', async ({ page }) => {
      await open(page)
      await expect(page.getByTestId('touch-controls')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Rooms' })).toBeVisible()
    })
  })
})
