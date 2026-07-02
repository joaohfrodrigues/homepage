import { test, expect } from '@playwright/test'

test.describe('/gear', () => {
  test('renders a section heading for each hobby with gear items', async ({ page }) => {
    await page.goto('/gear')
    await expect(page.getByRole('heading', { name: 'Gear' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Photography', level: 2 })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Music', level: 2 })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Running', level: 2 })).toBeVisible()
  })

  test('shows a known gear item name, category, and note under its hobby section', async ({
    page,
  }) => {
    await page.goto('/gear')
    const musicSection = page.getByRole('heading', { name: 'Music', level: 2 }).locator('..')
    await expect(musicSection.getByRole('heading', { name: 'Drum Kit', exact: true })).toBeVisible()
    await expect(musicSection.getByRole('heading', { name: '5-Piece Drum Kit' })).toBeVisible()
    await expect(musicSection.getByText(/Set up in the garage/)).toBeVisible()
  })

  test('a gear item with a link renders a working link', async ({ page }) => {
    await page.goto('/gear')
    const link = page.getByRole('link', { name: 'View product' }).first()
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', /example\.com/)
  })

  test('a gear item without a link does not render a link element', async ({ page }) => {
    await page.goto('/gear')
    const camera = page.getByRole('heading', { name: 'Mirrorless Body' }).locator('..')
    await expect(camera.getByRole('link')).toHaveCount(0)
  })

  test("renders Photography's gear section even though Photography has no /hobbies page", async ({
    page,
  }) => {
    await page.goto('/gear')
    const photographySection = page
      .getByRole('heading', { name: 'Photography', level: 2 })
      .locator('..')
    await expect(photographySection.getByRole('heading', { name: 'Mirrorless Body' })).toBeVisible()
    await expect(photographySection.getByRole('heading', { name: '50mm Prime Lens' })).toBeVisible()
  })
})
