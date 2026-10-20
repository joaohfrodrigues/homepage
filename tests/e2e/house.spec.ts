import { test, expect } from '@playwright/test'

test.describe('House', () => {
  test('home page boots the game with its HUD', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('João’s house')).toBeVisible()
    await expect(page.getByRole('button', { name: /Directory/ })).toBeVisible()
  })

  test('M opens the directory and a room teleports there', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
    await page.keyboard.press('m')
    const directory = page.getByRole('dialog', { name: 'Where to?' })
    await expect(directory).toBeVisible()
    await directory.getByRole('button', { name: /^Study/ }).click()
    await expect(directory).not.toBeVisible()
    await expect(page.getByText('Study', { exact: true })).toBeVisible()
  })

  test('travel map overlay has a pin per trip linking to its exhibition', async ({ page }) => {
    await page.goto('/photography')
    const overlay = page.getByRole('dialog', { name: 'Travel map' })
    await expect(overlay).toBeVisible()
    const pin = overlay.locator('a[href^="/photography/"][aria-label*="photos"]').first()
    await pin.click()
    await expect(page).toHaveURL(/\/photography\/.+/)
    await expect(page.getByRole('link', { name: 'Travel map' })).toBeVisible()
  })

  test('closing an overlay returns to the house', async ({ page }) => {
    await page.goto('/about')
    await expect(page.getByRole('dialog', { name: 'About João' })).toBeVisible()
    await page.getByRole('button', { name: 'Close and return to the house' }).click()
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('dialog', { name: 'About João' })).not.toBeVisible()
  })

  test('hobby items open themed windows with the existing cards', async ({ page }) => {
    await page.goto('/hobbies/running')
    const overlay = page.getByRole('dialog', { name: 'Running' })
    await expect(overlay).toBeVisible()
    await expect(overlay.getByRole('region', { name: 'Races' })).toBeVisible()
    await page.goto('/hobbies/watching')
    await expect(page.getByText('Now showing')).toBeVisible()
    await expect(page.locator('[data-testid="watch-card"]').first()).toBeVisible()
  })

  test('kitchen games open from the directory', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
    await page.keyboard.press('m')
    await page.getByRole('button', { name: 'Pull a bica Coffee machine' }).click()
    const bica = page.getByRole('dialog', { name: 'Pull a bica' })
    await bica.getByRole('button', { name: 'Start the pull' }).click()
    await bica.getByRole('button', { name: 'Stop!' }).click()
    await expect(bica.getByRole('button', { name: 'Another one' })).toBeVisible()
    await page.keyboard.press('Escape')

    await page.keyboard.press('m')
    await page.getByRole('button', { name: 'Where was this taken? Fridge' }).click()
    const guess = page.getByRole('dialog', { name: 'Where was this taken?' })
    await guess.getByRole('application').click({ position: { x: 100, y: 60 } })
    await guess.getByRole('button', { name: 'Guess' }).click()
    await expect(guess.getByRole('link', { name: /trip/ })).toBeVisible()
  })
})
