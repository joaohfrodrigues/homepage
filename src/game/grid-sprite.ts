/**
 * Pixel art written as text: one character per pixel, each mapped to a
 * palette swatch. Easier to read, review and shade by hand than runs of
 * rectangles, and it round-trips through PNG for editing in LibreSprite or
 * Pixelorama (`bun run sprites:grid`, see scripts/sprites/).
 *
 *   .  transparent
 *   ,  the furniture drop shadow (translucent)
 *   any other character: looked up in `keys`
 */
import { SHADOW, swatch, type Swatch } from './palette'

export interface GridSprite {
  keys: Record<string, Swatch>
  rows: string[]
}

export const TRANSPARENT = '.'
export const SHADOW_KEY = ','

export function gridSize(sprite: GridSprite) {
  return { w: sprite.rows[0]?.length ?? 0, h: sprite.rows.length }
}

/** Ragged rows, unknown characters or swatches off the palette; empty when the sprite is sound. */
export function gridErrors(sprite: GridSprite): string[] {
  const errors: string[] = []
  const { w } = gridSize(sprite)
  for (const [key, name] of Object.entries(sprite.keys)) {
    if (key.length !== 1 || key === TRANSPARENT || key === SHADOW_KEY) errors.push(`bad key ${JSON.stringify(key)}`)
    try {
      swatch(name)
    } catch {
      errors.push(`key ${key}: ${name} is not on the palette`)
    }
  }
  sprite.rows.forEach((row, y) => {
    if (row.length !== w) errors.push(`row ${y} is ${row.length} wide, not ${w}`)
    for (const ch of row) {
      if (ch !== TRANSPARENT && ch !== SHADOW_KEY && !(ch in sprite.keys)) errors.push(`row ${y}: no key for ${ch}`)
    }
  })
  return errors
}

export function drawGrid(ctx: CanvasRenderingContext2D, sprite: GridSprite, ox: number, oy: number) {
  const colours: Record<string, string> = { [SHADOW_KEY]: SHADOW }
  for (const [key, name] of Object.entries(sprite.keys)) colours[key] = swatch(name)
  sprite.rows.forEach((row, y) => {
    // One fillRect per run of the same character, not per pixel.
    let x = 0
    while (x < row.length) {
      const ch = row[x]
      let end = x + 1
      while (end < row.length && row[end] === ch) end++
      if (ch !== TRANSPARENT) {
        ctx.fillStyle = colours[ch]
        ctx.fillRect(ox + x, oy + y, end - x, 1)
      }
      x = end
    }
  })
}
