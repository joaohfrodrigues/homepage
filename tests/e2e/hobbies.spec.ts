import { test, expect } from '@playwright/test'

test.describe('/hobbies', () => {
  test('renders a card for each landing hobby', async ({ page }) => {
    await page.goto('/hobbies')
    await expect(page.getByRole('heading', { name: 'Hobbies', level: 1 })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Music', level: 2 })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Running', level: 2 })).toBeVisible()
  })

  test('does not render a hobby card for Photography', async ({ page }) => {
    await page.goto('/hobbies')
    await expect(page.getByRole('heading', { name: 'Photography', level: 2 })).toHaveCount(0)
  })

  test('hobby cards are not links', async ({ page }) => {
    await page.goto('/hobbies')
    const musicCard = page.getByRole('heading', { name: 'Music', level: 2 }).locator('..')
    await expect(musicCard.getByRole('link')).toHaveCount(0)
  })

  test('hovering a hobby card reveals its blurb', async ({ page }) => {
    await page.goto('/hobbies')
    const musicCard = page.getByRole('heading', { name: 'Music', level: 2 }).locator('..')
    const blurb = musicCard.getByText(/Drumming in 404s/)
    await expect(blurb).not.toBeVisible()
    await musicCard.hover()
    await expect(blurb).toBeVisible()
  })

  test('clicking (tapping) a hobby card reveals its blurb', async ({ page }) => {
    await page.goto('/hobbies')
    const musicCard = page.getByRole('heading', { name: 'Music', level: 2 }).locator('..')
    const blurb = musicCard.getByText(/Drumming in 404s/)
    await expect(blurb).not.toBeVisible()
    await musicCard.click()
    await expect(blurb).toBeVisible()
  })

  test('leaving a tapped-open hobby card closes it again', async ({ page }) => {
    await page.goto('/hobbies')
    const musicCard = page.getByRole('heading', { name: 'Music', level: 2 }).locator('..')
    const blurb = musicCard.getByText(/Drumming in 404s/)
    await musicCard.click()
    await expect(blurb).toBeVisible()
    await page.mouse.move(0, 0)
    await expect(blurb).not.toBeVisible()
  })

  test('shows a known gear item with its hobby and category tags', async ({ page }) => {
    await page.goto('/hobbies')
    const drumKit = page.getByRole('heading', { name: '5-Piece Drum Kit' }).locator('..')
    await expect(drumKit.getByText('Music', { exact: true })).toBeVisible()
    await expect(drumKit.getByText('Drum Kit', { exact: true })).toBeVisible()
  })

  test('hovering a gear card reveals its note', async ({ page }) => {
    await page.goto('/hobbies')
    const drumKit = page.getByRole('heading', { name: '5-Piece Drum Kit' }).locator('..')
    const note = drumKit.getByText(/Set up in the garage/)
    await expect(note).not.toBeVisible()
    await drumKit.hover()
    await expect(note).toBeVisible()
  })

  test('a gear item with a link renders a working link', async ({ page }) => {
    await page.goto('/hobbies')
    const link = page.getByRole('link', { name: 'View product' }).first()
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', /example\.com/)
  })

  test('a gear item without a link does not render a link element', async ({ page }) => {
    await page.goto('/hobbies')
    const camera = page.getByRole('heading', { name: 'Mirrorless Body' }).locator('..')
    await expect(camera.getByRole('link')).toHaveCount(0)
  })

  test("renders Photography's gear even though Photography has no hobby card", async ({
    page,
  }) => {
    await page.goto('/hobbies')
    await expect(page.getByRole('heading', { name: 'Mirrorless Body' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '50mm Prime Lens' })).toBeVisible()
    const lens = page.getByRole('heading', { name: '50mm Prime Lens' }).locator('..')
    await expect(lens.getByText('Photography', { exact: true })).toBeVisible()
  })
})
