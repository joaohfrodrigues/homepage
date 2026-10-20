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
    case 'tile': {
      // 25cm ceramic floor tiles with light grout.
      for (let qy = 0; qy < 2; qy++) {
        for (let qx = 0; qx < 2; qx++) {
          const shade = hash(tx * 2 + qx, ty * 2 + qy) > 0.5 ? '#d9d4ca' : '#d2ccc1'
          rect(ctx, ox + qx * 8, oy + qy * 8, 8, 8, shade)
          rect(ctx, ox + qx * 8 + 7, oy + qy * 8, 1, 8, '#b9b2a6')
          rect(ctx, ox + qx * 8, oy + qy * 8 + 7, 8, 1, '#b9b2a6')
        }
      }
      break
    }
    case 'bath': {
      rect(ctx, ox, oy, 16, 16, '#eef2f4')
      for (let i = 3; i < 16; i += 4) {
        rect(ctx, ox + i, oy, 1, 16, '#d3dde3')
        rect(ctx, ox, oy + i, 16, 1, '#d3dde3')
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
  sage: { base: '#c9d6c3', accent: '#bccab5', board: '#8f5e37' },
  bath: { base: '#e3eef2', accent: '#c9dbe3', board: '#9fc3d6' },
  tile: { base: '#f2f2ee', accent: '#dcdcd4', board: '#8a8090' },
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
  } else if (kind === 'bath' || kind === 'tile') {
    // Wall tiles: a square grid for the bathroom, staggered metro tiles in the kitchen.
    for (let y = 3; y < 16; y += 4) rect(ctx, ox, oy + y, 16, 1, paper.accent)
    for (let row = 0; row < 4; row++) {
      const offset = kind === 'tile' && row % 2 ? 4 : 0
      for (let x = offset + 3; x < 16; x += kind === 'tile' ? 8 : 4) rect(ctx, ox + x, oy + row * 4, 1, 3, paper.accent)
    }
  } else if (kind === 'sage') {
    for (let x = 2; x < 16; x += 6) rect(ctx, ox + x, oy, 1, 16, paper.accent)
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

/**
 * A shut interior door seen from the corridor, two tiles wide. The left half
 * carries a little red "occupied" indicator over the handle.
 */
export function drawClosedDoor(
  ctx: Ctx,
  ox: number,
  oy: number,
  kind: WallKind,
  part: 'upper' | 'lower',
  half: 'left' | 'right',
) {
  drawWallFace(ctx, ox, oy, kind, part)
  const left = half === 'left'
  const top = part === 'upper' ? 4 : 0
  rect(ctx, ox + (left ? 1 : 0), oy + top, left ? 15 : 15, 16 - top, PALETTE.woodDark)
  rect(ctx, ox + (left ? 2 : 0), oy + top + (part === 'upper' ? 1 : 0), 14, 16 - top - (part === 'upper' ? 1 : 0), '#efe3c8')
  if (!left) rect(ctx, ox + 14, oy + top, 1, 16 - top, PALETTE.woodDark)
  if (part === 'upper') {
    rect(ctx, ox + (left ? 4 : 2), oy + 7, 10, 6, '#e3d4b2')
    if (left) {
      // The occupied indicator.
      rect(ctx, ox + 11, oy + 13, 5, 3, PALETTE.ink)
      rect(ctx, ox + 12, oy + 14, 3, 1, PALETTE.red)
    }
  } else {
    rect(ctx, ox + (left ? 4 : 2), oy + 1, 10, 8, '#e3d4b2')
    if (left) rect(ctx, ox + 12, oy + 1, 3, 2, PALETTE.brass)
    rect(ctx, ox, oy + 13, 16, 3, '#2f2a3a')
  }
}

/** One half of the 90cm front door (two tiles wide), seen from above. */
export function drawFrontDoor(ctx: Ctx, ox: number, oy: number, half: 'left' | 'right') {
  drawWallCap(ctx, ox, oy)
  const left = half === 'left'
  rect(ctx, ox + (left ? 1 : 0), oy, 15, 12, PALETTE.woodDark)
  rect(ctx, ox + (left ? 2 : 0), oy, 14, 10, '#a0522d')
  rect(ctx, ox + (left ? 2 : 0), oy + 4, 14, 1, '#7a3d21')
  if (!left) {
    rect(ctx, ox + 14, oy, 1, 12, PALETTE.woodDark)
    rect(ctx, ox + 9, oy + 5, 2, 2, PALETTE.brassLight)
  }
  rect(ctx, ox, oy + 12, 16, 4, '#3b3150')
}

/** A doorway through a side wall: each neighbouring room's floor meets at a threshold. */
export function drawSideDoorway(ctx: Ctx, ox: number, oy: number, left: FloorKind, right: FloorKind, tx: number, ty: number) {
  ctx.save()
  ctx.beginPath()
  ctx.rect(ox, oy, 8, 16)
  ctx.clip()
  drawFloor(ctx, ox, oy, left, tx, ty)
  ctx.restore()
  ctx.save()
  ctx.beginPath()
  ctx.rect(ox + 8, oy, 8, 16)
  ctx.clip()
  drawFloor(ctx, ox, oy, right, tx, ty)
  ctx.restore()
  rect(ctx, ox + 7, oy, 2, 16, PALETTE.woodDark)
  rect(ctx, ox, oy, 16, 16, 'rgba(20,14,30,0.12)')
}

// ---------------------------------------------------------------------------
// Furniture that isn't in the Kenney sheet, drawn to scale at 1 tile = 50cm.
// Pieces that stand against a north wall are drawn from the wall-face row
// down, so their height reads against the 2.5m wall behind them.

export type PropName =
  | 'doormat'
  | 'console'
  | 'coathooks'
  | 'boots'
  | 'medalhanger'
  | 'shoerack'
  | 'bookshelf'
  | 'wallmap'
  | 'desk'
  | 'officechair'
  | 'armchair'
  | 'floorlamp'
  | 'camerastand'
  | 'drums'
  | 'rugstudy'
  | 'tv'
  | 'sofa'
  | 'coffeetable'
  | 'rugliving'
  | 'diningtable'
  | 'chair'
  | 'chairup'
  | 'counter'
  | 'coffeecounter'
  | 'stove'
  | 'sink'
  | 'fridge'
  | 'kitchentable'
  | 'bed'
  | 'nightstand'
  | 'alarmclock'
  | 'wardrobe'
  | 'rugbed'
  | 'toilet'
  | 'basin'
  | 'shower'
  | 'bathmat'

export const PROP_SIZES: Record<PropName, { w: number; h: number }> = {
  doormat: { w: 32, h: 16 }, // 1m × 0.5m
  console: { w: 16, h: 32 }, // 0.5m deep × 1m long, against the side wall
  coathooks: { w: 16, h: 32 },
  boots: { w: 16, h: 16 },
  medalhanger: { w: 16, h: 32 },
  shoerack: { w: 16, h: 16 },
  bookshelf: { w: 16, h: 32 }, // four of these make 2m of shelving
  wallmap: { w: 48, h: 32 }, // 1.5m × 1m pin map
  desk: { w: 48, h: 32 }, // 1.4m desk
  officechair: { w: 16, h: 16 },
  armchair: { w: 32, h: 32 },
  floorlamp: { w: 16, h: 32 },
  camerastand: { w: 16, h: 32 },
  drums: { w: 32, h: 32 }, // an electronic kit is about 1m × 1m
  rugstudy: { w: 64, h: 48 },
  tv: { w: 64, h: 48 }, // 55" screen over a 2m media unit
  sofa: { w: 64, h: 32 }, // 3-seater, 2m × 0.9m
  coffeetable: { w: 32, h: 16 },
  rugliving: { w: 96, h: 64 }, // 3m × 2m
  diningtable: { w: 48, h: 32 }, // seats four
  chair: { w: 16, h: 16 },
  chairup: { w: 16, h: 16 },
  counter: { w: 16, h: 32 }, // wall cabinet above, 60cm counter below
  coffeecounter: { w: 16, h: 32 },
  stove: { w: 16, h: 32 },
  sink: { w: 16, h: 32 },
  fridge: { w: 16, h: 32 },
  kitchentable: { w: 32, h: 32 },
  bed: { w: 48, h: 80 }, // 160 × 200cm with the headboard on the wall
  nightstand: { w: 16, h: 16 },
  alarmclock: { w: 16, h: 16 }, // a nightstand with the alarm clock on it
  wardrobe: { w: 32, h: 32 },
  rugbed: { w: 80, h: 32 },
  toilet: { w: 16, h: 32 },
  basin: { w: 16, h: 32 },
  shower: { w: 32, h: 32 }, // 1m × 1m tray
  bathmat: { w: 32, h: 16 },
}

/** Where the scene paints the trip map inside the wall map's frame, in prop pixels. */
export const MAP_WALL = { x: 3, y: 4, w: 42, h: 24 }
/** Status LEDs on the Pi's disk enclosure, blinked by the scene. */
export const DESK_LEDS = [
  { x: 43, y: 11 },
  { x: 43, y: 13 },
  { x: 41, y: 11 },
]
/** Where light comes from, for the scene's warm glows. */
export const LIGHT_SOURCES: Partial<Record<PropName, { x: number; y: number; radius: number }>> = {
  floorlamp: { x: 8, y: 5, radius: 30 },
  tv: { x: 32, y: 18, radius: 30 },
  nightstand: { x: 8, y: 2, radius: 16 },
  desk: { x: 24, y: 8, radius: 18 },
}

const BOOK_COLORS = ['#8e2f35', '#2f5f63', '#c9a227', '#3f6b8a', '#6b4a2e', '#4f7a3a', '#d9a99d', '#2a2233']
const WHITE_GOODS = { body: '#e8e4da', line: '#c9c3b5', steel: '#b8bcc4', steelDark: '#8a9099' }

function disc(ctx: Ctx, cx: number, cy: number, r: number, color: string) {
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.round(Math.sqrt(r * r - dy * dy))
    rect(ctx, cx - half, cy + dy, half * 2, 1, color)
  }
}

function drawRug(ctx: Ctx, ox: number, oy: number, w: number, h: number, c: { edge: string; field: string; trim: string }) {
  rect(ctx, ox + 2, oy, w - 4, h, c.edge)
  rect(ctx, ox + 3, oy + 1, w - 6, h - 2, c.field)
  rect(ctx, ox + 6, oy + 4, w - 12, h - 8, c.trim)
  rect(ctx, ox + 7, oy + 5, w - 14, h - 10, c.field)
  const cx = ox + w / 2
  const cy = oy + h / 2
  const size = Math.min(8, Math.floor(h / 2) - 6)
  for (let i = 0; i < size; i++) {
    rect(ctx, cx - i, cy - size + i, i * 2, 1, c.trim)
    rect(ctx, cx - i, cy + size - 1 - i, i * 2, 1, c.trim)
  }
  for (let y = oy + 3; y < oy + h - 3; y += 3) {
    rect(ctx, ox, y, 2, 1, c.trim)
    rect(ctx, ox + w - 2, y, 2, 1, c.trim)
  }
}

/** A 60cm kitchen unit: wall cabinet and tiled splashback above, counter and doors below. */
function drawKitchenUnit(ctx: Ctx, ox: number, oy: number) {
  const r = (x: number, y: number, w: number, h: number, color: string) => rect(ctx, ox + x, oy + y, w, h, color)
  r(0, 0, 16, 8, WHITE_GOODS.body)
  r(0, 7, 16, 1, WHITE_GOODS.line)
  r(7, 0, 1, 7, WHITE_GOODS.line)
  r(5, 5, 1, 1, WHITE_GOODS.steelDark)
  r(9, 5, 1, 1, WHITE_GOODS.steelDark)
  r(0, 8, 16, 8, '#f2f2ee')
  for (let x = 3; x < 16; x += 4) r(x, 8, 1, 8, '#dcdcd4')
  r(0, 12, 16, 1, '#dcdcd4')
  r(0, 16, 16, 3, '#5f5766')
  r(0, 16, 16, 1, '#7d7383')
  r(0, 19, 16, 12, WHITE_GOODS.body)
  r(7, 19, 1, 12, WHITE_GOODS.line)
  r(5, 23, 1, 3, WHITE_GOODS.steelDark)
  r(9, 23, 1, 3, WHITE_GOODS.steelDark)
  r(0, 31, 16, 1, '#8a8090')
}

function drawChair(ctx: Ctx, ox: number, oy: number, backOnTop: boolean) {
  const r = (x: number, y: number, w: number, h: number, color: string) => rect(ctx, ox + x, oy + y, w, h, color)
  r(3, 4, 10, 10, PALETTE.ink)
  r(4, 5, 8, 8, PALETTE.woodLight)
  if (backOnTop) {
    r(3, 1, 10, 4, PALETTE.ink)
    r(4, 2, 8, 2, PALETTE.wood)
  } else {
    r(3, 12, 10, 4, PALETTE.ink)
    r(4, 13, 8, 2, PALETTE.wood)
  }
}

export function drawProp(ctx: Ctx, ox: number, oy: number, name: PropName) {
  const r = (x: number, y: number, w: number, h: number, color: string) => rect(ctx, ox + x, oy + y, w, h, color)
  switch (name) {
    // --- Entrance hall --------------------------------------------------------
    case 'doormat': {
      r(1, 3, 30, 11, '#5a3d27')
      r(2, 4, 28, 9, '#8a6a3f')
      for (let y = 5; y < 12; y += 2) r(3, y, 26, 1, '#7a5c35')
      break
    }
    case 'console': {
      // A narrow table along the side wall: the day's post, and a framed plan of the flat.
      r(1, 0, 14, 31, PALETTE.ink)
      r(2, 1, 12, 28, PALETTE.wood)
      r(2, 1, 1, 28, PALETTE.woodHighlight)
      r(4, 3, 9, 10, PALETTE.woodDark)
      r(5, 4, 7, 5, PALETTE.paper)
      r(6, 6, 7, 5, '#fbf6ea')
      r(10, 7, 2, 2, PALETTE.red)
      r(7, 9, 4, 1, '#b5aa94')
      r(4, 16, 9, 11, PALETTE.ink)
      r(5, 17, 7, 9, PALETTE.paper)
      r(6, 18, 2, 3, '#7f9f88')
      r(9, 18, 2, 3, '#d9b98c')
      r(6, 22, 5, 3, '#e7bfb4')
      r(2, 29, 2, 2, PALETTE.woodDark)
      r(12, 29, 2, 2, PALETTE.woodDark)
      break
    }
    case 'coathooks': {
      r(1, 4, 14, 2, PALETTE.woodDark)
      r(7, 6, 2, 2, PALETTE.brass)
      // Hiking backpack hanging from the middle hook.
      r(2, 7, 12, 21, PALETTE.ink)
      r(3, 8, 10, 19, '#4f7a3a')
      r(3, 8, 10, 2, '#62924a')
      r(4, 17, 8, 7, '#3b5c2b')
      r(7, 19, 2, 1, PALETTE.tape)
      r(3, 28, 10, 1, PALETTE.shadow)
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
    case 'medalhanger': {
      r(1, 3, 14, 2, PALETTE.woodDark)
      for (const [x, ribbon, drop] of [
        [3, '#3f6b8a', 12],
        [7, PALETTE.red, 9],
        [11, '#4f7a3a', 13],
      ] as const) {
        r(x, 5, 2, drop, ribbon)
        disc(ctx, ox + x + 1, oy + 7 + drop, 2, PALETTE.brass)
        r(x + 1, 6 + drop, 1, 1, PALETTE.brassLight)
      }
      r(3, 23, 10, 7, PALETTE.paper)
      r(4, 24, 8, 1, PALETTE.red)
      r(5, 26, 6, 2, PALETTE.ink)
      break
    }
    case 'shoerack': {
      r(1, 7, 14, 8, PALETTE.ink)
      r(2, 8, 12, 6, PALETTE.wood)
      r(2, 11, 12, 1, PALETTE.woodDark)
      // Running shoes on top.
      for (const x of [2, 8]) {
        r(x, 3, 6, 5, PALETTE.ink)
        r(x + 1, 4, 4, 3, '#3b7dd8')
        r(x + 1, 6, 4, 1, PALETTE.paper)
      }
      r(1, 15, 14, 1, PALETTE.shadow)
      break
    }
    // --- Study ----------------------------------------------------------------
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
    case 'wallmap': {
      r(2, 3, 46, 28, PALETTE.shadow)
      r(1, 2, 46, 28, PALETTE.ink)
      r(2, 3, 44, 26, PALETTE.woodDark)
      r(2, 3, 44, 1, PALETTE.woodHighlight)
      r(MAP_WALL.x, MAP_WALL.y, MAP_WALL.w, MAP_WALL.h, '#7fb0c9')
      break
    }
    case 'desk': {
      // Monitor against the wall; the Pi and its disk enclosure at the right end.
      r(12, 1, 22, 14, PALETTE.ink)
      r(13, 2, 20, 11, '#1f3b4d')
      for (let i = 0; i < 4; i++) r(15, 4 + i * 2, 4 + ((i * 5) % 11), 1, i % 2 ? '#7fd1b9' : '#e8c95a')
      r(21, 15, 4, 2, PALETTE.ink)
      r(38, 8, 8, 9, PALETTE.ink)
      r(39, 9, 6, 7, '#2a2d35')
      r(40, 15, 4, 1, '#3a3d46')
      r(0, 16, 48, 4, PALETTE.wood)
      r(0, 16, 48, 1, PALETTE.woodHighlight)
      r(15, 17, 16, 2, '#d8d0c0')
      r(33, 17, 3, 2, '#d8d0c0')
      r(38, 17, 6, 2, '#2e8b57')
      r(39, 17, 1, 1, PALETTE.brass)
      r(6, 14, 4, 4, PALETTE.red)
      r(7, 15, 2, 1, '#e05a48')
      r(0, 20, 48, 9, PALETTE.woodDark)
      r(34, 22, 12, 5, '#7d5634')
      r(39, 24, 2, 1, PALETTE.brass)
      r(1, 29, 3, 3, PALETTE.woodDark)
      r(44, 29, 3, 3, PALETTE.woodDark)
      break
    }
    case 'officechair': {
      r(4, 1, 8, 8, PALETTE.ink)
      r(5, 2, 6, 6, '#3a3d46')
      r(3, 8, 10, 5, PALETTE.ink)
      r(4, 9, 8, 3, '#4a4f5c')
      r(7, 13, 2, 2, PALETTE.ink)
      r(3, 15, 10, 1, PALETTE.shadow)
      break
    }
    case 'armchair': {
      // A wing chair seen from behind, angled into the room.
      r(2, 3, 28, 27, PALETTE.ink)
      r(4, 4, 24, 13, '#8e2f35')
      r(4, 4, 24, 2, '#b04a50')
      r(3, 13, 6, 16, '#7a2730')
      r(23, 13, 6, 16, '#7a2730')
      r(9, 17, 14, 11, '#a63a40')
      r(3, 30, 3, 2, PALETTE.woodDark)
      r(26, 30, 3, 2, PALETTE.woodDark)
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
      for (let i = 0; i < 14; i++) {
        r(7 - Math.floor(i / 3), 17 + i, 1, 1, '#3a3340')
        r(8 + Math.floor(i / 3), 17 + i, 1, 1, '#3a3340')
      }
      r(7, 15, 2, 14, '#4a4458')
      r(3, 9, 10, 7, PALETTE.ink)
      r(4, 10, 8, 5, '#1b1b20')
      r(4, 10, 2, 1, '#3a3a44')
      disc(ctx, ox + 8, oy + 12, 2, '#3a3a44')
      r(8, 12, 1, 1, '#8fb5d6')
      r(9, 8, 2, 1, '#2a2a30')
      break
    }
    case 'drums': {
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
    case 'rugstudy':
      drawRug(ctx, ox, oy, 64, 48, { edge: '#5c1f24', field: '#8e2f35', trim: '#c9a227' })
      break
    // --- Living room ----------------------------------------------------------
    case 'tv': {
      r(12, 5, 40, 24, PALETTE.ink)
      r(14, 7, 36, 20, '#26323f')
      r(16, 9, 9, 2, '#3b4b5c')
      r(14, 22, 36, 5, '#1d2731')
      r(20, 31, 24, 2, '#2a2a30')
      r(0, 33, 64, 13, PALETTE.ink)
      r(1, 34, 62, 11, PALETTE.woodDark)
      r(1, 34, 62, 1, PALETTE.woodHighlight)
      r(3, 36, 18, 7, '#7d5634')
      r(23, 36, 18, 7, '#1b1b20')
      r(43, 36, 18, 7, '#7d5634')
      r(26, 39, 9, 3, '#e8e8f0')
      r(33, 40, 1, 1, '#4cd964')
      r(0, 46, 64, 2, PALETTE.shadow)
      break
    }
    case 'sofa': {
      // Seen from behind, facing the TV.
      r(0, 5, 64, 25, PALETTE.ink)
      r(1, 6, 62, 12, '#3f6b8a')
      r(1, 6, 62, 2, '#5a88a8')
      r(21, 8, 1, 10, '#355a75')
      r(42, 8, 1, 10, '#355a75')
      r(1, 14, 6, 15, '#355a75')
      r(57, 14, 6, 15, '#355a75')
      r(7, 18, 50, 10, '#4b7da0')
      r(10, 14, 8, 5, PALETTE.tape)
      r(2, 30, 2, 2, PALETTE.woodDark)
      r(60, 30, 2, 2, PALETTE.woodDark)
      break
    }
    case 'coffeetable': {
      r(1, 2, 30, 11, PALETTE.ink)
      r(2, 3, 28, 8, PALETTE.wood)
      r(2, 3, 28, 1, PALETTE.woodHighlight)
      r(5, 5, 7, 4, '#3f6b8a')
      r(6, 4, 6, 1, PALETTE.paper)
      disc(ctx, ox + 23, oy + 7, 2, '#4f7a3a')
      r(3, 11, 2, 3, PALETTE.woodDark)
      r(27, 11, 2, 3, PALETTE.woodDark)
      r(1, 15, 30, 1, PALETTE.shadow)
      break
    }
    case 'rugliving':
      drawRug(ctx, ox, oy, 96, 64, { edge: '#24484b', field: '#2f5f63', trim: '#e8c95a' })
      break
    case 'diningtable': {
      r(1, 1, 46, 26, PALETTE.ink)
      r(2, 2, 44, 22, '#a0703f')
      r(2, 2, 44, 1, '#bf8a52')
      for (const [x, y] of [
        [8, 5],
        [32, 5],
        [8, 14],
        [32, 14],
      ] as const) {
        r(x, y, 8, 6, PALETTE.paper)
        disc(ctx, ox + x + 4, oy + y + 3, 2, '#e8e4da')
      }
      disc(ctx, ox + 24, oy + 12, 3, '#4f7a3a')
      r(2, 24, 44, 3, '#7d5634')
      r(3, 27, 3, 5, PALETTE.woodDark)
      r(42, 27, 3, 5, PALETTE.woodDark)
      break
    }
    case 'chair':
      drawChair(ctx, ox, oy, true)
      break
    case 'chairup':
      drawChair(ctx, ox, oy, false)
      break
    // --- Kitchen --------------------------------------------------------------
    case 'counter':
      drawKitchenUnit(ctx, ox, oy)
      break
    case 'coffeecounter': {
      drawKitchenUnit(ctx, ox, oy)
      r(4, 9, 8, 8, PALETTE.ink)
      r(5, 10, 6, 6, '#2a2a30')
      r(6, 13, 3, 1, '#c0392b')
      r(9, 15, 2, 2, PALETTE.paper)
      break
    }
    case 'stove': {
      drawKitchenUnit(ctx, ox, oy)
      r(1, 0, 14, 6, WHITE_GOODS.steel)
      r(3, 6, 10, 2, WHITE_GOODS.steelDark)
      r(0, 16, 16, 3, '#2a2a30')
      r(3, 17, 3, 1, '#55555f')
      r(10, 17, 3, 1, '#55555f')
      r(2, 20, 12, 9, '#2a2a30')
      r(3, 21, 10, 1, WHITE_GOODS.steel)
      r(4, 23, 8, 4, '#3a3a44')
      break
    }
    case 'sink': {
      drawKitchenUnit(ctx, ox, oy)
      // A window over the sink.
      r(1, 0, 14, 9, '#ffffff')
      r(2, 1, 12, 7, '#bfe3f2')
      r(7, 1, 1, 7, '#ffffff')
      r(3, 2, 3, 1, '#e8f6fc')
      r(7, 11, 2, 5, WHITE_GOODS.steel)
      r(3, 16, 10, 3, WHITE_GOODS.steel)
      r(4, 17, 8, 1, WHITE_GOODS.steelDark)
      break
    }
    case 'fridge': {
      // 1.8m tall: twice the height of the counters beside it. Covered in trip magnets.
      r(0, 0, 16, 31, PALETTE.ink)
      r(1, 1, 14, 29, '#dfe3e8')
      r(1, 1, 14, 1, '#f4f6f8')
      r(1, 11, 14, 1, WHITE_GOODS.steel)
      r(12, 4, 1, 5, WHITE_GOODS.steelDark)
      r(12, 14, 1, 8, WHITE_GOODS.steelDark)
      for (const [x, y, color] of [
        [3, 3, PALETTE.red],
        [6, 5, '#3f6b8a'],
        [3, 7, PALETTE.tape],
        [8, 2, '#4f7a3a'],
        [3, 14, '#c9a227'],
        [7, 16, '#8e2f35'],
        [4, 20, '#2f5f63'],
        [8, 23, '#e07a3a'],
      ] as const) {
        r(x, y, 2, 2, color)
      }
      r(5, 13, 5, 4, PALETTE.paper)
      r(0, 31, 16, 1, PALETTE.shadow)
      break
    }
    case 'kitchentable': {
      disc(ctx, ox + 16, oy + 13, 12, PALETTE.ink)
      disc(ctx, ox + 16, oy + 13, 11, '#c4955e')
      disc(ctx, ox + 16, oy + 12, 4, '#e8e4da')
      r(13, 10, 2, 2, PALETTE.red)
      r(17, 11, 2, 2, '#e8c95a')
      r(15, 25, 2, 6, PALETTE.woodDark)
      r(11, 30, 10, 2, PALETTE.woodDark)
      break
    }
    // --- Bedroom ----------------------------------------------------------------
    case 'bed': {
      r(0, 2, 48, 14, PALETTE.ink)
      r(1, 3, 46, 12, '#7d5634')
      r(1, 3, 46, 1, PALETTE.woodHighlight)
      r(1, 14, 46, 64, PALETTE.ink)
      r(2, 15, 44, 10, '#f4ecd8')
      r(5, 16, 16, 7, '#ffffff')
      r(27, 16, 16, 7, '#ffffff')
      r(5, 22, 16, 1, '#e3d9c4')
      r(27, 22, 16, 1, '#e3d9c4')
      r(2, 25, 44, 52, '#6f8fa8')
      r(2, 25, 44, 4, '#8fb0c8')
      for (let y = 33; y < 75; y += 8) r(2, y, 44, 1, '#64829a')
      r(1, 77, 46, 3, PALETTE.woodDark)
      break
    }
    case 'nightstand': {
      r(2, 5, 12, 10, PALETTE.ink)
      r(3, 6, 10, 8, PALETTE.wood)
      r(3, 9, 10, 1, PALETTE.woodDark)
      r(7, 11, 2, 1, PALETTE.brass)
      r(5, 0, 6, 4, '#f0d9a0')
      r(5, 0, 6, 1, '#fff1c8')
      r(7, 4, 2, 1, PALETTE.ink)
      r(2, 15, 12, 1, PALETTE.shadow)
      break
    }
    case 'alarmclock': {
      r(2, 5, 12, 10, PALETTE.ink)
      r(3, 6, 10, 8, PALETTE.wood)
      r(3, 9, 10, 1, PALETTE.woodDark)
      r(7, 11, 2, 1, PALETTE.brass)
      r(4, 0, 8, 6, PALETTE.ink)
      r(5, 1, 6, 4, '#1b1b20')
      r(5, 2, 2, 1, '#e04434')
      r(8, 2, 2, 1, '#e04434')
      r(4, 0, 1, 1, PALETTE.brass)
      r(11, 0, 1, 1, PALETTE.brass)
      r(2, 15, 12, 1, PALETTE.shadow)
      break
    }
    case 'wardrobe': {
      r(0, 0, 32, 32, PALETTE.ink)
      r(1, 1, 30, 30, '#c9b38f')
      r(1, 1, 30, 2, '#dcc8a4')
      r(15, 3, 2, 28, '#a8946f')
      r(12, 14, 1, 5, PALETTE.woodDark)
      r(19, 14, 1, 5, PALETTE.woodDark)
      break
    }
    case 'rugbed':
      drawRug(ctx, ox, oy, 80, 32, { edge: '#5f7a64', field: '#8fae95', trim: '#f4ecd8' })
      break
    // --- Bathroom ---------------------------------------------------------------
    case 'toilet': {
      r(3, 7, 10, 9, PALETTE.ink)
      r(4, 8, 8, 7, '#f4f6f8')
      r(6, 9, 4, 1, WHITE_GOODS.steel)
      r(3, 16, 10, 12, PALETTE.ink)
      r(4, 17, 8, 10, '#f4f6f8')
      r(5, 19, 6, 6, '#dfe6ec')
      r(3, 28, 10, 1, PALETTE.shadow)
      break
    }
    case 'basin': {
      r(2, 1, 12, 10, WHITE_GOODS.steel)
      r(3, 2, 10, 8, '#bfe3f2')
      r(4, 3, 3, 1, '#e8f6fc')
      r(7, 11, 2, 4, WHITE_GOODS.steel)
      r(1, 14, 14, 6, PALETTE.ink)
      r(2, 15, 12, 4, '#f4f6f8')
      r(4, 16, 8, 2, '#dfe6ec')
      r(1, 20, 14, 10, '#c9b38f')
      r(7, 21, 1, 9, '#a8946f')
      r(1, 30, 14, 1, PALETTE.shadow)
      break
    }
    case 'shower': {
      r(0, 0, 32, 32, '#9fc3d6')
      r(1, 1, 30, 30, '#e8eef2')
      for (let x = 5; x < 31; x += 6) r(x, 1, 1, 30, '#dfe6ec')
      disc(ctx, ox + 16, oy + 16, 2, WHITE_GOODS.steelDark)
      r(0, 31, 32, 1, '#7fa7bd')
      r(31, 0, 1, 32, '#7fa7bd')
      break
    }
    case 'bathmat': {
      r(2, 3, 28, 10, '#5f8fa8')
      r(3, 4, 26, 8, '#7fb0c9')
      for (let x = 5; x < 28; x += 3) r(x, 4, 1, 8, '#6fa0b9')
      break
    }
  }
}

// ---------------------------------------------------------------------------
// Interaction cues

export const OUTLINE_COLOR = '#fff3c4'

/**
 * Traces the opaque pixels of `src` (anything over half alpha, so soft drop
 * shadows don't count) into two canvases one pixel larger on every side: a
 * one-pixel outline hugging the shape, and the shape itself filled white for
 * an additive "lit up" pass.
 */
export function traceSilhouette(src: HTMLCanvasElement): { outline: HTMLCanvasElement; shine: HTMLCanvasElement } {
  const { width: w, height: h } = src
  const alpha = src.getContext('2d')!.getImageData(0, 0, w, h).data
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && alpha[(y * w + x) * 4 + 3] > 128
  const make = () => {
    const canvas = document.createElement('canvas')
    canvas.width = w + 2
    canvas.height = h + 2
    return canvas
  }
  const outline = make()
  const shine = make()
  const octx = outline.getContext('2d')!
  const sctx = shine.getContext('2d')!
  octx.fillStyle = OUTLINE_COLOR
  sctx.fillStyle = '#ffffff'
  for (let y = -1; y <= h; y++) {
    for (let x = -1; x <= w; x++) {
      if (solid(x, y)) sctx.fillRect(x + 1, y + 1, 1, 1)
      else if (solid(x + 1, y) || solid(x - 1, y) || solid(x, y + 1) || solid(x, y - 1)) {
        octx.fillRect(x + 1, y + 1, 1, 1)
      }
    }
  }
  return { outline, shine }
}

/** A 7x7 four-pointed twinkle marking something you can interact with nearby. */
export function drawSparkle(ctx: Ctx) {
  rect(ctx, 3, 0, 1, 7, PALETTE.brassLight)
  rect(ctx, 0, 3, 7, 1, PALETTE.brassLight)
  rect(ctx, 2, 2, 3, 3, PALETTE.brassLight)
  rect(ctx, 3, 1, 1, 5, '#ffffff')
  rect(ctx, 1, 3, 5, 1, '#ffffff')
}

/** A 7x6 downward chevron that bobs over whatever the visitor is focused on. */
export function drawFocusArrow(ctx: Ctx) {
  const rows = ['kkkkkkk', 'kyyyyyk', '.kyyyk.', '..kyk..', '...k...']
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === 'k') rect(ctx, x, y, 1, 1, PALETTE.ink)
      if (row[x] === 'y') rect(ctx, x, y, 1, 1, y === 1 ? '#fff3c4' : PALETTE.brassLight)
    }
  })
  rect(ctx, 1, 5, 5, 1, PALETTE.shadow)
}

// ---------------------------------------------------------------------------
// Characters

export type Facing = 'down' | 'up' | 'side'
export type Step = 'idle' | 'a' | 'b'
export type CharacterName = 'joao' | 'guest'

/** Characters are a tile wide and 1.5 tiles tall (~1.75m against a 2.5m wall). */
export const CHAR_H = 24

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
    '.....kSSSSk.....',
    '...kjjjttjjjk...',
    '..kjjjjttjjjjk..',
    '..kjjjjmmjjjjk..',
    '..kjjjjmmjjjjk..',
    '..kjjjjjjjjjjk..',
    '..ksjjjjjjjjsk..',
    '..ksJJJJJJJJsk..',
    '...kppppppppk...',
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
    '.....kSSSSk.....',
    '...kjjjjjjjjk...',
    '..kjjjjjjjjjjk..',
    '..kjjjjjjjjjjk..',
    '..kjjjjjjjjjjk..',
    '..kjjjjjjjjjjk..',
    '..ksjjjjjjjjsk..',
    '..ksJJJJJJJJsk..',
    '...kppppppppk...',
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
    '......kSSk......',
    '.....kjjjjk.....',
    '....kjjjjjjk....',
    '....kjjjjmmk....',
    '....kjjjjjjk....',
    '....kjjsjjjk....',
    '....kjjsjjjk....',
    '....kJJJJJJk....',
    '.....kppppk.....',
  ],
}

const LEGS: Record<Facing, Record<Step, string[]>> = {
  down: {
    idle: ['....kppkkppk....', '....kppkkppk....', '....kppkkppk....', '....kbbkkbbk....', '................'],
    a: ['....kppkkppk....', '....kppkkppk....', '....kbbkkppk....', '........kbbk....', '................'],
    b: ['....kppkkppk....', '....kppkkppk....', '....kppkkbbk....', '....kbbk........', '................'],
  },
  up: {
    idle: ['....kppkkppk....', '....kppkkppk....', '....kppkkppk....', '....kbbkkbbk....', '................'],
    a: ['....kppkkppk....', '....kppkkppk....', '....kbbkkppk....', '........kbbk....', '................'],
    b: ['....kppkkppk....', '....kppkkppk....', '....kppkkbbk....', '....kbbk........', '................'],
  },
  side: {
    idle: ['.....kppk.......', '.....kppk.......', '.....kppk.......', '.....kbbbk......', '................'],
    a: ['.....kppk.......', '....kpkkpk......', '...kpk..kpk.....', '..kbbk..kbbk....', '................'],
    b: ['.....kppk.......', '.....kppk.......', '.....kppk.......', '......kbbbk.....', '................'],
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

/** The visitor's clothes, picked at the bedroom wardrobe. */
export interface Outfit {
  cap: string
  jacket: string
  hair: string
}

export const OUTFIT_OPTIONS: Record<keyof Outfit, { label: string; value: string }[]> = {
  cap: [
    { label: 'Red', value: '#c0392b' },
    { label: 'Navy', value: '#2c3c5a' },
    { label: 'Mustard', value: '#c9a227' },
    { label: 'Forest', value: '#3b5c2b' },
    { label: 'Sky', value: '#5a9fd4' },
    { label: 'Charcoal', value: '#3a3a44' },
  ],
  jacket: [
    { label: 'Green', value: '#4f7a3a' },
    { label: 'Red', value: '#a63a40' },
    { label: 'Denim', value: '#3f6b8a' },
    { label: 'Ochre', value: '#c08a2b' },
    { label: 'Plum', value: '#6b4a7a' },
    { label: 'Grey', value: '#6d6a72' },
  ],
  hair: [
    { label: 'Brown', value: '#7a4a28' },
    { label: 'Black', value: '#2a2026' },
    { label: 'Blond', value: '#d8b45a' },
    { label: 'Ginger', value: '#c0622b' },
    { label: 'Grey', value: '#a9a4a0' },
  ],
}

export const DEFAULT_OUTFIT: Outfit = { cap: '#c0392b', jacket: '#4f7a3a', hair: '#7a4a28' }

function darken(hex: string, amount = 0.72): string {
  const n = parseInt(hex.slice(1), 16)
  const channel = (shift: number) => Math.round(((n >> shift) & 0xff) * amount)
  return `#${[16, 8, 0].map((shift) => channel(shift).toString(16).padStart(2, '0')).join('')}`
}

function outfitColors(outfit: Outfit): Record<string, string> {
  return {
    c: outfit.cap,
    C: darken(outfit.cap),
    j: outfit.jacket,
    J: darken(outfit.jacket),
    m: outfit.jacket,
    h: outfit.hair,
  }
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
  outfit?: Outfit,
) {
  const colors = outfit ? { ...CHARACTER_COLORS[who], ...outfitColors(outfit) } : CHARACTER_COLORS[who]
  // Bob the body down a pixel mid-stride.
  const bob = step === 'idle' ? 0 : 1
  const rows = [...BODY[facing], ...LEGS[facing][step]]
  // Soft shadow under the feet.
  rect(ctx, ox + 3, oy + CHAR_H - 2, 10, 2, PALETTE.shadow)
  rows.forEach((row, y) => {
    const dy = y < BODY[facing].length ? bob : 0
    for (let x = 0; x < row.length; x++) {
      const color = colors[row[x]]
      if (color) rect(ctx, ox + x, oy + y + dy, 1, 1, color)
    }
  })
}
