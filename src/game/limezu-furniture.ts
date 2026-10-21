/**
 * Furniture sprites from LimeZu's Modern Interiors pack (limezu.itch.io),
 * packed by scripts/import_limezu.mjs. Unlike Kenney tiles they come in their
 * own sizes: each stands bottom-centred on one tile and may rise above it.
 */
import SPRITES from './limezu-furniture.json'
import { TILE } from './layout'

export const LIMEZU_FURNITURE_URL = '/house/limezu-furniture.png'

export type LimezuSprite = keyof typeof SPRITES

/** Where a sprite standing on tile (x, y) draws, in world pixels. */
export function limezuRect(name: LimezuSprite, x: number, y: number) {
  const { w, h } = SPRITES[name]
  return { x: x * TILE + Math.floor((TILE - w) / 2), y: (y + 1) * TILE - h, w, h }
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
