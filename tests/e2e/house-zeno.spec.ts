import { test, expect, type Page } from '@playwright/test'
import { furnishHouse } from '../../src/game/furnishings'
import { TILE, type Point } from '../../src/game/layout'
import { pickZenoEvent, ZENO_EVENTS, type ZenoEventId } from '../../src/game/zeno-events'

/** A repeatable stand-in for Math.random. */
function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

interface HouseScene {
  forceZenoEvent(id: ZenoEventId): boolean
  zenoAsleep: boolean
  cameras: { main: { worldView: { x: number; y: number }; zoom: number } }
}

/** Runs `fn` against the house scene (the game is on window.__house in dev). */
function withScene<T, A>(page: Page, fn: (scene: HouseScene, arg: A) => T, arg: A) {
  return page.evaluate(
    ({ source, arg }) => {
      const game = (window as unknown as { __house: { scene: { getScene(key: string): unknown } } }).__house
      return new Function('scene', 'arg', `return (${source})(scene, arg)`)(game.scene.getScene('house'), arg) as T
    },
    { source: fn.toString(), arg },
  )
}

async function seenZenoEvents(page: Page): Promise<string[]> {
  return page.evaluate(() => JSON.parse(window.localStorage.getItem('house:stats') ?? '{}').zenoEvents ?? [])
}

test.describe('Zeno’s rare moments', () => {
  test('the picker is seedable and every random moment comes up', () => {
    const picks = (seed: number, neglected = false) => {
      const random = seeded(seed)
      return Array.from({ length: 200 }, () => pickZenoEvent(random, neglected))
    }
    expect(picks(7)).toEqual(picks(7))
    expect(new Set(picks(7))).toEqual(new Set(ZENO_EVENTS.filter((id) => id !== 'follow')))
    // A neglected litter box makes him meow far more often.
    const meows = (neglected: boolean) => picks(11, neglected).filter((id) => id === 'meow').length
    expect(meows(true)).toBeGreaterThan(meows(false) * 2)
  })

  test.describe('in the house', () => {
    // He walks over from wherever he happens to be first.
    test.setTimeout(60_000)

    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => window.localStorage.setItem('house:welcomed', '1'))
      await page.goto('/')
      await expect(page.getByRole('button', { name: /Directory/ })).toBeVisible({ timeout: 15_000 })
      await page.keyboard.press('m')
      await page.getByRole('dialog', { name: 'What are you after?' }).getByRole('button', { name: 'Go to the study' }).click()
      await expect(page.getByText('Study', { exact: true })).toBeVisible()
    })

    test('he knocks a mug off the shelf in view, and the guestbook remembers', async ({ page }) => {
      expect(await withScene(page, (scene, id) => scene.forceZenoEvent(id), 'crash' as ZenoEventId)).toBe(true)
      await expect.poll(() => seenZenoEvents(page), { timeout: 40_000 }).toContain('crash')
    })

    test('asleep on the keyboard, the desk says so instead of opening', async ({ page }) => {
      expect(await withScene(page, (scene, id) => scene.forceZenoEvent(id), 'keyboard' as ZenoEventId)).toBe(true)
      await expect.poll(() => withScene(page, (scene) => scene.zenoAsleep, null), { timeout: 40_000 }).toBe(true)

      const desk = furnishHouse().interactables.find((object) => object.id === 'home-server')!.tiles[0]
      const at = await withScene(
        page,
        (scene, { tile, size }: { tile: Point; size: number }) => {
          const camera = scene.cameras.main
          const canvas = document.querySelector('canvas')!.getBoundingClientRect()
          return {
            x: canvas.left + ((tile.x + 0.5) * size - camera.worldView.x) * camera.zoom,
            y: canvas.top + ((tile.y + 0.5) * size - camera.worldView.y) * camera.zoom,
          }
        },
        { tile: desk, size: TILE },
      )
      await page.mouse.click(at.x, at.y)
      await expect(page.getByText('Zeno is fast asleep on the keyboard', { exact: false })).toBeVisible({ timeout: 10_000 })
      await expect.poll(() => seenZenoEvents(page)).toContain('keyboard')
    })
  })

  for (const earned of [false, true]) {
    test(`the Cat behaviourist sticker stays a secret until it is earned (${earned ? 'earned' : 'locked'})`, async ({ page }) => {
      await page.addInitScript(
        ({ events }) => {
          window.localStorage.setItem('house:welcomed', '1')
          if (events) window.localStorage.setItem('house:stats', JSON.stringify({ zenoEvents: events }))
        },
        { events: earned ? ZENO_EVENTS : null },
      )
      await page.goto('/')
      await expect(page.getByRole('button', { name: /Directory/ })).toBeVisible({ timeout: 15_000 })
      await page.keyboard.press('g')
      const stickers = page.getByRole('region', { name: 'Stickers' })
      if (earned) {
        await expect(stickers).toContainText('Cat behaviourist (earned)')
      } else {
        await expect(stickers).toContainText('Secret sticker')
        await expect(stickers).not.toContainText('Cat behaviourist')
      }
    })
  }
})
