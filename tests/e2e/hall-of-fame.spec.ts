import { test, expect, type Page } from './fixtures'
import { ACHIEVEMENTS, type VisitorStats } from '../../src/components/house/visitor-stats'
import { MISSIONS } from '../../src/game/missions'

const AT = '2026-10-01T12:00:00.000Z'
const TOTAL = ACHIEVEMENTS.length

/** Guestbook stats that earn every sticker there is. */
const FULL: Partial<VisitorStats> = {
  visits: 5,
  rooms: { hall: 1, corridor: 1, living: 1, kitchen: 1, study: 1, bedroom: 1, balcony: 1 },
  steps: 2000,
  bicas: { perfect: 10, good: 0, under: 0, over: 0 },
  bicaBestStreak: 3,
  geoClosestKm: 10,
  geoBest: 4000,
  chats: 5,
  pets: 5,
  doorTries: 3,
  naps: 1,
  outfits: 5,
  missionSteps: MISSIONS.flatMap((mission) => mission.steps.map((step) => `${mission.id}/${step.id}`)),
  dozes: 1,
  paracetamols: 1,
  overdoses: 1,
  cheats: 1,
  terminalEggs: ['sudo', 'zeno', 'lisbon'],
  interviews: 1,
}

/** One sticker short: never overdosed on bicas. */
const ALMOST: Partial<VisitorStats> = { ...FULL, overdoses: 0 }

/** Stands in for /api/scores' Hall of Fame, newest first, and records what was posted. */
async function mockHall(page: Page, mode: 'ok' | 'unreachable' = 'ok') {
  let entries = [
    { id: 'h1', name: 'Ana Sofia', score: 13, meta: { total: 13 }, at: AT },
    { id: 'h2', name: 'Bruno', score: 12, meta: { total: 12 }, at: '2026-09-01T12:00:00.000Z' },
  ]
  const posts: Record<string, unknown>[] = []
  await page.route(/\/api\/scores(\?|$)/, async (route) => {
    if (mode === 'unreachable') return route.abort()
    const request = route.request()
    if (request.method() === 'POST') {
      const body = request.postDataJSON()
      posts.push(body)
      const entry = { id: 'mine', name: body.name, score: body.score, meta: body.meta, at: '2026-10-25T12:00:00.000Z' }
      entries = [entry, ...entries.filter((e) => e.id !== entry.id)]
      return route.fulfill({ status: 201, json: { entry, improved: true, rank: 1, entries } })
    }
    const board = new URL(request.url()).searchParams.get('board')!
    return route.fulfill({ json: { board, entries: board === 'hall-of-fame' ? entries : [] } })
  })
  return posts
}

async function seed(page: Page, stats: Partial<VisitorStats>, local: Record<string, string> = {}) {
  await page.addInitScript(
    ({ stats, local }) => {
      window.localStorage.setItem('house:welcomed', '1')
      window.localStorage.setItem('house:stats', JSON.stringify(stats))
      for (const [key, value] of Object.entries(local)) window.localStorage.setItem(key, value)
    },
    { stats, local },
  )
}

async function openGuestbook(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('button', { name: /Directory/ })).toBeVisible({ timeout: 15_000 })
  await page.keyboard.press('g')
  const guestbook = page.getByRole('dialog', { name: 'Guestbook' })
  await expect(guestbook).toBeVisible()
  return guestbook
}

test.describe('Hall of Fame', () => {
  test('the seeded stats really are a full set, and one short of it', () => {
    const full = { ...FULL } as VisitorStats
    expect(ACHIEVEMENTS.filter((a) => !a.earned(full)).map((a) => a.id)).toEqual([])
    expect(ACHIEVEMENTS.filter((a) => !a.earned({ ...ALMOST } as VisitorStats)).map((a) => a.id)).toEqual(['wired'])
  })

  test('without every sticker there is nothing to sign, but the board can be read', async ({ page }) => {
    const posts = await mockHall(page)
    await seed(page, ALMOST, { 'house:leaderboard-tab': 'hall-of-fame' })
    const guestbook = await openGuestbook(page)
    await expect(guestbook.getByText('Collect every sticker to sign the Hall of Fame')).toBeVisible()
    await expect(guestbook.getByRole('button', { name: 'Sign the Hall of Fame' })).toHaveCount(0)
    await page.keyboard.press('Escape')

    await page.keyboard.press('m')
    await page
      .getByRole('dialog', { name: 'What are you after?' })
      .getByRole('navigation', { name: 'Subjects' })
      .getByRole('button', { name: /^Leaderboards/ })
      .click()
    const panel = page.getByRole('dialog', { name: 'Leaderboards' })
    await expect(panel.getByRole('tab', { name: 'Hall of Fame' })).toHaveAttribute('aria-selected', 'true')
    await expect(panel.getByText(`You have ${TOTAL - 1} of ${TOTAL}`)).toBeVisible()
    const list = panel.getByRole('list', { name: 'Hall of Fame signatures' })
    await expect(list.getByRole('listitem')).toHaveCount(2)
    await expect(list.getByRole('listitem').first()).toContainText('Ana Sofia')
    await expect(list.getByRole('listitem').first()).toContainText('13/13 · Oct 2026')
    await expect(panel.getByRole('button', { name: 'Sign the Hall of Fame' })).toHaveCount(0)
    expect(posts).toHaveLength(0)
  })

  test('a full set signs the Hall of Fame from the guestbook, once per sticker total', async ({ page }) => {
    const posts = await mockHall(page)
    await seed(page, FULL, { 'house:score-name': 'Ana', 'house:leaderboard-tab': 'bica' })
    const guestbook = await openGuestbook(page)
    await guestbook.getByRole('button', { name: 'Sign the Hall of Fame' }).click()

    const panel = page.getByRole('dialog', { name: 'Leaderboards' })
    await expect(panel.getByRole('tab', { name: 'Hall of Fame' })).toHaveAttribute('aria-selected', 'true')
    const name = panel.getByRole('textbox', { name: `You have all ${TOTAL} stickers. Sign the Hall of Fame?` })
    await expect(name).toHaveValue('Ana')
    await name.fill('Ana B')
    await panel.getByRole('button', { name: 'Sign the Hall of Fame' }).click()
    await expect(panel.getByRole('status')).toHaveText('Signed! Your name is up in the Hall of Fame.')
    expect(posts).toEqual([
      expect.objectContaining({ board: 'hall-of-fame', name: 'Ana B', score: TOTAL, meta: { total: TOTAL }, player: expect.any(String) }),
    ])
    const own = panel.locator('[aria-current="true"]')
    await expect(own).toContainText('Ana B')
    await expect(own).toContainText(`${TOTAL}/${TOTAL}`)
    await expect(panel.getByRole('button', { name: 'Sign the Hall of Fame' })).toHaveCount(0)

    // Signed with this total: the guestbook now only points at the board.
    await page.keyboard.press('Escape')
    await expect(panel).toBeHidden()
    await page.keyboard.press('g')
    await expect(guestbook.getByRole('button', { name: 'See the Hall of Fame' })).toBeVisible()
    await expect(guestbook.getByRole('button', { name: 'Sign the Hall of Fame' })).toHaveCount(0)
  })

  test('a signature from before the latest stickers can be renewed', async ({ page }) => {
    await mockHall(page)
    const old = JSON.stringify({ 'hall-of-fame': { id: 'mine', score: TOTAL - 1 } })
    await seed(page, FULL, { 'house:score-entries': old })
    const guestbook = await openGuestbook(page)
    await guestbook.getByRole('button', { name: 'Sign the Hall of Fame' }).click()
    const panel = page.getByRole('dialog', { name: 'Leaderboards' })
    await expect(panel.getByRole('button', { name: 'Sign the Hall of Fame' })).toBeVisible()
  })

  test('an unreachable board says the Hall of Fame is unavailable', async ({ page }) => {
    await mockHall(page, 'unreachable')
    await seed(page, FULL, { 'house:score-name': 'Ana' })
    const guestbook = await openGuestbook(page)
    await guestbook.getByRole('button', { name: 'Sign the Hall of Fame' }).click()
    const panel = page.getByRole('dialog', { name: 'Leaderboards' })
    await expect(panel.getByText('The Hall of Fame is unavailable right now.', { exact: false })).toBeVisible()
    await panel.getByRole('button', { name: 'Sign the Hall of Fame' }).click()
    await expect(panel.getByText('The Hall of Fame is unavailable right now. Try again later.')).toBeVisible()
  })
})
