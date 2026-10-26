import { describe, expect, test } from 'bun:test'
import { gridErrors, gridSize, type GridSprite } from '@/game/grid-sprite'
import { PALETTE_ENTRIES, PALETTE_HEX, nearestSwatch, swatch } from '@/game/palette'
import { PROP_SIZES, type PropName } from '@/game/pixels'
import { GRID_PROPS } from '@/game/sprites/props'

describe('house palette', () => {
  test('has no colour twice', () => {
    expect(PALETTE_HEX.size).toBe(PALETTE_ENTRIES.length)
  })

  test('finds each palette colour as its own nearest swatch', () => {
    for (const { swatch: name, hex } of PALETTE_ENTRIES) {
      expect(nearestSwatch(hex)).toMatchObject({ swatch: name, distance: 0 })
    }
  })

  test('rejects swatches off the palette', () => {
    expect(swatch('walnut.2')).toBe('#6b4630')
    expect(() => swatch('walnut.9')).toThrow()
  })
})

describe('grid sprites', () => {
  test.each(Object.entries(GRID_PROPS) as [PropName, GridSprite][])('%s is sound and fills its prop box', (name, sprite) => {
    expect(gridErrors(sprite)).toEqual([])
    expect(gridSize(sprite)).toEqual(PROP_SIZES[name])
  })

  test('reports ragged rows and missing keys', () => {
    const errors = gridErrors({ keys: { a: 'ink.1' }, rows: ['aa', 'ab', 'a'] })
    expect(errors).toContain('row 1: no key for b')
    expect(errors).toContain('row 2 is 1 wide, not 2')
  })
})
