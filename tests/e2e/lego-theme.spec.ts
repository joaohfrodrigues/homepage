import { test, expect } from '@playwright/test'

test.describe('Lego theme', () => {
  test('classic page title uses the Lego display font', async ({ page }) => {
    await page.goto('/hobbies')
    await expect(page.locator('h1').first()).toHaveClass(/heading-lego/)
  })

  test('active nav link shows a filled brand-colored brick icon', async ({ page }) => {
    await page.goto('/hobbies')
    const activeLink = page.locator('nav').first().locator('a[href="/hobbies"]')
    const icon = activeLink.locator('svg')
    await expect(icon).toHaveClass(/opacity-100/)
    await expect(icon).toHaveClass(/text-brand/)
  })

  test('inactive nav links keep the brick icon hidden until hover', async ({ page }) => {
    await page.goto('/hobbies')
    const inactiveLink = page.locator('nav').first().locator('a[href="/photography"]')
    const icon = inactiveLink.locator('svg')
    await expect(icon).toHaveClass(/opacity-0/)
  })

  test('favicon route responds with a PNG', async ({ request }) => {
    const response = await request.get('/icon')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('image/png')
  })

  test('footer renders the Lego badge divider', async ({ page }) => {
    await page.goto('/hobbies')
    const divider = page.locator('footer > div').first().locator('svg')
    await expect(divider).toBeVisible()
  })
})
