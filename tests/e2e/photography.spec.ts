import { test, expect, type Page } from '@playwright/test'

test.describe('Photography gallery', () => {
  test('renders photo cards on the gallery page', async ({ page }) => {
    await page.goto('/photography')
    await expect(page.locator('[data-testid="photo-card"]').first()).toBeVisible({
      timeout: 15_000,
    })
  })

  test('opens lightbox when a photo card is clicked', async ({ page }) => {
    await page.goto('/photography')
    await page.locator('[data-testid="photo-card"]').first().waitFor({ state: 'visible', timeout: 15_000 })
    await page.locator('[data-testid="photo-card"]').first().click()
    await expect(page.locator('[data-testid="lightbox"]')).toBeVisible()
  })

  test('closes lightbox with Escape key', async ({ page }) => {
    await page.goto('/photography')
    await page.locator('[data-testid="photo-card"]').first().waitFor({ state: 'visible', timeout: 15_000 })
    await page.locator('[data-testid="photo-card"]').first().click()
    await expect(page.locator('[data-testid="lightbox"]')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-testid="lightbox"]')).not.toBeVisible()
  })

  test('Back closes the lightbox, not the page under it', async ({ page }) => {
    await page.goto('/photography')
    const card = page.locator('[data-testid="photo-card"]').first()
    await card.waitFor({ state: 'visible', timeout: 15_000 })
    await card.click()
    const lightbox = page.locator('[data-testid="lightbox"]')
    await expect(lightbox).toBeVisible()
    await page.goBack()
    await expect(lightbox).not.toBeVisible()
    await expect(page).toHaveURL('/photography')
    await expect(page.getByRole('dialog', { name: 'Travel map' })).toBeVisible()
    await page.goBack()
    await expect(page).toHaveURL('about:blank')
  })

  for (const [name, close] of [
    ['Escape', (page: Page) => page.keyboard.press('Escape')],
    ['its close button', (page: Page) => page.getByRole('button', { name: 'Close lightbox' }).click()],
  ] as const) {
    test(`closing the lightbox with ${name} leaves no history behind`, async ({ page }) => {
      await page.goto('/photography')
      const card = page.locator('[data-testid="photo-card"]').first()
      await card.waitFor({ state: 'visible', timeout: 15_000 })
      await card.click()
      const lightbox = page.locator('[data-testid="lightbox"]')
      await expect(lightbox).toBeVisible()
      await close(page)
      await expect(lightbox).not.toBeVisible()
      await expect(page.getByRole('dialog', { name: 'Travel map' })).toBeVisible()
      await page.goBack()
      await expect(page).toHaveURL('about:blank')
    })
  }
})
