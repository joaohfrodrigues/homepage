import { test, expect } from '@playwright/test'

test.describe('SEO', () => {
  test('home page has a non-empty title', async ({ page }) => {
    await page.goto('/')
    const title = await page.title()
    expect(title.trim().length).toBeGreaterThan(0)
  })

  test('GET /sitemap.xml returns 200 with XML content type', async ({ request }) => {
    const response = await request.get('/sitemap.xml')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('application/xml')
  })

  test('GET /robots.txt returns 200', async ({ request }) => {
    const response = await request.get('/robots.txt')
    expect(response.status()).toBe(200)
    const body = await response.text()
    expect(body).toContain('Sitemap:')
  })

  test('article page has Open Graph tags', async ({ page }) => {
    await page.goto('/writing/projects/raspberry-pi/home-server-part-1-foundation')
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      'content',
      /Part 1/
    )
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article')
    await expect(page.locator('meta[property="og:image"]')).toHaveCount(1)
  })

  test('home page has Person JSON-LD', async ({ page }) => {
    await page.goto('/')
    const jsonLd = await page.locator('script[type="application/ld+json"]').textContent()
    expect(jsonLd).toContain('"@type":"Person"')
  })
})
