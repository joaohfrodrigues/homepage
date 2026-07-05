import { test, expect } from '@playwright/test'

// data/watch-history.json is live data periodically overwritten by the Plex
// sync — these assertions are intentionally structural (shape, not specific
// titles) so they don't break every time the real watch history changes.
test.describe('/hobbies — Watching items', () => {
  test('renders watch history entries as cards', async ({ page }) => {
    await page.goto('/hobbies')

    await expect(page.getByTestId('watch-card').first()).toBeVisible()
  })

  test('a watch card renders a poster image', async ({ page }) => {
    await page.goto('/hobbies')

    await expect(page.getByTestId('watch-card').first().locator('img').first()).toBeVisible()
  })
})
