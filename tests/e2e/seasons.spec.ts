import { test, expect } from './fixtures'
import { furnishHouse } from '../../src/game/furnishings'
import { SEASONS, currentSeason, seasonOn, type Season } from '../../src/game/seasons'

const on = (month: number, day: number) => new Date(2026, month - 1, day, 12)

/** The props and pack sprites a season adds to the everyday house. */
function seasonalDecor(season: Season): string[] {
  const name = (item: ReturnType<typeof furnishHouse>['decor'][number]) =>
    item.kind === 'prop' ? item.prop : item.sprite
  const everyday = furnishHouse().decor.length
  return furnishHouse(season).decor.slice(everyday).map(name)
}

test.describe('Seasons', () => {
  test('the date picks the season', () => {
    expect(seasonOn(on(3, 14))).toBeNull()
    expect(seasonOn(on(12, 1))).toBe('xmas')
    expect(seasonOn(on(12, 30))).toBe('xmas')
    expect(seasonOn(on(12, 31))).toBe('newyear')
    expect(seasonOn(on(1, 1))).toBe('newyear')
    expect(seasonOn(on(1, 6))).toBe('xmas')
    expect(seasonOn(on(1, 7))).toBeNull()
    expect(seasonOn(on(6, 13))).toBe('santos')
    expect(seasonOn(on(10, 24))).toBeNull()
    expect(seasonOn(on(10, 31))).toBe('halloween')
    expect(seasonOn(on(11, 1))).toBeNull()
  })

  test('?season= previews a season whatever the date, and none turns them off', () => {
    expect(currentSeason('?season=santos', on(3, 14))).toBe('santos')
    expect(currentSeason('?season=none', on(12, 24))).toBeNull()
    expect(currentSeason('?season=easter', on(12, 24))).toBe('xmas')
    expect(currentSeason('', on(10, 31))).toBe('halloween')
  })

  test('every season puts something up, and an ordinary day nothing', () => {
    expect(furnishHouse(null).decor).toEqual(furnishHouse().decor)
    expect(seasonalDecor('xmas')).toEqual(expect.arrayContaining(['xmastree', 'bolorei']))
    expect(seasonalDecor('santos')).toEqual(expect.arrayContaining(['sardines', 'sprig', 'garland']))
    expect(seasonalDecor('halloween')).toEqual(['pumpkin'])
    expect(seasonalDecor('newyear')).toEqual(expect.arrayContaining(['balloons']))
    expect(seasonalDecor('birthday')).toEqual(expect.arrayContaining(['balloons']))
  })

  for (const season of SEASONS) {
    test(`the house boots dressed for ${season}`, async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.addInitScript(() => window.localStorage.setItem('house:welcomed', '1'))
      await page.goto(`/?season=${season}`)
      await expect(page.getByRole('button', { name: /Directory/ })).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText('João’s house')).toBeVisible()
      // The dev server exposes the game for poking at; check the scene got the season.
      const config = await page.evaluate(() => {
        const game = (window as unknown as { __house?: { scene: { getScene: (key: string) => unknown } } }).__house
        return (game?.scene.getScene('house') as { cfg?: { season: string | null } } | undefined)?.cfg?.season
      })
      expect(config).toBe(season)
      expect(errors).toEqual([])
    })
  }
})
