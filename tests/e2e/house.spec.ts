import { test, expect, type Page } from '@playwright/test'
import { furnishHouse } from '../../src/game/furnishings'
import { TILE, type Point } from '../../src/game/layout'

/** The directory's subject list, which it opens with. */
const subjects = (page: Page) =>
  page.getByRole('dialog', { name: 'What are you after?' }).getByRole('navigation', { name: 'Subjects' })

test.describe('House', () => {
  // These tests are about the house itself, so skip the first-visit welcome card.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('house:welcomed', '1'))
  })

  test('home page boots the game with its HUD', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('João’s house')).toBeVisible()
    await expect(page.getByRole('button', { name: /Directory/ })).toBeVisible()
  })

  test('M opens the directory and a room teleports there', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
    await page.keyboard.press('m')
    const directory = page.getByRole('dialog', { name: 'What are you after?' })
    await expect(directory).toBeVisible()
    await directory.getByRole('button', { name: 'Go to the study' }).click()
    await expect(directory).not.toBeVisible()
    await expect(page.getByText('Study', { exact: true })).toBeVisible()
  })

  for (const size of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'phone', width: 375, height: 812 },
  ]) {
    test(`the directory opens on subjects, all on screen (${size.name})`, async ({ page }) => {
      await page.setViewportSize(size)
      await page.goto('/')
      await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
      await page.getByRole('button', { name: /Directory/ }).click()
      const list = subjects(page)
      await expect(list.getByRole('link', { name: /^Trips & photography/ })).toContainText('Study · Wall map')
      // The whole list fits without scrolling; the floor plan waits below it.
      await expect(list.getByRole('listitem').first()).toBeInViewport({ ratio: 1 })
      await expect(list.getByRole('listitem').last()).toBeInViewport({ ratio: 1 })
    })
  }

  test('a subject walks the guest to its item, where they stand once the page closes', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
    await page.keyboard.press('m')
    await subjects(page).getByRole('link', { name: /^Trips & photography/ }).click()
    await expect(page.getByRole('dialog', { name: 'Travel map' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL('/')
    await expect(page.getByText('Study', { exact: true })).toBeVisible()
    // Standing at the wall map and facing it, so it's the thing to interact with.
    await expect(page.getByRole('button', { name: 'E Wall map' })).toBeVisible()
  })

  test('the floor plan reaches the balcony off the bedroom and keeps the bathroom shut', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
    await page.keyboard.press('m')
    const directory = page.getByRole('dialog', { name: 'What are you after?' })
    await expect(directory.getByLabel('Bathroom (occupied)')).toBeVisible()
    await expect(directory.getByRole('button', { name: 'Go to the bathroom' })).toHaveCount(0)
    await directory.getByRole('button', { name: 'Go to the balcony' }).click()
    await expect(directory).not.toBeVisible()
    await expect(page.getByText('Balcony', { exact: true })).toBeVisible()
  })

  test('travel map overlay has a pin per trip linking to its exhibition', async ({ page }) => {
    await page.goto('/photography')
    const overlay = page.getByRole('dialog', { name: 'Travel map' })
    await expect(overlay).toBeVisible()
    const pin = overlay.locator('a[href^="/photography/"][aria-label*="photos"]').first()
    await pin.click()
    await expect(page).toHaveURL(/\/photography\/.+/)
    await expect(page.getByRole('link', { name: 'Travel map' })).toBeVisible()
  })

  test('closing an overlay returns to the house', async ({ page }) => {
    await page.goto('/about')
    await expect(page.getByRole('dialog', { name: 'About João' })).toBeVisible()
    await page.getByRole('button', { name: 'Close and return to the house' }).click()
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('dialog', { name: 'About João' })).not.toBeVisible()
  })

  test('a page opened from the directory closes straight back to the house', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
    await page.keyboard.press('m')
    const directory = page.getByRole('dialog', { name: 'What are you after?' })
    await directory.getByRole('navigation', { name: 'Subjects' }).getByRole('link', { name: /^About João/ }).click()
    const about = page.getByRole('dialog', { name: 'About João' })
    await expect(about).toBeVisible()
    await expect(directory).not.toBeVisible()
    await page.getByRole('button', { name: 'Close and return to the house' }).click()
    await expect(page).toHaveURL('/')
    await expect(about).not.toBeVisible()
    await expect(directory).not.toBeVisible()
    // Back steps out of the house rather than reopening the page just closed.
    await page.goBack()
    await expect(page).not.toHaveURL(/\/about/)
  })

  test('Escape steps up from a trip to the travel map, then to the house', async ({ page }) => {
    await page.goto('/photography')
    const overlay = page.getByRole('dialog', { name: 'Travel map' })
    await overlay.locator('a[href^="/photography/"][aria-label*="photos"]').first().click()
    await expect(page).toHaveURL(/\/photography\/.+/)
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL('/photography')
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL('/')
  })

  test('Escape closes the directory after focus leaves it', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
    await page.keyboard.press('m')
    const directory = page.getByRole('dialog', { name: 'What are you after?' })
    await expect(directory).toBeVisible()
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    await page.keyboard.press('Escape')
    await expect(directory).not.toBeVisible()
  })

  test('hobby items open themed windows with the existing cards', async ({ page }) => {
    // In dev, the first visit after a change compiles the hobby route, which
    // can outlast the default 30s on its own.
    test.slow()
    await page.goto('/hobbies/running')
    const overlay = page.getByRole('dialog', { name: 'Running' })
    await expect(overlay).toBeVisible()
    await expect(overlay.getByRole('region', { name: 'Races' })).toBeVisible()
    await page.goto('/hobbies/watching')
    await expect(page.getByText('Now showing')).toBeVisible()
    await expect(page.locator('[data-testid="watch-card"]').first()).toBeVisible()
  })

  test('kitchen games open from the directory', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
    await page.keyboard.press('m')
    await subjects(page).getByRole('button', { name: /^Pull a bica/ }).click()
    const bica = page.getByRole('dialog', { name: 'Pull a bica' })
    await bica.getByRole('button', { name: 'Start the pull' }).click()
    await bica.getByRole('button', { name: 'Stop!' }).click()
    await expect(bica.getByRole('button', { name: 'Another one' })).toBeVisible()
    await page.keyboard.press('Escape')

    await page.keyboard.press('m')
    await subjects(page).getByRole('button', { name: /^Where was this taken\?/ }).click()
    const guess = page.getByRole('dialog', { name: 'Where was this taken?' })
    await guess.getByRole('application').click({ position: { x: 100, y: 60 } })
    await guess.getByRole('button', { name: 'Guess' }).click()
    await expect(guess.getByRole('link', { name: /trip/ })).toBeVisible()
  })

  test('the guestbook tallies the coffee machine and survives a reload', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
    await page.keyboard.press('m')
    await subjects(page).getByRole('button', { name: /^Pull a bica/ }).click()
    const bica = page.getByRole('dialog', { name: 'Pull a bica' })
    await bica.getByRole('button', { name: 'Start the pull' }).click()
    await bica.getByRole('button', { name: 'Stop!' }).click()
    await page.keyboard.press('Escape')

    await page.keyboard.press('g')
    const guestbook = page.getByRole('dialog', { name: 'Guestbook' })
    await expect(guestbook.getByRole('region', { name: 'Coffee machine' })).toContainText('1bica pulled')
    await expect(guestbook.getByText('First sip (earned)')).toBeVisible()
    await page.keyboard.press('Escape')

    await page.reload()
    await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Guestbook' }).click()
    await expect(guestbook).toContainText('this is your first visit')
    await expect(guestbook.getByRole('region', { name: 'Coffee machine' })).toContainText('1bica pulled')
  })

  test('the record player only plays when asked, remembers its volume and stops in a hidden tab', async ({ page }) => {
    // Count audio contexts, to show nothing makes a sound before the click.
    await page.addInitScript(() => {
      const win = window as unknown as { __audioContexts: number }
      win.__audioContexts = 0
      const Original = window.AudioContext
      window.AudioContext = class extends Original {
        constructor(options?: AudioContextOptions) {
          super(options)
          win.__audioContexts++
        }
      }
    })
    const audioContexts = () => page.evaluate(() => (window as unknown as { __audioContexts: number }).__audioContexts)
    const openRecordPlayer = async () => {
      await page.keyboard.press('m')
      await page.getByRole('button', { name: 'Go to the living room' }).click()
      await expect(page.getByText('Living room', { exact: true })).toBeVisible()
      // A click walks up to the turntable and uses it.
      const { x, y } = await screenPointOf(page, recordPlayer)
      await page.mouse.click(x, y)
      const panel = page.getByRole('dialog', { name: 'Record player' })
      await expect(panel).toBeVisible()
      return panel
    }

    await page.goto('/')
    await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
    const panel = await openRecordPlayer()
    await expect(panel.getByText('Needle up')).toBeVisible()
    expect(await audioContexts()).toBe(0)

    await panel.getByRole('button', { name: 'Play the record' }).click()
    await expect(panel.getByText('Now playing')).toBeVisible()
    expect(await audioContexts()).toBe(1)
    await panel.getByRole('slider', { name: 'Volume' }).fill('20')
    await panel.getByRole('button', { name: 'Mute' }).click()
    await expect(panel.getByText('Playing (muted)')).toBeVisible()

    // The music carries on in the house, with a way to stop it from the HUD.
    await page.keyboard.press('Escape')
    await expect(panel).not.toBeVisible()
    const stopMusic = page.getByRole('button', { name: 'Stop the music' })
    await expect(stopMusic).toBeVisible()

    // Switching tabs lifts the needle.
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await expect(stopMusic).not.toBeVisible()

    // Volume and mute are remembered; playing isn't.
    await page.reload()
    await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
    const again = await openRecordPlayer()
    await expect(again.getByText('Needle up')).toBeVisible()
    expect(await audioContexts()).toBe(0)
    await again.getByRole('button', { name: 'Unmute' }).click()
    await expect(again.getByRole('slider', { name: 'Volume' })).toHaveValue('20')
  })
})

/** A fresh tab: Back from the first page it loads leaves for here. */
const BLANK = 'about:blank'

test.describe('Back closes what is open over the house', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('house:welcomed', '1'))
    await page.goto('/')
    await expect(page.getByRole('button', { name: /Directory/ })).toBeVisible({ timeout: 15_000 })
  })

  test('Back from the plain house leaves as usual', async ({ page }) => {
    await page.goBack()
    await expect(page).toHaveURL(BLANK)
  })

  test('Back closes the directory, then leaves', async ({ page }) => {
    await page.keyboard.press('m')
    const directory = page.getByRole('dialog', { name: 'What are you after?' })
    await expect(directory).toBeVisible()
    await page.goBack()
    await expect(directory).not.toBeVisible()
    await expect(page).toHaveURL('/')
    // The house still takes input: the directory opens again.
    await page.keyboard.press('m')
    await expect(directory).toBeVisible()
    await page.goBack()
    await expect(directory).not.toBeVisible()
    await page.goBack()
    await expect(page).toHaveURL(BLANK)
  })

  const closings: { name: string; close: (page: Page) => Promise<void> }[] = [
    { name: 'its close button', close: (page) => page.getByRole('button', { name: 'Close directory' }).click() },
    { name: 'Escape', close: (page) => page.keyboard.press('Escape') },
    { name: 'M again', close: (page) => page.keyboard.press('m') },
    { name: 'a click outside', close: (page) => page.mouse.click(5, 300) },
    {
      name: 'a jump to a room',
      close: (page) =>
        page.getByRole('dialog', { name: 'What are you after?' }).getByRole('button', { name: 'Go to the study' }).click(),
    },
  ]
  for (const { name, close } of closings) {
    test(`closing the directory with ${name} leaves no history behind`, async ({ page }) => {
      await page.keyboard.press('m')
      const directory = page.getByRole('dialog', { name: 'What are you after?' })
      await expect(directory).toBeVisible()
      await close(page)
      await expect(directory).not.toBeVisible()
      await page.goBack()
      await expect(page).toHaveURL(BLANK)
    })
  }

  test('reopening the directory straight after closing it still gets Back', async ({ page }) => {
    const directory = page.getByRole('dialog', { name: 'What are you after?' })
    await page.keyboard.press('m')
    await page.keyboard.press('m')
    await page.keyboard.press('m')
    await expect(directory).toBeVisible()
    await page.goBack()
    await expect(directory).not.toBeVisible()
    await expect(page).toHaveURL('/')
    await page.goBack()
    await expect(page).toHaveURL(BLANK)
  })

  test('Back closes the guestbook opened with G, from the HUD or from the directory', async ({ page }) => {
    const guestbook = page.getByRole('dialog', { name: 'Guestbook' })
    await page.keyboard.press('g')
    await expect(guestbook).toBeVisible()
    await page.goBack()
    await expect(guestbook).not.toBeVisible()

    await page.getByRole('button', { name: 'Guestbook' }).click()
    await expect(guestbook).toBeVisible()
    await page.goBack()
    await expect(guestbook).not.toBeVisible()

    // From the directory the guestbook takes over the directory's entry.
    await page.keyboard.press('m')
    await subjects(page).getByRole('button', { name: /^Guestbook/ }).click()
    await expect(guestbook).toBeVisible()
    await page.goBack()
    await expect(guestbook).not.toBeVisible()
    await expect(page.getByRole('dialog', { name: 'What are you after?' })).not.toBeVisible()
    await expect(page).toHaveURL('/')
    await page.goBack()
    await expect(page).toHaveURL(BLANK)
  })

  test('switching between the directory and the guestbook keeps one entry', async ({ page }) => {
    await page.keyboard.press('m')
    await page.keyboard.press('g')
    const guestbook = page.getByRole('dialog', { name: 'Guestbook' })
    await expect(guestbook).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(guestbook).not.toBeVisible()
    await page.goBack()
    await expect(page).toHaveURL(BLANK)
  })

  test('Back closes the kitchen games and the wardrobe', async ({ page }) => {
    for (const [subject, title] of [
      [/^Pull a bica/, 'Pull a bica'],
      [/^Where was this taken\?/, 'Where was this taken?'],
      [/^Change outfit/, 'Change outfit'],
    ] as const) {
      await page.keyboard.press('m')
      await subjects(page).getByRole('button', { name: subject }).click()
      const panel = page.getByRole('dialog', { name: title })
      await expect(panel).toBeVisible()
      await page.goBack()
      await expect(panel).not.toBeVisible()
      await expect(page).toHaveURL('/')
    }
    await page.goBack()
    await expect(page).toHaveURL(BLANK)
  })

  test('Back closes a dialogue', async ({ page }) => {
    await page.keyboard.press('m')
    await subjects(page).getByRole('button', { name: /^Contact/ }).click()
    const dialogue = page.getByRole('dialog', { name: /^(Talking to|Notice)/ })
    await expect(dialogue).toBeVisible()
    await page.goBack()
    await expect(dialogue).not.toBeVisible()
    await expect(page).toHaveURL('/')
    await page.goBack()
    await expect(page).toHaveURL(BLANK)
  })

  test('a page opened from the directory takes its place in history', async ({ page }) => {
    await page.keyboard.press('m')
    await subjects(page).getByRole('link', { name: /^About João/ }).click()
    const about = page.getByRole('dialog', { name: 'About João' })
    await expect(about).toBeVisible()
    await page.goBack()
    await expect(page).toHaveURL('/')
    await expect(about).not.toBeVisible()
    await expect(page.getByRole('dialog', { name: 'What are you after?' })).not.toBeVisible()
    await page.goBack()
    await expect(page).toHaveURL(BLANK)
  })

  test('the fridge game’s trip link takes the panel’s place in history', async ({ page }) => {
    await page.keyboard.press('m')
    await subjects(page).getByRole('button', { name: /^Where was this taken\?/ }).click()
    const guess = page.getByRole('dialog', { name: 'Where was this taken?' })
    await guess.getByRole('application').click({ position: { x: 100, y: 60 } })
    await guess.getByRole('button', { name: 'Guess' }).click()
    await guess.getByRole('link', { name: /trip/ }).click()
    await expect(page).toHaveURL(/\/photography\/.+/)
    await expect(guess).not.toBeVisible()
    await page.goBack()
    await expect(page).toHaveURL('/')
    await expect(guess).not.toBeVisible()
    await page.goBack()
    await expect(page).toHaveURL(BLANK)
  })

  test('Back steps from a trip to the travel map to the house', async ({ page }) => {
    await page.getByRole('button', { name: /Directory/ }).click()
    await subjects(page).getByRole('link', { name: /^Trips & photography/ }).click()
    const map = page.getByRole('dialog', { name: 'Travel map' })
    await map.locator('a[href^="/photography/"][aria-label*="photos"]').first().click()
    await expect(page).toHaveURL(/\/photography\/.+/)
    await page.goBack()
    await expect(page).toHaveURL('/photography')
    await expect(map).toBeVisible()
    await page.goBack()
    await expect(page).toHaveURL('/')
    await expect(map).not.toBeVisible()
    await page.goBack()
    await expect(page).toHaveURL(BLANK)
  })
})

test.describe('Welcome card', () => {
  test('a first visit gets the card, and it stays dismissed after a reload', async ({ page }) => {
    await page.goto('/')
    const card = page.getByRole('dialog', { name: 'Hi, I’m João' })
    await expect(card.getByRole('button', { name: /^Close/ })).toBeFocused({ timeout: 15_000 })
    await expect(card.getByRole('link', { name: 'Films & series' })).toHaveAttribute('href', '/hobbies/watching')
    // The house waits behind the card: M doesn't open the directory yet.
    await page.keyboard.press('m')
    await expect(page.getByRole('dialog', { name: 'What are you after?' })).not.toBeVisible()
    await card.getByRole('button', { name: 'Explore the house' }).click()
    await expect(card).not.toBeVisible()
    await page.keyboard.press('m')
    await expect(page.getByRole('dialog', { name: 'What are you after?' })).toBeVisible()

    await page.reload()
    await expect(page.getByRole('button', { name: /Directory/ })).toBeVisible({ timeout: 15_000 })
    await expect(card).not.toBeVisible()
  })

  test('Escape dismisses the card', async ({ page }) => {
    await page.goto('/')
    const card = page.getByRole('dialog', { name: 'Hi, I’m João' })
    // Focus lands on the close button once the card's key handlers are in place.
    await expect(card.getByRole('button', { name: /^Close/ })).toBeFocused({ timeout: 15_000 })
    await page.keyboard.press('Escape')
    await expect(card).not.toBeVisible()
  })

  test('a shortcut opens its page and closing it returns to the house without the card', async ({ page }) => {
    await page.goto('/')
    const card = page.getByRole('dialog', { name: 'Hi, I’m João' })
    await card.getByRole('link', { name: 'About' }).click()
    const about = page.getByRole('dialog', { name: 'About João' })
    await expect(about).toBeVisible()
    await expect(card).not.toBeVisible()
    await page.getByRole('button', { name: 'Close and return to the house' }).click()
    await expect(page).toHaveURL('/')
    await expect(card).not.toBeVisible()
  })

  test('Back from the card leaves, like Back from any first page', async ({ page }) => {
    await page.goto('/')
    const card = page.getByRole('dialog', { name: 'Hi, I’m João' })
    await expect(card.getByRole('button', { name: /^Close/ })).toBeFocused({ timeout: 15_000 })
    await page.goBack()
    await expect(page).toHaveURL(BLANK)
  })

  test('a deep link skips the card', async ({ page }) => {
    await page.goto('/about')
    await expect(page.getByRole('dialog', { name: 'About João' })).toBeVisible()
    await page.getByRole('button', { name: 'Close and return to the house' }).click()
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('button', { name: /Directory/ })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('dialog', { name: 'Hi, I’m João' })).not.toBeVisible()
  })
})

/** Where a map tile's centre sits on screen, read from the house camera (exposed in dev). */
async function screenPointOf(page: Page, tile: Point) {
  return page.evaluate(
    ({ tile, size }) => {
      const game = (window as unknown as { __house: { scene: { getScene(key: string): unknown } } }).__house
      const scene = game.scene.getScene('house') as {
        cameras: { main: { worldView: { x: number; y: number }; zoom: number } }
      }
      const camera = scene.cameras.main
      const canvas = document.querySelector('canvas')!.getBoundingClientRect()
      return {
        x: canvas.left + ((tile.x + 0.5) * size - camera.worldView.x) * camera.zoom,
        y: canvas.top + ((tile.y + 0.5) * size - camera.worldView.y) * camera.zoom,
      }
    },
    { tile, size: TILE },
  )
}

async function playerTile(page: Page): Promise<Point> {
  return page.evaluate(() => {
    const game = (window as unknown as { __house: { scene: { getScene(key: string): unknown } } }).__house
    const { tile } = (game.scene.getScene('house') as { player: { tile: Point } }).player
    return { x: tile.x, y: tile.y }
  })
}

async function tapTile(page: Page, tile: Point) {
  const { x, y } = await screenPointOf(page, tile)
  await page.touchscreen.tap(x, y)
}

// The guestbook stand, near the hall spawn: a tap has to walk there before it
// can be used.
const guestbookStand = furnishHouse().interactables.find((object) => object.id === 'guestbook')!.tiles[0]
const recordPlayer = furnishHouse().interactables.find((object) => object.id === 'recordplayer')!.tiles[0]

test.describe('House on a touch screen', () => {
  // Real touch events, so the game sees `pointer.wasTouch` the way a phone would.
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true })

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('house:welcomed', '1'))
  })

  async function boot(page: Page) {
    await page.goto('/')
    await expect(page.getByRole('button', { name: /Directory/ })).toBeVisible({ timeout: 15_000 })
  }

  test('a tap walks; a tapped thing is walked up to, and a second tap opens it', async ({ page }) => {
    await boot(page)
    await expect(page.getByRole('button', { name: 'On-screen joystick' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^A\b/ })).toHaveCount(0)
    await expect(page.getByText('Drag anywhere to walk')).toBeVisible()

    const start = await playerTile(page)
    await tapTile(page, { x: start.x, y: start.y - 1 })
    await expect.poll(() => playerTile(page)).toEqual({ x: start.x, y: start.y - 1 })

    // The first tap on the stand only walks up to it and faces it.
    const guestbook = page.getByRole('dialog', { name: 'Guestbook' })
    const hint = page.getByRole('button', { name: /^Tap.*Guestbook/ })
    await tapTile(page, guestbookStand)
    await expect(hint).toBeVisible()
    await page.waitForTimeout(300)
    await expect(guestbook).not.toBeVisible()

    // The second opens it.
    await tapTile(page, guestbookStand)
    await expect(guestbook).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(guestbook).not.toBeVisible()

    // Still standing there facing it, one tap is enough.
    await tapTile(page, guestbookStand)
    await expect(guestbook).toBeVisible()
  })

  test('dragging anywhere brings up the joystick and walks', async ({ page }) => {
    await boot(page)
    await expect(page.getByTestId('joystick')).toHaveCount(0)
    const start = await playerTile(page)
    const from = await screenPointOf(page, start)
    const client = await page.context().newCDPSession(page)
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) =>
      client.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] })

    // Start on the right half too: the whole screen takes a drag now.
    await touch('touchStart', from.x + 60, from.y)
    for (let dy = 8; dy <= 64; dy += 8) await touch('touchMove', from.x + 60, from.y - dy)
    await expect(page.getByTestId('joystick')).toBeVisible()
    await expect.poll(() => playerTile(page).then((tile) => tile.y)).toBeLessThan(start.y)
    await touch('touchEnd', 0, 0)
    await expect(page.getByTestId('joystick')).toHaveCount(0)
  })
})
