import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test, expect } from '@playwright/test'

const ARTICLES_DIR = join(process.cwd(), 'content/articles')
const today = new Date().toISOString().slice(0, 10)

/** The raspberry-pi articles split by whether the site should show them, read from their front matter. */
function raspberryPiArticles() {
  const articles = readdirSync(ARTICLES_DIR)
    .filter((file) => file.endsWith('.mdoc'))
    .map((file) => {
      const source = readFileSync(join(ARTICLES_DIR, file), 'utf8')
      const field = (name: string) => {
        const value = source.match(new RegExp(`^${name}: (.*)$`, 'm'))?.[1] ?? ''
        // Single-quoted YAML scalars escape a quote by doubling it.
        return /^'.*'$/.test(value) ? value.slice(1, -1).replaceAll("''", "'") : value
      }
      return {
        slug: file.replace(/\.mdoc$/, ''),
        title: field('title'),
        project: field('project'),
        hidden: field('draft') === 'true' || !field('publishedAt') || field('publishedAt') > today,
      }
    })
    .filter((article) => article.project === 'raspberry-pi')
  return {
    published: articles.filter((article) => !article.hidden),
    hidden: articles.filter((article) => article.hidden),
  }
}

test.describe('/writing', () => {
  test('renders the project card and no tag filter', async ({ page }) => {
    await page.goto('/writing')
    await expect(page.getByRole('heading', { name: 'Writing' })).toBeVisible()
    const projects = page.getByRole('region', { name: 'Projects' })
    await expect(projects.getByRole('link', { name: 'Raspberry Pi Home Server', exact: true })).toBeVisible()
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
    const { published, hidden } = raspberryPiArticles()
    await page.goto('/writing/projects/raspberry-pi')
    const articles = page.getByRole('region', { name: 'Articles' })
    for (const article of published) {
      await expect(articles.getByRole('link', { name: article.title, exact: true })).toBeVisible()
    }
    for (const article of hidden) {
      await expect(page.locator(`a[href$="/${article.slug}"]`)).toHaveCount(0)
    }
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

  test('draft and future-dated articles return 404 to unauthenticated visitors', async ({ page }) => {
    const { hidden } = raspberryPiArticles()
    test.skip(hidden.length === 0, 'No raspberry-pi article is a draft or future-dated right now')
    for (const article of hidden) {
      const response = await page.goto(`/writing/projects/raspberry-pi/${article.slug}`)
      expect(response?.status(), article.slug).toBe(404)
    }
  })
})
