import { test, expect, type Page } from '@playwright/test'
import { furnishHouse } from '../../src/game/furnishings'
import { TILE, type Point } from '../../src/game/layout'

interface Entry {
  id: string
  name: string
  score: number
  at: string
}

const AT = '2026-10-01T12:00:00.000Z'

/** What the mocked API starts with; tests get a fresh copy each. */
const SEED: Record<string, Entry[]> = {
  geoguess: [
    { id: 'g1', name: 'Ana Sofia', score: 4820, at: AT },
    { id: 'g2', name: 'Bruno', score: 4410, at: AT },
    { id: 'g3', name: 'Carla', score: 3900, at: AT },
  ],
  bica: [
    { id: 'b1', name: 'Zé', score: 14, at: AT },
    { id: 'b2', name: 'Rita', score: 9, at: AT },
  ],
}

/**
 * Stands in for /api/scores. Lists and accepts entries like the real thing,
 * or answers every request as offline, and records what was posted.
 */
async function mockScores(page: Page, mode: 'ok' | 'offline' | 'unreachable' = 'ok') {
  const boards = structuredClone(SEED)
  const posts: Record<string, unknown>[] = []
  await page.route(/\/api\/scores(\?|$)/, async (route) => {
    if (mode === 'unreachable') return route.abort()
    if (mode === 'offline') return route.fulfill({ status: 503, json: { error: 'The scoreboards are offline right now.', offline: true } })
    const request = route.request()
    if (request.method() === 'POST') {
      const body = request.postDataJSON()
      posts.push(body)
      if (body.name === 'Rude Name') return route.fulfill({ status: 400, json: { error: 'Please pick a different name.', field: 'name' } })
      const entry = { id: `mine-${body.board}`, name: body.name, score: body.score, at: AT }
      const entries = [...boards[body.board].filter((e) => e.id !== entry.id), entry].sort((a, b) => b.score - a.score)
      boards[body.board] = entries
      return route.fulfill({ status: 201, json: { entry, improved: true, rank: entries.indexOf(entry) + 1, entries } })
    }
    const board = new URL(request.url()).searchParams.get('board')!
    return route.fulfill({ json: { board, entries: boards[board] ?? [] } })
  })
  return posts
}

/** Seeds this browser's guestbook stats and any earlier submissions before the page loads. */
async function seed(page: Page, stats: Record<string, number>, local: Record<string, string> = {}) {
  await page.addInitScript(
    ({ stats, local }) => {
      window.localStorage.setItem('house:welcomed', '1')
      window.localStorage.setItem('house:stats', JSON.stringify(stats))
      for (const [key, value] of Object.entries(local)) window.localStorage.setItem(key, value)
    },
    { stats, local },
  )
}

async function openGame(page: Page, subject: RegExp, title: string) {
  await page.goto('/')
  await expect(page.getByRole('button', { name: /Directory/ })).toBeVisible({ timeout: 15_000 })
  await page.keyboard.press('m')
  await page
    .getByRole('dialog', { name: 'What are you after?' })
    .getByRole('navigation', { name: 'Subjects' })
    .getByRole('button', { name: subject })
    .click()
  // The guest walks to the item first, so wait for the panel itself.
  const panel = page.getByRole('dialog', { name: title })
  await expect(panel).toBeVisible()
  return panel
}

test.describe('Leaderboards', () => {
  test('the Top 10 tab lists the board and highlights the visitor’s own entry', async ({ page }) => {
    const posts = await mockScores(page)
    await seed(page, { bicaBestStreak: 9 }, { 'house:score-entries': JSON.stringify({ bica: { id: 'b2', score: 9 } }) })
    const bica = await openGame(page, /^Pull a bica/, 'Pull a bica')
    await expect(bica.getByRole('button', { name: 'Start the pull' })).toBeVisible()
    await bica.getByRole('tab', { name: 'Top 10' }).click()
    const list = bica.getByRole('list', { name: /Bica streak top/ })
    await expect(list.getByRole('listitem')).toHaveCount(2)
    await expect(list.getByRole('listitem').first()).toContainText('Zé')
    await expect(list.locator('[aria-current="true"]')).toContainText('Rita')
    // Already on the board with that best: nothing to submit, and nothing was sent.
    await expect(bica.getByRole('button', { name: 'Submit to the leaderboard' })).toHaveCount(0)
    expect(posts).toHaveLength(0)
  })

  test('a better best goes on the board under the chosen name', async ({ page }) => {
    const posts = await mockScores(page)
    await seed(page, { bicaBestStreak: 12 }, { 'house:score-name': 'Ana' })
    const bica = await openGame(page, /^Pull a bica/, 'Pull a bica')
    await bica.getByRole('tab', { name: 'Top 10' }).click()
    const name = bica.getByRole('textbox', { name: /Put your best, 12 in a row/ })
    await expect(name).toHaveValue('Ana')

    // Names are checked before anything is sent.
    await name.fill('A')
    await bica.getByRole('button', { name: 'Submit to the leaderboard' }).click()
    await expect(bica.getByText('Names need 2 to 16 characters.')).toBeVisible()
    expect(posts).toHaveLength(0)

    await name.fill('Ana B')
    await bica.getByRole('button', { name: 'Submit to the leaderboard' }).click()
    await expect(bica.getByRole('status')).toHaveText('You’re number 2 on the Bica streak board!')
    await expect(bica.locator('[aria-current="true"]')).toContainText('Ana B')
    expect(posts).toEqual([expect.objectContaining({ board: 'bica', name: 'Ana B', score: 12, player: expect.any(String) })])
    await expect(bica.getByRole('button', { name: 'Submit to the leaderboard' })).toHaveCount(0)
    // The name is remembered to prefill the next submission.
    expect(await page.evaluate(() => window.localStorage.getItem('house:score-name'))).toBe('Ana B')
  })

  test('a new best at the coffee machine is offered straight away on the Play tab', async ({ page }) => {
    const posts = await mockScores(page)
    await seed(page, {})
    await page.clock.install()
    const bica = await openGame(page, /^Pull a bica/, 'Pull a bica')
    // With the clock in hand, stop the needle on 9 bar: from 0 bar it swings
    // at 3 radians a second, and 9 bar is a quarter turn plus asin(0.2) in.
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100))
    await bica.getByRole('button', { name: 'Start the pull' }).click()
    await page.clock.runFor(Math.round(((Math.PI / 2 + Math.asin(0.2)) / 3) * 1000))
    await bica.getByRole('button', { name: 'Stop!' }).click()
    await expect(bica.getByText(/^Perfect bica!/)).toBeVisible()
    const name = bica.getByRole('textbox', { name: /Put your best, 1 in a row/ })
    await expect(name).toBeVisible()
    await name.fill('Barista')
    await bica.getByRole('button', { name: 'Submit to the leaderboard' }).click()
    await expect(bica.getByRole('status')).toHaveText('You’re number 3 on the Bica streak board!')
    expect(posts).toEqual([expect.objectContaining({ board: 'bica', name: 'Barista', score: 1 })])
  })

  test('the server’s reason for turning a name down is shown', async ({ page }) => {
    await mockScores(page)
    await seed(page, { geoBest: 4200 })
    const geo = await openGame(page, /^Where was this taken\?/, 'Where was this taken?')
    await geo.getByRole('tab', { name: 'Top 10' }).click()
    await expect(geo.getByRole('list', { name: /Fridge magnets top/ }).getByRole('listitem')).toHaveCount(3)
    await geo.getByRole('textbox', { name: /Put your best, 4200 pts/ }).fill('Rude Name')
    await geo.getByRole('button', { name: 'Submit to the leaderboard' }).click()
    await expect(geo.getByText('Please pick a different name.')).toBeVisible()
  })

  test('offline boards say so, and so does submitting to one', async ({ page }) => {
    await mockScores(page, 'offline')
    await seed(page, { bicaBestStreak: 5 })
    const bica = await openGame(page, /^Pull a bica/, 'Pull a bica')
    await bica.getByRole('tab', { name: 'Top 10' }).click()
    await expect(bica.getByText('The Bica streak board is offline right now.', { exact: false })).toBeVisible()
    await bica.getByRole('textbox', { name: /Put your best/ }).fill('Ana')
    await bica.getByRole('button', { name: 'Submit to the leaderboard' }).click()
    await expect(bica.getByText('The leaderboard is offline right now. Try again later.')).toBeVisible()
    // The game itself still plays.
    await bica.getByRole('tab', { name: 'Play' }).click()
    await bica.getByRole('button', { name: 'Start the pull' }).click()
    await bica.getByRole('button', { name: 'Stop!' }).click()
    await expect(bica.getByRole('button', { name: 'Another one' })).toBeVisible()
  })
})

/** Reads the chalk on the kitchen chalkboard from the scene (exposed in dev). */
async function chalk(page: Page) {
  return page.evaluate(() => {
    const game = (window as unknown as { __house: { scene: { getScene(key: string): unknown } } }).__house
    const board = (game.scene.getScene('house') as {
      chalk: { title: { text: string }; rows: { name: { text: string }; score: { text: string } }[] }
    }).chalk
    return [board.title.text, ...board.rows.map((row) => `${row.name.text} ${row.score.text}`.trim())]
  })
}

/** Where a map tile's centre sits on screen, read from the house camera. */
async function screenPointOf(page: Page, tile: Point) {
  return page.evaluate(
    ({ tile, size }) => {
      const game = (window as unknown as { __house: { scene: { getScene(key: string): unknown } } }).__house
      const camera = (game.scene.getScene('house') as {
        cameras: { main: { worldView: { x: number; y: number }; zoom: number } }
      }).cameras.main
      const canvas = document.querySelector('canvas')!.getBoundingClientRect()
      return {
        x: canvas.left + ((tile.x + 0.5) * size - camera.worldView.x) * camera.zoom,
        y: canvas.top + ((tile.y + 0.5) * size - camera.worldView.y) * camera.zoom,
      }
    },
    { tile, size: TILE },
  )
}

const chalkboard = furnishHouse().interactables.find((object) => object.id === 'chalkboard')!

test.describe('Kitchen chalkboard', () => {
  test('chalks up each board’s top three and opens the full boards', async ({ page }) => {
    await mockScores(page)
    await seed(page, {})
    await page.goto('/')
    await expect(page.getByRole('button', { name: /Directory/ })).toBeVisible({ timeout: 15_000 })
    await expect.poll(() => chalk(page)).toEqual(['Magnets', expect.stringMatching(/^1 Ana.* 4820$/), expect.stringMatching(/^2 Bru.* 4410$/), expect.stringMatching(/^3 Car.* 3900$/)])

    await page.keyboard.press('m')
    await page.getByRole('dialog', { name: 'What are you after?' }).getByRole('button', { name: 'Go to the kitchen' }).click()
    // Let the camera settle on the kitchen and the house take input again.
    await expect(page.getByText('Kitchen', { exact: true })).toBeVisible()
    await page.waitForTimeout(500)
    const { x, y } = await screenPointOf(page, chalkboard.tiles[0])
    await page.mouse.click(x, y)
    const panel = page.getByRole('dialog', { name: 'Top scores' })
    await expect(panel).toBeVisible()
    await expect(panel.getByRole('region', { name: 'Fridge magnets' }).getByRole('listitem')).toHaveCount(3)
    await expect(panel.getByRole('region', { name: 'Bica streak' }).getByRole('listitem').first()).toContainText('Zé')
  })

  test('a failed fetch leaves the house running and the chalkboard says so', async ({ page }) => {
    await mockScores(page, 'unreachable')
    await seed(page, {})
    await page.goto('/')
    await expect(page.getByRole('button', { name: /Directory/ })).toBeVisible({ timeout: 15_000 })
    await expect.poll(() => chalk(page)).toEqual(['Top scores', 'back soon', '', ''])
    await page.keyboard.press('m')
    await expect(page.getByRole('dialog', { name: 'What are you after?' })).toBeVisible()
  })
})
