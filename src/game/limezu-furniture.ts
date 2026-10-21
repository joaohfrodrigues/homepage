/**
 * Furniture sprites from LimeZu's Modern Interiors pack (limezu.itch.io),
 * packed by scripts/import_limezu.mjs. They come in their own sizes: each is
 * centred over an area of tiles (one tile unless given), and one taller than
 * its area stands on the area's bottom edge and rises above it.
 */
import SPRITES from './limezu-furniture.json'
import { TILE } from './layout'

export const LIMEZU_FURNITURE_URL = '/house/limezu-furniture.png'

export type LimezuSprite = keyof typeof SPRITES

/** Where a sprite over the area of `areaW` x `areaH` tiles from (x, y) draws, in world pixels. */
export function limezuRect(name: LimezuSprite, x: number, y: number, areaW = 1, areaH = 1) {
  const { w, h } = SPRITES[name]
  const spare = Math.max(0, areaH * TILE - h)
  return { x: x * TILE + Math.floor((areaW * TILE - w) / 2), y: (y + areaH) * TILE - h - Math.floor(spare / 2), w, h }
}

export function drawLimezu(
  ctx: CanvasRenderingContext2D,
  atlas: CanvasImageSource,
  name: LimezuSprite,
  dx: number,
  dy: number,
) {
  const { x, y, w, h } = SPRITES[name]
  ctx.drawImage(atlas, x, y, w, h, dx, dy, w, h)
}
