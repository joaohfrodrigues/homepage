import { test as base } from '@playwright/test'

export { expect, type Page } from '@playwright/test'

/**
 * Every page boots the house, which asks /api/weather for Lisbon's sky. Answer
 * it here with a clear one so no test reaches Open-Meteo or depends on the
 * forecast; a test can still `page.route` its own sky on top.
 */
export const test = base.extend<{ clearSky: void }>({
  clearSky: [
    async ({ context }, use) => {
      await context.route('**/api/weather', (route) => route.fulfill({ json: { weather: 'clear' } }))
      await use()
    },
    { auto: true },
  ],
})
