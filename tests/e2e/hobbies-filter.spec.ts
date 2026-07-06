import { test, expect } from '@playwright/test'

// Gear/event content here (Hoka, Roland, Sony) is stable, manually maintained
// yaml — safe to assert on by name. Watch items are Plex-synced and rotate,
// so those assertions stay structural (counts/tags), matching watching.spec.ts.
test.describe('/hobbies — category filter', () => {
  test('renders a chip for every hobby plus a separate gear-only toggle', async ({ page }) => {
    await page.goto('/hobbies')
    for (const label of ['Film', 'Series', 'Running', 'Music', 'Photography']) {
      await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible()
    }
    await expect(page.getByRole('button', { name: 'Gear only' })).toBeVisible()
  })

  test('no filters selected shows the full feed and no Clear control', async ({ page }) => {
    await page.goto('/hobbies')
    await expect(page.getByText('Roland TD-02KV', { exact: true })).toBeVisible()
    await expect(page.getByText('Hoka Clifton 10', { exact: true })).toBeVisible()
    await expect(page.getByText('Sony A6600', { exact: true })).toBeVisible()
    await expect(page.getByTestId('watch-card').first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Clear' })).toHaveCount(0)
  })

  test('selecting a hobby chip filters the grid to that hobby only', async ({ page }) => {
    await page.goto('/hobbies')
    await page.getByRole('button', { name: 'Music', exact: true }).click()

    await expect(page.getByText('Roland TD-02KV', { exact: true })).toBeVisible()
    await expect(page.getByText('Hoka Clifton 10', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Sony A6600', { exact: true })).toHaveCount(0)
    await expect(page.getByTestId('watch-card')).toHaveCount(0)
  })

  test('selecting two hobby chips shows the union of both (OR within the facet)', async ({
    page,
  }) => {
    await page.goto('/hobbies')
    await page.getByRole('button', { name: 'Music', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Music', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await page.getByRole('button', { name: 'Running', exact: true }).click()

    await expect(page.getByText('Roland TD-02KV', { exact: true })).toBeVisible()
    await expect(page.getByText('Hoka Clifton 10', { exact: true })).toBeVisible()
    await expect(page.getByText('Sony A6600', { exact: true })).toHaveCount(0)
  })

  test('gear-only toggle shows every gear item and hides watch items', async ({ page }) => {
    await page.goto('/hobbies')
    await page.getByRole('button', { name: 'Gear only' }).click()

    await expect(page.getByText('Roland TD-02KV', { exact: true })).toBeVisible()
    await expect(page.getByText('Hoka Clifton 10', { exact: true })).toBeVisible()
    await expect(page.getByText('Sony A6600', { exact: true })).toBeVisible()
    await expect(page.getByTestId('watch-card')).toHaveCount(0)
  })

  test('gear-only combined with a hobby chip intersects both facets (AND)', async ({ page }) => {
    await page.goto('/hobbies')
    await page.getByRole('button', { name: 'Gear only' }).click()
    await expect(page.getByRole('button', { name: 'Gear only' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await page.getByRole('button', { name: 'Photography', exact: true }).click()

    await expect(page.getByText('Sony A6600', { exact: true })).toBeVisible()
    await expect(page.getByText('Sony SEL50F18F 50mm f1.8', { exact: true })).toBeVisible()
    await expect(page.getByText('Hoka Clifton 10', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Roland TD-02KV', { exact: true })).toHaveCount(0)
  })

  test('Film shows only Film-tagged watch items, Series shows only Series-tagged ones', async ({
    page,
  }) => {
    await page.goto('/hobbies')

    const grid = page.getByTestId('hobby-feed')

    await page.getByRole('button', { name: 'Film', exact: true }).click()
    await expect(page.getByTestId('watch-card').first()).toBeVisible()
    await expect(grid.getByText('Series', { exact: true })).toHaveCount(0)

    await page.getByRole('button', { name: 'Film', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Film', exact: true })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
    await page.getByRole('button', { name: 'Series', exact: true }).click()
    await expect(page.getByTestId('watch-card').first()).toBeVisible()
    await expect(grid.getByText('Film', { exact: true })).toHaveCount(0)
  })

  test('a Clear control appears once filters are active and resets the view', async ({
    page,
  }) => {
    await page.goto('/hobbies')
    await page.getByRole('button', { name: 'Music', exact: true }).click()

    const clear = page.getByRole('button', { name: 'Clear' })
    await expect(clear).toBeVisible()
    await clear.click()

    await expect(page.getByRole('button', { name: 'Clear' })).toHaveCount(0)
    await expect(page.getByText('Hoka Clifton 10', { exact: true })).toBeVisible()
    await expect(page.getByTestId('watch-card').first()).toBeVisible()
  })

  test('filter state is reflected in the URL and restored on direct navigation', async ({
    page,
  }) => {
    await page.goto('/hobbies')
    await page.getByRole('button', { name: 'Running', exact: true }).click()
    await expect(page).toHaveURL(/hobby=running/)

    await page.reload()
    await expect(page.getByRole('button', { name: 'Running', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await expect(page.getByText('Hoka Clifton 10', { exact: true })).toBeVisible()
    await expect(page.getByText('Roland TD-02KV', { exact: true })).toHaveCount(0)
  })
})
