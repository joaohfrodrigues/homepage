import { test, expect } from './fixtures'

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

  test('pages without a cover share the fingerprinted house snapshot', async ({ page, request }) => {
    await page.goto('/hobbies')
    const image = page.locator('meta[property="og:image"]')
    await expect(image).toHaveAttribute('content', /\/_next\/static\/media\/og-image\.[^/]+\.png$/)
    const path = new URL((await image.getAttribute('content'))!).pathname
    const response = await request.get(path)
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('image/png')
  })

  test('/work moved to /about, which has its own profile preview', async ({ page }) => {
    await page.goto('/work')
    await expect(page).toHaveURL('/about')
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /\/about\/opengraph-image/)
  })

  test('favicon route responds with a PNG', async ({ request }) => {
    const response = await request.get('/icon')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('image/png')
  })

  test('home page has Person JSON-LD', async ({ page }) => {
    await page.goto('/')
    const jsonLd = await page.locator('script[type="application/ld+json"]').textContent()
    expect(jsonLd).toContain('"@type":"Person"')
  })
})
