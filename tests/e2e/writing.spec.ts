import { test, expect } from '@playwright/test'

test.describe('/writing', () => {
  test('renders the project card and no tag filter', async ({ page }) => {
    await page.goto('/writing')
    await expect(page.getByRole('heading', { name: 'Writing' })).toBeVisible()
    await expect(page.getByRole('link', { name: /Raspberry Pi Home Server/ })).toBeVisible()
  })

  test('clicking a project card navigates to its project page', async ({ page }) => {
    await page.goto('/writing')
    const projectLink = page.getByRole('link', { name: /Raspberry Pi Home Server/ }).first()
    await projectLink.click()
    await expect(page).toHaveURL('/writing/projects/raspberry-pi')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Raspberry Pi Home Server')
  })
})

test.describe('/writing/projects/[project-slug]', () => {
  test('lists only published articles for the project', async ({ page }) => {
    await page.goto('/writing/projects/raspberry-pi')
    await expect(page.getByRole('link', { name: /Part 1/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /Part 2/ })).not.toBeVisible()
  })

  test('clicking an article navigates to the project article page', async ({ page }) => {
    await page.goto('/writing/projects/raspberry-pi')
    const firstLink = page.getByRole('link').filter({ hasText: /Part 1/ }).first()
    const href = await firstLink.getAttribute('href')
    await firstLink.click()
    await expect(page).toHaveURL(href!)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Part 1')
  })
})

test.describe('/writing/projects/[project-slug]/[article-slug]', () => {
  test('renders article with breadcrumb, reading time', async ({ page }) => {
    await page.goto('/writing/projects/raspberry-pi/home-server-part-1-foundation')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Part 1')
    await expect(page.getByText(/min read/)).toBeVisible()
    const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' })
    await expect(breadcrumb.getByRole('link', { name: 'Writing' })).toBeVisible()
    await expect(breadcrumb.getByRole('link', { name: 'Raspberry Pi Home Server' })).toBeVisible()
  })

  test('draft articles return 404 to unauthenticated visitors', async ({ page }) => {
    const response = await page.goto(
      '/writing/projects/raspberry-pi/home-server-part-2-media-center'
    )
    expect(response?.status()).toBe(404)
  })
})
