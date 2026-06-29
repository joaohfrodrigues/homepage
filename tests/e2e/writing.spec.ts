import { test, expect } from '@playwright/test'

test.describe('/writing', () => {
  test('renders at least one article', async ({ page }) => {
    await page.goto('/writing')
    await expect(page.getByRole('heading', { name: 'Writing' })).toBeVisible()
    const articles = page.getByRole('listitem')
    await expect(articles).toHaveCount(1)
  })

  test('clicking an article navigates to the correct slug', async ({ page }) => {
    await page.goto('/writing')
    const firstLink = page.getByRole('link').filter({ hasText: /Part 1/ }).first()
    const href = await firstLink.getAttribute('href')
    await firstLink.click()
    await expect(page).toHaveURL(href!)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Part 1')
  })

  test('tag filter shows only tagged articles', async ({ page }) => {
    await page.goto('/writing')
    const tagLink = page.getByRole('link', { name: 'home-server' }).first()
    await tagLink.click()
    await expect(page).toHaveURL(/\?tag=home-server/)
    const articles = page.getByRole('listitem')
    const count = await articles.count()
    expect(count).toBeGreaterThan(0)
  })
})

test.describe('/writing/[slug]', () => {
  test('renders article with reading time and back link', async ({ page }) => {
    await page.goto('/writing/home-server-part-1-foundation')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Part 1')
    await expect(page.getByText(/min read/)).toBeVisible()
    await expect(page.getByRole('link', { name: '← Writing' })).toBeVisible()
  })

  test('draft articles return 404 to unauthenticated visitors', async ({ page }) => {
    const response = await page.goto('/writing/home-server-part-2-media-center')
    expect(response?.status()).toBe(404)
  })
})
