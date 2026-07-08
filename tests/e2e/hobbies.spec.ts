import { test, expect } from '@playwright/test'

test.describe('/hobbies', () => {
  test('renders the page heading', async ({ page }) => {
    await page.goto('/hobbies')
    await expect(page.getByRole('heading', { name: 'Hobbies', level: 1 })).toBeVisible()
  })

  // Every hobby entry has showOnLandingPage: false — they exist only so
  // gear/events/watch items can reference them, and never render their own card.
  test('never renders a hobby-level card for any category', async ({ page }) => {
    await page.goto('/hobbies')
    for (const hobby of ['Film', 'Series', 'Running', 'Drums', 'Photography', 'Hiking']) {
      await expect(page.getByRole('heading', { name: hobby, level: 2 })).toHaveCount(0)
    }
  })

  // Cards with neither a photo nor a link have nothing else to do with a
  // click, so they reveal their note in place instead — see gear-card.tsx.
  test("a gear item's note is hidden until the card (no photo, no link) is clicked", async ({
    page,
  }) => {
    await page.goto('/hobbies')
    const drumKit = page.getByText('Roland TD-02KV', { exact: true }).locator('..')
    await expect(drumKit.getByText(/Electronic drum set/)).toHaveCount(0)

    await drumKit.click()
    await expect(drumKit.getByText(/Electronic drum set/)).toBeVisible()
  })

  test('a gear item without a link does not render a link element', async ({ page }) => {
    await page.goto('/hobbies')
    const camera = page.getByText('Sony A6600', { exact: true }).locator('..')
    await expect(camera.getByRole('link')).toHaveCount(0)
  })

  test("renders Photography's gear even though Photography has no hobby card", async ({
    page,
  }) => {
    await page.goto('/hobbies')
    await expect(page.getByText('Sony A6600', { exact: true })).toBeVisible()
    await expect(page.getByText('Sony SEL50F18F 50mm f1.8', { exact: true })).toBeVisible()
  })
})
