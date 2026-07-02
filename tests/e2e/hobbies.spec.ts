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

  test("a hobby card's blurb is visible without any interaction", async ({ page }) => {
    await page.goto('/hobbies')
    const musicCard = page.getByRole('heading', { name: 'Music', level: 2 }).locator('..')
    await expect(musicCard.getByText(/Drumming in 404s/)).toBeVisible()
  })

  test("shows a known gear item's hobby eyebrow and category tag", async ({ page }) => {
    await page.goto('/hobbies')
    const drumKit = page.getByRole('heading', { name: '5-Piece Drum Kit' }).locator('..')
    await expect(drumKit.getByText(/Hobbies · Music/)).toBeVisible()
    await expect(drumKit.getByText('Drum Kit', { exact: true })).toBeVisible()
  })

  test("a gear item's note is visible without any interaction", async ({ page }) => {
    await page.goto('/hobbies')
    const drumKit = page.getByRole('heading', { name: '5-Piece Drum Kit' }).locator('..')
    await expect(drumKit.getByText(/Set up in the garage/)).toBeVisible()
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
    await expect(lens.getByText(/Hobbies · Photography/)).toBeVisible()
  })
})
