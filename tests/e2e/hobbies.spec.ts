import { test, expect } from '@playwright/test'

test.describe('/hobbies', () => {
  test('renders a card for each landing hobby', async ({ page }) => {
    await page.goto('/hobbies')
    await expect(page.getByRole('heading', { name: 'Hobbies' })).toBeVisible()
    await expect(page.getByRole('link', { name: /Music/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /Running/ })).toBeVisible()
  })

  test('does not render a card for Photography', async ({ page }) => {
    await page.goto('/hobbies')
    const main = page.getByRole('main')
    await expect(main.getByRole('link', { name: /Photography/ })).toHaveCount(0)
  })

  test('clicking a hobby card navigates to its detail page', async ({ page }) => {
    await page.goto('/hobbies')
    await page.getByRole('link', { name: /Music/ }).click()
    await expect(page).toHaveURL('/hobbies/music')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Music')
  })
})

test.describe('/hobbies/[slug]', () => {
  test('renders the hobby title and blurb', async ({ page }) => {
    await page.goto('/hobbies/music')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Music')
    await expect(page.getByText(/404s/)).toBeVisible()
  })

  test('renders a tile grid with images', async ({ page }) => {
    await page.goto('/hobbies/music')
    const tiles = page.getByRole('button')
    await expect(tiles).toHaveCount(3)
    await expect(tiles.first().locator('img')).toBeVisible()
  })

  test('hovering a tile reveals its caption', async ({ page }) => {
    await page.goto('/hobbies/music')
    const firstTile = page.getByRole('button').first()
    const caption = firstTile.getByText(/404s live at the Critical Techworks/)
    await expect(caption).toHaveCount(0)
    await firstTile.hover()
    await expect(caption).toBeVisible()
  })

  test('clicking a tile reveals its caption', async ({ page }) => {
    await page.goto('/hobbies/music')
    const firstTile = page.getByRole('button').first()
    const caption = firstTile.getByText(/404s live at the Critical Techworks/)
    await expect(caption).toHaveCount(0)
    await firstTile.click()
    await expect(caption).toBeVisible()
  })

  test('a hobby with no visible detail page returns 404', async ({ page }) => {
    const response = await page.goto('/hobbies/photography')
    expect(response?.status()).toBe(404)
  })
})
