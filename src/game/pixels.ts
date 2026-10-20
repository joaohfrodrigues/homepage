/**
 * Procedurally drawn pixel art for everything the Kenney furniture sheet
 * doesn't cover: floors, wall faces, doors, the house's own props and the
 * characters. Everything draws onto plain canvases so it can be baked into
 * Phaser textures (and unit-tested without a WebGL context).
 */
import type { FloorKind, WallKind } from './layout'

export type Ctx = CanvasRenderingContext2D

export const PALETTE = {
  ink: '#2a2233',
  shadow: 'rgba(20, 14, 30, 0.28)',
  woodDark: '#6b4a2e',
  wood: '#8f5e37',
  woodLight: '#b07a4a',
  woodHighlight: '#c58d5a',
  brass: '#c9a227',
  brassLight: '#e8c95a',
  red: '#c0392b',
  redDark: '#8e2a20',
  paper: '#f4ecd8',
  tape: '#e8c33a',
}

export function rect(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color
  ctx.fillRect(x, y, w, h)
}

/** Cheap deterministic hash so tile variation is stable across reloads. */
export function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0
  h = (h ^ (h >>> 13)) * 1274126177
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

// ---------------------------------------------------------------------------
// Floors

export function drawFloor(ctx: Ctx, ox: number, oy: number, kind: FloorKind, tx: number, ty: number) {
  switch (kind) {
    case 'wood': {
      // Four horizontal planks per tile with staggered seams.
      rect(ctx, ox, oy, 16, 16, '#b4804f')
      for (let row = 0; row < 4; row++) {
        const y = oy + row * 4
        const shade = hash(tx * 4 + row, ty) > 0.5 ? '#ad7a4a' : '#b98653'
        rect(ctx, ox, y, 16, 3, shade)
        rect(ctx, ox, y + 3, 16, 1, '#8f5e37')
        const seam = Math.floor(hash(tx, ty * 4 + row) * 16)
        rect(ctx, ox + seam, y, 1, 3, '#8f5e37')
        if (hash(tx + 7, ty * 4 + row) > 0.7) rect(ctx, ox + ((seam + 6) % 14), y + 1, 2, 1, '#c99662')
      }
      break
    }
    case 'checker': {
      for (let qy = 0; qy < 2; qy++) {
        for (let qx = 0; qx < 2; qx++) {
          const light = (qx + qy + tx + ty) % 2 === 0
          rect(ctx, ox + qx * 8, oy + qy * 8, 8, 8, light ? '#ece4d2' : '#9e8f80')
        }
      }
      rect(ctx, ox, oy + 15, 16, 1, 'rgba(0,0,0,0.08)')
      rect(ctx, ox + 15, oy, 1, 16, 'rgba(0,0,0,0.08)')
      break
    }
    case 'parquet': {
      // Basket weave: 8x8 blocks alternating plank direction.
      for (let qy = 0; qy < 2; qy++) {
        for (let qx = 0; qx < 2; qx++) {
          const bx = ox + qx * 8
          const by = oy + qy * 8
          const horizontal = (qx + qy) % 2 === 0
          rect(ctx, bx, by, 8, 8, '#c4955e')
          for (let i = 0; i < 4; i++) {
            const c = i % 2 === 0 ? '#c4955e' : '#b5854f'
            if (horizontal) rect(ctx, bx, by + i * 2, 8, 2, c)
            else rect(ctx, bx + i * 2, by, 2, 8, c)
          }
          rect(ctx, bx + 7, by, 1, 8, '#9b6d3e')
          rect(ctx, bx, by + 7, 8, 1, '#9b6d3e')
        }
      }
      break
    }
  }
}

// ---------------------------------------------------------------------------
// Walls

const WALLPAPER: Record<WallKind, { base: string; accent: string; board: string }> = {
  cream: { base: '#efe3c8', accent: '#e3d4b2', board: '#8f5e37' },
  rose: { base: '#e7bfb4', accent: '#d9a99d', board: '#7a4b3a' },
  library: { base: '#3f5a4a', accent: '#37503f', board: '#5a3d27' },
}

export function drawWallCap(ctx: Ctx, ox: number, oy: number) {
  rect(ctx, ox, oy, 16, 16, '#4b4060')
  rect(ctx, ox + 1, oy + 1, 14, 14, '#574b6e')
  rect(ctx, ox + 2, oy + 2, 4, 1, '#625679')
}

function drawWallpaper(ctx: Ctx, ox: number, oy: number, kind: WallKind, part: 'upper' | 'lower') {
  const paper = WALLPAPER[kind]
  rect(ctx, ox, oy, 16, 16, paper.base)
  // Pinstripes and wood wainscoting for the study, a small diamond pattern for
  // rose, a dado line for cream.
  if (kind === 'library') {
    for (let x = 1; x < 16; x += 4) rect(ctx, ox + x, oy, 1, 16, paper.accent)
    if (part === 'lower') {
      rect(ctx, ox, oy + 5, 16, 7, '#6b4a2e')
      rect(ctx, ox, oy + 5, 16, 1, '#8f5e37')
      rect(ctx, ox + 7, oy + 6, 1, 6, '#5a3d27')
    }
  } else if (kind === 'rose') {
    for (let y = part === 'upper' ? 6 : 2; y < 14; y += 6) {
      rect(ctx, ox + 3, oy + y, 1, 1, paper.accent)
      rect(ctx, ox + 11, oy + y + 3, 1, 1, paper.accent)
    }
  } else if (kind === 'cream') {
    rect(ctx, ox, oy + (part === 'upper' ? 12 : 4), 16, 1, paper.accent)
  }
}

export function drawWallFace(ctx: Ctx, ox: number, oy: number, kind: WallKind, part: 'upper' | 'lower') {
  drawWallpaper(ctx, ox, oy, kind, part)
  const paper = WALLPAPER[kind]
  if (part === 'upper') {
    // Wall top seen edge-on.
    rect(ctx, ox, oy, 16, 3, '#574b6e')
    rect(ctx, ox, oy + 3, 16, 1, '#3b3150')
  } else {
    rect(ctx, ox, oy + 12, 16, 4, paper.board)
    rect(ctx, ox, oy + 12, 16, 1, 'rgba(255,255,255,0.18)')
    rect(ctx, ox, oy + 15, 16, 1, 'rgba(0,0,0,0.25)')
  }
}

/** An open doorway: the room's floor runs through, framed by wooden posts. */
export function drawDoorway(
  ctx: Ctx,
  ox: number,
  oy: number,
  floor: FloorKind,
  part: 'upper' | 'lower',
  tx: number,
  ty: number,
  edges: { left: boolean; right: boolean },
) {
  drawFloor(ctx, ox, oy, floor, tx, ty)
  // Darken the floor as it passes under the lintel.
  rect(ctx, ox, oy, 16, 16, part === 'upper' ? 'rgba(20,14,30,0.35)' : 'rgba(20,14,30,0.12)')
  if (part === 'upper') {
    rect(ctx, ox, oy, 16, 3, PALETTE.woodDark)
    rect(ctx, ox, oy + 3, 16, 1, PALETTE.ink)
  }
  if (edges.left) rect(ctx, ox, oy, 2, 16, PALETTE.woodDark)
  if (edges.right) rect(ctx, ox + 14, oy, 2, 16, PALETTE.woodDark)
}

export function drawFrontDoor(ctx: Ctx, ox: number, oy: number) {
  drawWallCap(ctx, ox, oy)
  rect(ctx, ox + 1, oy, 14, 12, PALETTE.woodDark)
  rect(ctx, ox + 2, oy, 12, 10, '#a0522d')
  rect(ctx, ox + 2, oy + 4, 12, 1, '#7a3d21')
  rect(ctx, ox + 11, oy + 5, 2, 2, PALETTE.brassLight)
  rect(ctx, ox, oy + 12, 16, 4, '#3b3150')
}

// ---------------------------------------------------------------------------
// Props that aren't in the Kenney sheet

export type PropName =
  | 'letterbox'
  | 'signboard'
  | 'doormat'
  | 'bookshelf'
  | 'fireplace'
  | 'desk'
  | 'serverrack'
  | 'maptable'
  | 'rug'
  | 'rugteal'
  | 'armchair'
  | 'floorlamp'
  | 'camerastand'
  | 'tv'
  | 'sofa'
  | 'drums'
  | 'medalboard'
  | 'shoerack'
  | 'coathooks'
  | 'boots'

export const PROP_SIZES: Record<PropName, { w: number; h: number }> = {
  letterbox: { w: 16, h: 16 },
  signboard: { w: 16, h: 32 },
  doormat: { w: 16, h: 16 },
  bookshelf: { w: 16, h: 32 },
  fireplace: { w: 32, h: 48 },
  desk: { w: 32, h: 32 },
  serverrack: { w: 16, h: 32 },
  maptable: { w: 64, h: 48 },
  rug: { w: 96, h: 80 },
  rugteal: { w: 96, h: 64 },
  armchair: { w: 16, h: 16 },
  floorlamp: { w: 16, h: 32 },
  camerastand: { w: 16, h: 32 },
  tv: { w: 32, h: 32 },
  sofa: { w: 48, h: 16 },
  drums: { w: 32, h: 32 },
  medalboard: { w: 32, h: 32 },
  shoerack: { w: 32, h: 16 },
  coathooks: { w: 32, h: 32 },
  boots: { w: 16, h: 16 },
}

/** Where the scene paints the trip map onto the map table, in prop pixels. */
export const MAP_TABLE = { x: 6, y: 6, w: 52, h: 30 }
/** The firebox opening the scene animates flames in. */
export const FIREPLACE_FIRE = { x: 8, y: 33, w: 16, h: 10 }
/** Status LEDs on the server rack, blinked by the scene. */
export const SERVER_LEDS = [3, 9, 15, 21].map((y) => ({ x: 11, y: y + 1 }))
/** Where light comes from, for the scene's warm glows. */
export const LIGHT_SOURCES: Partial<Record<PropName, { x: number; y: number; radius: number }>> = {
  fireplace: { x: 16, y: 38, radius: 40 },
  floorlamp: { x: 8, y: 5, radius: 30 },
  tv: { x: 16, y: 10, radius: 22 },
}

const BOOK_COLORS = ['#8e2f35', '#2f5f63', '#c9a227', '#3f6b8a', '#6b4a2e', '#4f7a3a', '#d9a99d', '#2a2233']

function disc(ctx: Ctx, cx: number, cy: number, r: number, color: string) {
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.round(Math.sqrt(r * r - dy * dy))
    rect(ctx, cx - half, cy + dy, half * 2, 1, color)
  }
}

function drawRug(ctx: Ctx, ox: number, oy: number, w: number, h: number, c: { edge: string; field: string; trim: string }) {
  rect(ctx, ox + 2, oy, w - 4, h, c.edge)
  rect(ctx, ox + 3, oy + 1, w - 6, h - 2, c.field)
  rect(ctx, ox + 7, oy + 5, w - 14, h - 10, c.trim)
  rect(ctx, ox + 8, oy + 6, w - 16, h - 12, c.field)
  // A diamond medallion in the middle and tassels on the short ends.
  const cx = ox + w / 2
  const cy = oy + h / 2
  for (let i = 0; i < 9; i++) {
    rect(ctx, cx - i, cy - 9 + i, i * 2, 1, c.trim)
    rect(ctx, cx - i, cy + 8 - i, i * 2, 1, c.trim)
  }
  rect(ctx, cx - 3, cy - 1, 6, 2, c.edge)
  for (let y = oy + 3; y < oy + h - 3; y += 3) {
    rect(ctx, ox, y, 2, 1, c.trim)
    rect(ctx, ox + w - 2, y, 2, 1, c.trim)
  }
}

export function drawProp(ctx: Ctx, ox: number, oy: number, name: PropName) {
  const r = (x: number, y: number, w: number, h: number, color: string) => rect(ctx, ox + x, oy + y, w, h, color)
  switch (name) {
    case 'letterbox': {
      r(7, 9, 2, 7, PALETTE.woodDark)
      r(2, 2, 12, 9, PALETTE.ink)
      r(3, 3, 10, 7, PALETTE.red)
      r(3, 3, 10, 1, '#e05a48')
      r(5, 5, 6, 1, PALETTE.ink)
      r(5, 7, 6, 2, PALETTE.paper)
      r(6, 8, 4, 1, '#b5aa94')
      r(13, 4, 1, 3, PALETTE.brassLight)
      break
    }
    case 'signboard': {
      r(3, 14, 2, 18, PALETTE.woodDark)
      r(11, 14, 2, 18, PALETTE.woodDark)
      r(0, 1, 16, 18, PALETTE.ink)
      r(1, 2, 14, 16, PALETTE.wood)
      r(2, 3, 12, 14, PALETTE.paper)
      // Roof-shaped header and a list of "rooms".
      r(4, 4, 8, 2, PALETTE.red)
      r(6, 3, 4, 1, PALETTE.red)
      for (let i = 0; i < 4; i++) {
        r(3, 8 + i * 2, 1, 1, PALETTE.wood)
        r(5, 8 + i * 2, 4 + ((i * 3) % 5), 1, '#6d6359')
      }
      break
    }
    case 'doormat': {
      r(1, 3, 14, 11, '#5a3d27')
      r(2, 4, 12, 9, '#8a6a3f')
      for (let y = 5; y < 12; y += 2) r(3, y, 10, 1, '#7a5c35')
      break
    }
    case 'bookshelf': {
      r(0, 0, 16, 32, PALETTE.ink)
      r(1, 1, 14, 30, PALETTE.woodDark)
      r(2, 2, 12, 24, '#3d2a1d')
      for (let shelf = 0; shelf < 3; shelf++) {
        const base = 2 + shelf * 8
        let x = 2
        let i = shelf * 5 + Math.floor(ox / 16)
        while (x < 14) {
          const w = 1 + (i % 2)
          const h = 4 + ((i * 7) % 3)
          r(x, base + 6 - h, Math.min(w, 14 - x), h, BOOK_COLORS[i % BOOK_COLORS.length])
          x += w + (i % 4 === 3 ? 1 : 0)
          i++
        }
        r(2, base + 6, 12, 2, PALETTE.wood)
      }
      r(2, 26, 12, 4, PALETTE.wood)
      r(7, 27, 2, 1, PALETTE.brass)
      break
    }
    case 'fireplace': {
      // Stone chimney breast on the wall, firebox and hearth on the floor.
      r(2, 0, 28, 32, '#7d7383')
      for (let y = 0; y < 30; y += 4) {
        r(2, y + 3, 28, 1, '#625a69')
        for (let x = (y / 4) % 2 === 0 ? 6 : 10; x < 30; x += 8) r(x, y, 1, 3, '#625a69')
      }
      r(0, 24, 32, 4, PALETTE.woodDark)
      r(0, 24, 32, 1, PALETTE.woodHighlight)
      r(9, 19, 4, 5, PALETTE.brass)
      r(20, 20, 3, 4, PALETTE.paper)
      r(2, 28, 28, 16, '#8a8090')
      r(6, 31, 20, 13, PALETTE.ink)
      r(7, 32, 18, 12, '#1c1416')
      r(9, 41, 14, 2, PALETTE.woodDark)
      r(11, 40, 10, 1, '#5a3d27')
      r(0, 44, 32, 4, '#5f5766')
      r(0, 44, 32, 1, '#7d7383')
      break
    }
    case 'desk': {
      // Monitor against the wall, desk top on the floor row.
      r(6, 1, 18, 13, PALETTE.ink)
      r(7, 2, 16, 10, '#1f3b4d')
      for (let i = 0; i < 4; i++) r(9, 4 + i * 2, 3 + ((i * 5) % 9), 1, i % 2 ? '#7fd1b9' : '#e8c95a')
      r(13, 14, 4, 3, PALETTE.ink)
      r(0, 16, 32, 4, PALETTE.wood)
      r(0, 16, 32, 1, PALETTE.woodHighlight)
      r(8, 17, 12, 2, '#d8d0c0')
      r(24, 14, 4, 4, PALETTE.red)
      r(25, 15, 2, 1, '#e05a48')
      r(0, 20, 32, 9, PALETTE.woodDark)
      r(2, 22, 10, 5, '#7d5634')
      r(6, 24, 2, 1, PALETTE.brass)
      r(1, 29, 3, 3, PALETTE.woodDark)
      r(28, 29, 3, 3, PALETTE.woodDark)
      break
    }
    case 'serverrack': {
      r(1, 0, 14, 31, PALETTE.ink)
      r(2, 1, 12, 29, '#3b3f4a')
      for (const led of SERVER_LEDS) {
        r(3, led.y - 1, 10, 4, '#2a2d35')
        r(4, led.y, 5, 1, '#4a4f5c')
        r(led.x, led.y, 1, 1, '#4cd964')
      }
      // The Raspberry Pi itself, on the bottom shelf.
      r(3, 26, 9, 3, '#2e8b57')
      r(4, 27, 2, 1, '#c9a227')
      r(1, 31, 14, 1, PALETTE.shadow)
      break
    }
    case 'maptable': {
      r(0, 1, 64, 41, PALETTE.ink)
      r(1, 2, 62, 38, PALETTE.woodDark)
      r(3, 4, 58, 34, PALETTE.wood)
      r(3, 4, 58, 1, PALETTE.woodHighlight)
      r(MAP_TABLE.x - 1, MAP_TABLE.y - 1, MAP_TABLE.w + 2, MAP_TABLE.h + 2, '#d8c8a0')
      r(1, 40, 62, 3, '#4f3622')
      r(3, 43, 3, 5, PALETTE.woodDark)
      r(58, 43, 3, 5, PALETTE.woodDark)
      break
    }
    case 'rug':
      drawRug(ctx, ox, oy, 96, 80, { edge: '#5c1f24', field: '#8e2f35', trim: '#c9a227' })
      break
    case 'rugteal':
      drawRug(ctx, ox, oy, 96, 64, { edge: '#24484b', field: '#2f5f63', trim: '#e8c95a' })
      break
    case 'armchair': {
      // Seen from behind, facing up into the room.
      r(1, 2, 14, 14, PALETTE.ink)
      r(2, 3, 12, 8, '#8e2f35')
      r(2, 3, 12, 1, '#b04a50')
      r(2, 9, 3, 6, '#7a2730')
      r(11, 9, 3, 6, '#7a2730')
      r(5, 11, 6, 4, '#a63a40')
      r(2, 15, 2, 1, PALETTE.woodDark)
      r(12, 15, 2, 1, PALETTE.woodDark)
      break
    }
    case 'floorlamp': {
      r(4, 1, 8, 1, PALETTE.ink)
      r(3, 2, 10, 6, PALETTE.ink)
      r(4, 2, 8, 5, '#f0d9a0')
      r(4, 2, 8, 1, '#fff1c8')
      r(7, 8, 2, 20, '#3a3340')
      r(4, 28, 8, 3, '#3a3340')
      r(3, 31, 10, 1, PALETTE.shadow)
      break
    }
    case 'camerastand': {
      // Tripod legs...
      for (let i = 0; i < 14; i++) {
        r(7 - Math.floor(i / 3), 17 + i, 1, 1, '#3a3340')
        r(8 + Math.floor(i / 3), 17 + i, 1, 1, '#3a3340')
      }
      r(7, 15, 2, 14, '#4a4458')
      // ...and the camera on top, lens towards the room.
      r(2, 7, 12, 9, PALETTE.ink)
      r(3, 8, 10, 7, '#1b1b20')
      r(3, 8, 3, 2, '#3a3a44')
      disc(ctx, ox + 8, oy + 11, 3, '#3a3a44')
      disc(ctx, ox + 8, oy + 11, 2, '#14141a')
      r(9, 10, 1, 1, '#8fb5d6')
      r(10, 6, 3, 2, '#2a2a30')
      break
    }
    case 'tv': {
      r(2, 1, 28, 18, PALETTE.ink)
      r(4, 3, 24, 14, '#26323f')
      r(5, 4, 6, 2, '#3b4b5c')
      r(4, 12, 24, 5, '#1d2731')
      r(14, 19, 4, 2, PALETTE.ink)
      r(0, 20, 32, 11, PALETTE.woodDark)
      r(0, 20, 32, 1, PALETTE.woodHighlight)
      r(2, 23, 13, 6, '#7d5634')
      r(17, 23, 13, 6, '#7d5634')
      r(20, 25, 7, 2, '#1b1b20')
      r(25, 25, 1, 1, '#4cd964')
      r(0, 31, 32, 1, PALETTE.shadow)
      break
    }
    case 'sofa': {
      // Back view, facing the TV.
      r(0, 1, 48, 15, PALETTE.ink)
      r(1, 2, 46, 8, '#3f6b8a')
      r(1, 2, 46, 1, '#5a88a8')
      r(16, 3, 1, 7, '#355a75')
      r(31, 3, 1, 7, '#355a75')
      r(1, 8, 5, 7, '#355a75')
      r(42, 8, 5, 7, '#355a75')
      r(6, 10, 36, 5, '#4b7da0')
      r(8, 9, 6, 3, PALETTE.tape)
      break
    }
    case 'drums': {
      // Electronic kit from above: pads on a rack, cymbals, kick and throne.
      r(4, 6, 24, 2, '#3a3340')
      r(4, 6, 2, 16, '#3a3340')
      r(26, 6, 2, 16, '#3a3340')
      disc(ctx, ox + 5, oy + 7, 4, '#c9a227')
      disc(ctx, ox + 5, oy + 7, 1, '#8a6d1d')
      disc(ctx, ox + 27, oy + 5, 4, '#c9a227')
      disc(ctx, ox + 27, oy + 16, 4, '#d8b440')
      for (const [cx, cy, rad] of [
        [12, 9, 3],
        [20, 9, 3],
        [9, 16, 4],
        [23, 17, 3],
      ] as const) {
        disc(ctx, ox + cx, oy + cy, rad, PALETTE.ink)
        disc(ctx, ox + cx, oy + cy, rad - 1, '#55555f')
      }
      r(12, 15, 8, 9, PALETTE.ink)
      r(13, 16, 6, 7, '#2f3a8f')
      r(14, 17, 4, 1, '#e8e8f0')
      disc(ctx, ox + 16, oy + 28, 3, PALETTE.ink)
      disc(ctx, ox + 16, oy + 28, 2, '#8e2f35')
      break
    }
    case 'medalboard': {
      r(1, 5, 30, 20, PALETTE.woodDark)
      r(2, 6, 28, 18, '#b5835a')
      // Two race bibs...
      r(3, 8, 10, 8, PALETTE.paper)
      r(4, 9, 8, 1, PALETTE.red)
      r(5, 11, 6, 3, PALETTE.ink)
      r(14, 7, 9, 8, PALETTE.paper)
      r(15, 8, 7, 1, '#3f6b8a')
      r(16, 10, 5, 3, PALETTE.ink)
      // ...and medals hanging off the frame.
      for (const [x, ribbon] of [
        [24, '#3f6b8a'],
        [28, PALETTE.red],
      ] as const) {
        r(x, 6, 2, 12, ribbon)
        disc(ctx, ox + x + 1, oy + 20, 2, PALETTE.brass)
        r(x + 1, 19, 1, 1, PALETTE.brassLight)
      }
      r(5, 18, 14, 1, '#7a5c35')
      r(5, 21, 10, 1, '#7a5c35')
      break
    }
    case 'shoerack': {
      r(1, 7, 30, 8, PALETTE.ink)
      r(2, 8, 28, 6, PALETTE.wood)
      r(2, 11, 28, 1, PALETTE.woodDark)
      // Running shoes on top, a spare pair below.
      for (const x of [4, 10]) {
        r(x, 3, 5, 5, PALETTE.ink)
        r(x + 1, 4, 3, 3, '#3b7dd8')
        r(x + 1, 6, 3, 1, PALETTE.paper)
      }
      for (const x of [18, 24]) {
        r(x, 9, 5, 2, '#6d6359')
        r(x, 11, 5, 1, PALETTE.paper)
      }
      r(1, 15, 30, 1, PALETTE.shadow)
      break
    }
    case 'coathooks': {
      r(2, 5, 28, 3, PALETTE.woodDark)
      for (const x of [6, 14, 22]) r(x, 7, 2, 2, PALETTE.brass)
      // A hiking backpack and a red rain jacket.
      r(3, 9, 11, 17, PALETTE.ink)
      r(4, 10, 9, 15, '#4f7a3a')
      r(4, 10, 9, 2, '#62924a')
      r(5, 17, 7, 6, '#3b5c2b')
      r(6, 19, 5, 1, PALETTE.tape)
      r(17, 9, 11, 19, PALETTE.ink)
      r(18, 10, 9, 17, PALETTE.red)
      r(22, 10, 1, 17, PALETTE.redDark)
      r(18, 10, 9, 2, '#e05a48')
      break
    }
    case 'boots': {
      for (const x of [2, 9]) {
        r(x, 4, 5, 10, PALETTE.ink)
        r(x + 1, 5, 3, 8, '#6b4a2e')
        r(x + 1, 6, 3, 1, '#b5835a')
        r(x, 13, 6, 2, '#2b2b33')
      }
      r(1, 15, 14, 1, PALETTE.shadow)
      break
    }
  }
}

// ---------------------------------------------------------------------------
// Characters

export type Facing = 'down' | 'up' | 'side'
export type Step = 'idle' | 'a' | 'b'
export type CharacterName = 'joao' | 'guest'

// k outline · s skin · S skin shade · e eye · h hair · f facial hair
// c cap · C cap brim · j jacket · J jacket hem · t shirt · m camera
// p trousers · b shoes
const BODY: Record<Facing, string[]> = {
  down: [
    '................',
    '.....kkkkkk.....',
    '....kcccccck....',
    '...kcccccccck...',
    '...kCCCCCCCCk...',
    '...khsssssshk...',
    '...khsesseshk...',
    '...khssSSsshk...',
    '...kffssssffk...',
    '....kffffffk....',
    '...kjjjttjjjk...',
    '..kjjjjmmmjjjk..',
    '..ksjjjmmmjjsk..',
    '...kJJJJJJJJk...',
  ],
  up: [
    '................',
    '.....kkkkkk.....',
    '....kcccccck....',
    '...kcccccccck...',
    '...kCccccccCk...',
    '...khhhhhhhhk...',
    '...khhhhhhhhk...',
    '...kshhhhhhsk...',
    '....khhhhhhk....',
    '....kSSSSSSk....',
    '...kjjjjjjjjk...',
    '..kjjjjjjjjjjk..',
    '..ksjjjjjjjjsk..',
    '...kJJJJJJJJk...',
  ],
  side: [
    '................',
    '.....kkkkk......',
    '....kccccck.....',
    '....kcccccck....',
    '....kcccCCCCCk..',
    '....khhsssssk...',
    '....khhssesk....',
    '....khssssssk...',
    '....khhfffffk...',
    '.....kfffffk....',
    '....kjjjjjjk....',
    '....kjjjjmmk....',
    '....kjjsjjjk....',
    '....kJJJJJJk....',
  ],
}

const LEGS: Record<Facing, Record<Step, string[]>> = {
  down: {
    idle: ['....kppkkppk....', '....kbbkkbbk....'],
    a: ['....kbbkkppk....', '........kbbk....'],
    b: ['....kppkkbbk....', '....kbbk........'],
  },
  up: {
    idle: ['....kppkkppk....', '....kbbkkbbk....'],
    a: ['....kbbkkppk....', '........kbbk....'],
    b: ['....kppkkbbk....', '....kbbk........'],
  },
  side: {
    idle: ['.....kppk.......', '.....kbbbk......'],
    a: ['....kpk.kpk.....', '...kbbk.kbbk....'],
    b: ['.....kppk.......', '......kbbbk.....'],
  },
}

const CHARACTER_COLORS: Record<CharacterName, Record<string, string>> = {
  // Grey cap, dark beard, navy jacket over a teal shirt, camera on a strap —
  // as close to the About photo as 16 pixels allow.
  joao: {
    k: '#1d1a22', s: '#f0c8a0', S: '#d9a57c', e: '#1d1a22', h: '#3a2a20', f: '#3a2a20',
    c: '#a3a8ae', C: '#7a7f86', j: '#2c3c5a', J: '#1f2b42', t: '#2f8f83', m: '#121216',
    p: '#3a3a44', b: '#24242a',
  },
  guest: {
    k: '#1d1a22', s: '#e8b98f', S: '#cf9c72', e: '#1d1a22', h: '#7a4a28', f: '#e8b98f',
    c: '#c0392b', C: '#8e2a20', j: '#4f7a3a', J: '#3b5c2b', t: '#f4ecd8', m: '#4f7a3a',
    p: '#4a4e69', b: '#2b2b33',
  },
}

export const FACINGS: Facing[] = ['down', 'up', 'side']
export const STEPS: Step[] = ['idle', 'a', 'b']

export function drawCharacter(
  ctx: Ctx,
  ox: number,
  oy: number,
  who: CharacterName,
  facing: Facing,
  step: Step,
) {
  const colors = CHARACTER_COLORS[who]
  // Bob the body down a pixel mid-stride.
  const bob = step === 'idle' ? 0 : 1
  const rows = [...BODY[facing], ...LEGS[facing][step]]
  // Soft shadow under the feet.
  rect(ctx, ox + 4, oy + 15, 8, 1, PALETTE.shadow)
  rows.forEach((row, y) => {
    const dy = y < BODY[facing].length ? bob : 0
    for (let x = 0; x < row.length; x++) {
      const color = colors[row[x]]
      if (color) rect(ctx, ox + x, oy + y + dy, 1, 1, color)
    }
  })
}
