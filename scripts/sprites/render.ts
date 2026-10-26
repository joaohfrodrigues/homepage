/**
 * Renders the house's procedural art outside the browser, onto @napi-rs/canvas,
 * for the sprite tools in this folder (preview sheet, palette report, PNG export).
 */
import { createCanvas, type Canvas, type SKRSContext2D } from '@napi-rs/canvas'
import { drawProp, PROP_SIZES, type Ctx, type PropName } from '../../src/game/pixels'
import { GRID_PROPS } from '../../src/game/sprites/props'

export const PROP_NAMES = Object.keys(PROP_SIZES) as PropName[]

/** The napi context implements the same 2D API the house draws with. */
export const asCtx = (ctx: SKRSContext2D) => ctx as unknown as Ctx

/** How many looks a prop has: grid props with several grids pick one by where they stand. */
export function variantCount(name: PropName): number {
  const grid = GRID_PROPS[name]
  return Array.isArray(grid) ? grid.length : 1
}

export function renderProp(name: PropName, variant = 0): Canvas {
  const { w, h } = PROP_SIZES[name]
  const canvas = createCanvas(w, h)
  // drawProp picks a variant from the prop's y, so draw it that many heights down and shift back.
  const ctx = canvas.getContext('2d')
  ctx.translate(0, -variant * h)
  drawProp(asCtx(ctx), 0, variant * h, name)
  return canvas
}

export const toHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')

/**
 * Colour → pixel count for the fully opaque pixels of `canvas`. Translucent
 * pixels are shadows and glows laid over whatever is below, so they don't count.
 */
export function opaqueColours(canvas: Canvas): Map<string, number> {
  const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height)
  const counts = new Map<string, number>()
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] !== 255) continue
    const hex = toHex(data[i], data[i + 1], data[i + 2])
    counts.set(hex, (counts.get(hex) ?? 0) + 1)
  }
  return counts
}
