/**
 * Furniture sprites from LimeZu's Modern Interiors pack (limezu.itch.io),
 * packed by scripts/import_limezu.mjs. Unlike Kenney tiles they come in their
 * own sizes: each is drawn centred over its footprint, standing on the
 * footprint's bottom edge, and may rise above it.
 */
import SPRITES from './limezu-furniture.json'
import { TILE } from './layout'

export const LIMEZU_FURNITURE_URL = '/house/limezu-furniture.png'

export type LimezuSprite = keyof typeof SPRITES

/** A sprite's footprint in tiles, plus a nudge in pixels (wall-mounted things hang higher). */
export interface LimezuPlacement {
  sprite: LimezuSprite
  x: number
  y: number
  w: number
  h: number
  dx?: number
  dy?: number
}

/** Where a placed sprite draws, in world pixels. */
export function limezuRect({ sprite, x, y, w: tilesW, h: tilesH, dx = 0, dy = 0 }: LimezuPlacement) {
  const { w, h } = SPRITES[sprite]
  return { x: x * TILE + Math.floor((tilesW * TILE - w) / 2) + dx, y: (y + tilesH) * TILE - h + dy, w, h }
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
