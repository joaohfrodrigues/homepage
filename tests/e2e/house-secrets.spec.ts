import { test, expect, type Page } from '@playwright/test'

/** Walks the guest to the study's Raspberry Pi via the directory, and back from its series. */
async function standAtThePi(page: Page) {
  await page.keyboard.press('m')
  await page
    .getByRole('dialog', { name: 'What are you after?' })
    .getByRole('navigation', { name: 'Subjects' })
    .getByRole('link', { name: /^Home server series/ })
    .click()
  await expect(page).toHaveURL('/writing/projects/raspberry-pi')
  await page.getByRole('button', { name: 'Close and return to the house' }).click()
  await expect(page).toHaveURL('/')
}

/** Opens the Pi's dialogue and clicks through its lines to the choices. */
async function openPiDialogue(page: Page) {
  await page.getByRole('button', { name: 'E Desk & Raspberry Pi' }).click()
  const dialogue = page.getByRole('dialog', { name: 'Notice' })
  const shell = dialogue.getByRole('button', { name: 'Type something at the prompt' })
  await expect(async () => {
    await dialogue.click({ position: { x: 10, y: 10 } })
    await expect(shell).toBeVisible({ timeout: 500 })
  }).toPass()
  return dialogue
}

test.describe('House secrets', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('house:welcomed', '1'))
    await page.goto('/')
    await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: /Directory/ })).toBeVisible({ timeout: 15_000 })
  })

  test('the Pi still links to its series, one choice away', async ({ page }) => {
    await standAtThePi(page)
    const dialogue = await openPiDialogue(page)
    await dialogue.getByRole('button', { name: 'Read the home server series →' }).click()
    await expect(page).toHaveURL('/writing/projects/raspberry-pi')
  })

  test('the Pi opens a keyboard-driven shell that Escape and exit close', async ({ page }) => {
    await standAtThePi(page)
    await (await openPiDialogue(page)).getByRole('button', { name: 'Type something at the prompt' }).click()
    const terminal = page.getByRole('dialog', { name: 'pi@homeserver' })
    const command = terminal.getByRole('textbox', { name: 'Command' })
    const output = terminal.getByRole('log', { name: 'Terminal output' })
    await expect(command).toBeFocused()

    await command.fill('docker ps')
    await command.press('Enter')
    await expect(output).toContainText('plex')
    await expect(output).toContainText('radarr')
    await expect(output.getByRole('link', { name: /Part 2: The Media Center/ })).toBeVisible()

    await command.fill('sudo rm -rf /')
    await command.press('Enter')
    await expect(output).toContainText('Nice try.')

    // ↑ recalls the last command.
    await command.press('ArrowUp')
    await expect(command).toHaveValue('sudo rm -rf /')

    await page.keyboard.press('Escape')
    await expect(terminal).not.toBeVisible()
    await expect(page).toHaveURL('/')

    await (await openPiDialogue(page)).getByRole('button', { name: 'Type something at the prompt' }).click()
    await command.fill('exit')
    await command.press('Enter')
    await expect(terminal).not.toBeVisible()
  })

  test('Back closes the shell', async ({ page }) => {
    await standAtThePi(page)
    await (await openPiDialogue(page)).getByRole('button', { name: 'Type something at the prompt' }).click()
    const terminal = page.getByRole('dialog', { name: 'pi@homeserver' })
    await expect(terminal).toBeVisible()
    await page.goBack()
    await expect(terminal).not.toBeVisible()
    await expect(page).toHaveURL('/')
  })

  test('a link in the shell takes the panel’s place in history', async ({ page }) => {
    await standAtThePi(page)
    await (await openPiDialogue(page)).getByRole('button', { name: 'Type something at the prompt' }).click()
    const terminal = page.getByRole('dialog', { name: 'pi@homeserver' })
    const command = terminal.getByRole('textbox', { name: 'Command' })
    await command.fill('docker ps')
    await command.press('Enter')
    await terminal.getByRole('link', { name: /Part 2: The Media Center/ }).click()
    await expect(page).toHaveURL('/writing/projects/raspberry-pi/home-server-part-2-media-center')
    await expect(terminal).not.toBeVisible()
    await page.goBack()
    await expect(page).toHaveURL('/')
    await expect(terminal).not.toBeVisible()
  })

  test('the Konami code throws a party only once it is complete, and earns a sticker', async ({ page }) => {
    const party = page.getByRole('status').filter({ hasText: 'party hat' })
    for (const key of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b']) {
      await page.keyboard.press(key)
    }
    // The arrows walk the guest as usual; nothing happens before the last A.
    await expect(party).toHaveCount(0)
    await page.keyboard.press('a')
    await expect(party).toBeVisible()

    await page.keyboard.press('g')
    await expect(page.getByRole('dialog', { name: 'Guestbook' }).getByText('Party animal (earned)')).toBeVisible()
  })
})
