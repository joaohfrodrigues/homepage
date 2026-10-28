import { defineConfig, devices } from '@playwright/test'

// Port 3100, so the suite never lands on a dev server already running on 3000.
const port = Number(process.env.E2E_PORT || 3100)
const baseURL = `http://localhost:${port}`

// By default the suite runs against a production build: no route compiles on
// first hit, so the house boots in a second or two. The build goes to `.next`,
// beside a dev server's `.next/dev`, so the two don't trip over each other.
// E2E_DEV=1 runs the suite against `next dev` instead, for debugging with
// source maps and hot reload.
const dev = process.env.E2E_DEV === '1'
const env = {
  // Exposes the Phaser game as window.__house, which the house specs read.
  NEXT_PUBLIC_E2E: '1',
  // `next build` needs Keystatic's GitHub settings; nothing in the suite signs in.
  KEYSTATIC_GITHUB_CLIENT_ID: process.env.KEYSTATIC_GITHUB_CLIENT_ID || 'e2e',
  KEYSTATIC_GITHUB_CLIENT_SECRET: process.env.KEYSTATIC_GITHUB_CLIENT_SECRET || 'e2e',
  KEYSTATIC_SECRET: process.env.KEYSTATIC_SECRET || 'e2e-only-not-a-secret-e2e-only-not-a-secret',
}

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // The house is a canvas game: past about half the cores, its animations
  // starve each other and timing-sensitive tests start to flake.
  workers: process.env.CI ? 2 : '50%',
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
    },
  ],
  webServer: {
    command: dev ? `npx next dev -p ${port}` : `npx next build && npx next start -p ${port}`,
    url: baseURL,
    env: dev ? { NEXT_PUBLIC_E2E: '1' } : env,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
