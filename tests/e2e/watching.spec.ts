import { test, expect } from '@playwright/test'

// data/watch-history.json is live data periodically overwritten by the Plex
// sync — these assertions are intentionally structural (shape, not specific
// titles) so they don't break every time the real watch history changes.
test.describe('/hobbies — Watching items', () => {
  test('renders at least one Film and one Series card', async ({ page }) => {
    await page.goto('/hobbies')

    await expect(page.getByText('Film', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Series', { exact: true }).first()).toBeVisible()
  })

  test('a watch card renders a poster image', async ({ page }) => {
    await page.goto('/hobbies')

    const filmTag = page.getByText('Film', { exact: true }).first()
    const card = filmTag.locator('../../..')
    await expect(card.locator('img').first()).toBeVisible()
  })
})
