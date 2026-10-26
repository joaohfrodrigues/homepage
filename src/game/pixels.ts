/**
 * Procedurally drawn pixel art for the house: floors, wall faces, doors and
 * the furniture. Everything draws onto plain canvases so it can be baked into
 * Phaser textures (and unit-tested without a WebGL context).
 */
import { drawGrid } from './grid-sprite'
import type { FloorKind, WallKind } from './layout'
import { GRID_PROPS } from './sprites/props'

export type Ctx = CanvasRenderingContext2D

const PALETTE = {
  ink: '#2a2233',
  shadow: 'rgba(20, 14, 30, 0.28)',
  // Walnut: dark enough to read against the light oak floors.
  woodDark: '#4a3122',
  wood: '#6b4630',
  woodLight: '#8a5d3f',
  woodHighlight: '#a2714c',
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

const OAK = { base: '#caa57a', light: '#d2ae84', dark: '#c29c70', gap: '#a8835a', grain: '#dcbb92' }

/** Hydraulic cement tiles (mosaico hidráulico), four 25cm tiles to a game tile. */
const HYDRAULIC = { ground: '#ece4d3', blue: '#6b8aa8', ochre: '#d3ab68' }

export function drawFloor(ctx: Ctx, ox: number, oy: number, kind: FloorKind, tx: number, ty: number) {
  switch (kind) {
    case 'oak':
    case 'oak-across': {
      // Four planks per tile. Each has one butt joint per tile, and the board
      // after the joint carries on into the next tile with the same shade.
      const across = kind === 'oak-across'
      const [along, side] = across ? [tx, ty] : [ty, tx]
      const shade = (plank: number, board: number) => (hash(plank, board) > 0.5 ? OAK.dark : OAK.light)
      rect(ctx, ox, oy, 16, 16, OAK.base)
      for (let i = 0; i < 4; i++) {
        const plank = side * 4 + i
        const joint = Math.floor(hash(plank + 101, along) * 16)
        const strip = (from: number, length: number, color: string) =>
          across ? rect(ctx, ox + from, oy + i * 4, length, 3, color) : rect(ctx, ox + i * 4, oy + from, 3, length, color)
        strip(0, joint, shade(plank, along))
        strip(joint + 1, 15 - joint, shade(plank, along + 1))
        strip(joint, 1, OAK.gap)
        if (across) rect(ctx, ox, oy + i * 4 + 3, 16, 1, OAK.gap)
        else rect(ctx, ox + i * 4 + 3, oy, 1, 16, OAK.gap)
        if (hash(plank + 7, along * 3) > 0.7) {
          const at = (joint + 6) % 14
          if (across) rect(ctx, ox + at, oy + i * 4 + 1, 2, 1, OAK.grain)
          else rect(ctx, ox + i * 4 + 1, oy + at, 1, 2, OAK.grain)
        }
      }
      break
    }
    case 'hydraulic': {
      // Blue corners meet across four tiles as a diamond; an ochre flower sits in each centre.
      for (let qy = 0; qy < 2; qy++) {
        for (let qx = 0; qx < 2; qx++) {
          const bx = ox + qx * 8
          const by = oy + qy * 8
          rect(ctx, bx, by, 8, 8, HYDRAULIC.ground)
          for (const [cx, cy, dx, dy] of [
            [0, 0, 1, 1],
            [7, 0, -1, 1],
            [0, 7, 1, -1],
            [7, 7, -1, -1],
          ] as const) {
            rect(ctx, bx + Math.min(cx, cx + dx), by + cy, 2, 1, HYDRAULIC.blue)
            rect(ctx, bx + cx, by + cy + dy, 1, 1, HYDRAULIC.blue)
          }
          rect(ctx, bx + 3, by + 2, 2, 1, HYDRAULIC.ochre)
          rect(ctx, bx + 2, by + 3, 4, 2, HYDRAULIC.ochre)
          rect(ctx, bx + 3, by + 5, 2, 1, HYDRAULIC.ochre)
          rect(ctx, bx + 3, by + 3, 2, 2, HYDRAULIC.blue)
        }
      }
      rect(ctx, ox, oy + 15, 16, 1, 'rgba(0,0,0,0.06)')
      rect(ctx, ox + 15, oy, 1, 16, 'rgba(0,0,0,0.06)')
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
    case 'balcony': {
      // Lioz limestone slabs, 1m × 0.5m, staggered.
      rect(ctx, ox, oy, 16, 16, '#e4ddcc')
      for (let row = 0; row < 2; row++) {
        rect(ctx, ox, oy + row * 8 + 7, 16, 1, '#c9bfa9')
        rect(ctx, ox + ((tx + row + ty) % 2 ? 4 : 12), oy + row * 8, 1, 7, '#c9bfa9')
        if (hash(tx * 2 + row, ty) > 0.5) rect(ctx, ox + 7, oy + row * 8 + 3, 1, 1, '#d6cdb9')
      }
      break
    }
  }
}

// ---------------------------------------------------------------------------
// Walls

const WALLPAPER: Record<WallKind, { base: string; accent: string; board: string }> = {
  warmwhite: { base: '#f3ece0', accent: '#e6dccb', board: '#e0d5c2' },
  azulejo: { base: '#f3ece0', accent: '#2f5d9a', board: '#e0d5c2' },
  library: { base: '#3f5a4a', accent: '#37503f', board: '#3a2619' },
  sage: { base: '#c9d6c3', accent: '#bccab5', board: '#e0d5c2' },
  bath: { base: '#e3eef2', accent: '#c9dbe3', board: '#9fc3d6' },
  metro: { base: '#f2f2ee', accent: '#dcdcd4', board: '#8a8090' },
  railing: { base: '#2b2a33', accent: '#4a4858', board: '#2b2a33' },
}

export function drawWallCap(ctx: Ctx, ox: number, oy: number) {
  rect(ctx, ox, oy, 16, 16, '#4b4060')
  rect(ctx, ox + 1, oy + 1, 14, 14, '#574b6e')
  rect(ctx, ox + 2, oy + 2, 4, 1, '#625679')
}

function drawWallpaper(ctx: Ctx, ox: number, oy: number, kind: WallKind, part: 'upper' | 'lower') {
  const paper = WALLPAPER[kind]
  rect(ctx, ox, oy, 16, 16, paper.base)
  // Pinstripes and walnut wainscoting for the study, an azulejo dado in the
  // hall, metro tiles in the kitchen, a picture rail on warm white.
  if (kind === 'library') {
    for (let x = 1; x < 16; x += 4) rect(ctx, ox + x, oy, 1, 16, paper.accent)
    if (part === 'lower') {
      rect(ctx, ox, oy + 5, 16, 7, PALETTE.wood)
      rect(ctx, ox, oy + 5, 16, 1, PALETTE.woodLight)
      rect(ctx, ox + 7, oy + 6, 1, 6, PALETTE.woodDark)
    }
  } else if (kind === 'azulejo') {
    if (part === 'lower') {
      // Blue-and-white tiles to about 1.2m, under a blue border.
      rect(ctx, ox, oy, 16, 12, '#eef2f7')
      for (let y = 1; y < 12; y += 4) {
        for (let x = 0; x < 16; x += 4) {
          rect(ctx, ox + x + 1, oy + y + 1, 2, 2, '#3f6fae')
          rect(ctx, ox + x, oy + y, 1, 1, paper.accent)
        }
      }
      rect(ctx, ox, oy, 16, 1, paper.accent)
    } else {
      rect(ctx, ox, oy + 8, 16, 1, WALLPAPER.warmwhite.accent)
    }
  } else if (kind === 'bath' || kind === 'metro') {
    // Wall tiles: a square grid for the bathroom, staggered metro tiles in the kitchen.
    for (let y = 3; y < 16; y += 4) rect(ctx, ox, oy + y, 16, 1, paper.accent)
    for (let row = 0; row < 4; row++) {
      const offset = kind === 'metro' && row % 2 ? 4 : 0
      for (let x = offset + 3; x < 16; x += kind === 'metro' ? 8 : 4) rect(ctx, ox + x, oy + row * 4, 1, 3, paper.accent)
    }
  } else if (kind === 'sage') {
    for (let x = 2; x < 16; x += 6) rect(ctx, ox + x, oy, 1, 16, paper.accent)
  } else if (kind === 'warmwhite') {
    if (part === 'upper') rect(ctx, ox, oy + 8, 16, 1, paper.accent)
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

const WINDOW = { frame: '#f7f3ea', glass: '#9ccbe0', glint: '#cbe7f2', sill: '#e3dccd', curtain: '#efe6d6' }

/**
 * One half of a tall Lisbon sash window in a wall face, two tiles wide: white
 * frames, a transom, a stone sill and a strip of linen curtain on each side.
 */
export function drawWindow(
  ctx: Ctx,
  ox: number,
  oy: number,
  kind: WallKind,
  part: 'upper' | 'lower',
  edges: { left: boolean; right: boolean },
) {
  drawWallFace(ctx, ox, oy, kind, part)
  // Frame from the outer edge to the mullion where the two halves meet.
  const fx = edges.left ? 2 : 0
  const fw = (edges.right ? 14 : 16) - fx
  const gx = fx + 1
  const gw = fw - 2
  const r = (x: number, y: number, w: number, h: number, color: string) => rect(ctx, ox + x, oy + y, w, h, color)
  if (part === 'upper') {
    r(fx, 4, fw, 12, WINDOW.frame)
    r(gx, 6, gw, 10, WINDOW.glass)
    r(gx, 10, gw, 1, WINDOW.frame)
    if (edges.left) {
      r(gx + 1, 7, 2, 1, WINDOW.glint)
      r(gx + 1, 8, 1, 1, WINDOW.glint)
    }
  } else {
    r(fx, 0, fw, 9, WINDOW.frame)
    r(gx, 0, gw, 7, WINDOW.glass)
    r(fx - (edges.left ? 1 : 0), 9, fw + (edges.left ? 1 : 0) + (edges.right ? 1 : 0), 2, WINDOW.sill)
    r(fx, 11, fw, 1, 'rgba(20,14,30,0.18)')
  }
  // Curtains hang just outside the frame, down to the sill.
  const drop = part === 'upper' ? [4, 12] : [0, 9]
  if (edges.left) r(0, drop[0], 2, drop[1], WINDOW.curtain)
  if (edges.right) r(14, drop[0], 2, drop[1], WINDOW.curtain)
}

const IRON = '#2b2a33'

/** The balcony's wrought-iron front railing, seen face-on against the street below. */
export function drawRailingFront(ctx: Ctx, ox: number, oy: number) {
  rect(ctx, ox, oy + 13, 16, 3, '#cfc6b1')
  rect(ctx, ox, oy + 15, 16, 1, '#b5aa94')
  rect(ctx, ox, oy + 3, 16, 2, IRON)
  rect(ctx, ox, oy + 3, 16, 1, '#4a4858')
  rect(ctx, ox, oy + 11, 16, 1, IRON)
  for (let x = 1; x < 16; x += 4) rect(ctx, ox + x, oy + 5, 1, 8, IRON)
  // Little scrolls between the bars.
  for (let x = 3; x < 16; x += 4) {
    rect(ctx, ox + x - 1, oy + 7, 3, 1, IRON)
    rect(ctx, ox + x, oy + 8, 1, 1, IRON)
  }
  // A string of festoon bulbs, sagging between the railing's posts.
  rect(ctx, ox, oy + 1, 4, 1, FESTOON.wire)
  rect(ctx, ox + 4, oy + 2, 8, 1, FESTOON.wire)
  rect(ctx, ox + 12, oy + 1, 4, 1, FESTOON.wire)
  drawBulb(ctx, ox + 7, oy + 3)
}

const FESTOON = { wire: '#5c5862', glass: '#f6dca0', shine: '#fff4d6' }

/** Where the festoon bulbs hang on the balcony railings, from the tile's corner. */
export const FESTOON_BULBS = { front: { x: 8, y: 5 }, side: { x: 3, y: 9 } }

function drawBulb(ctx: Ctx, x: number, y: number) {
  rect(ctx, x, y, 2, 1, IRON)
  rect(ctx, x, y + 1, 2, 3, FESTOON.glass)
  rect(ctx, x, y + 1, 1, 1, FESTOON.shine)
}

/** The balcony's side railing from above: the slab ends at a line of iron. */
export function drawRailingSide(ctx: Ctx, ox: number, oy: number, floor: FloorKind, tx: number, ty: number) {
  ctx.save()
  ctx.beginPath()
  ctx.rect(ox, oy, 8, 16)
  ctx.clip()
  drawFloor(ctx, ox, oy, floor, tx, ty)
  ctx.restore()
  rect(ctx, ox + 8, oy, 1, 16, '#b5aa94')
  rect(ctx, ox + 5, oy, 2, 16, IRON)
  for (let y = 1; y < 16; y += 4) rect(ctx, ox + 4, oy + y, 4, 2, IRON)
  rect(ctx, ox + 3, oy, 1, 16, FESTOON.wire)
  drawBulb(ctx, ox + 2, oy + 7)
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

/** How the bathroom door stands: `open` is how far through its quarter turn, and a rattle pushes the handle down and shifts it in the frame. */
export interface DoorPose {
  open: number
  handleDown?: boolean
  nudge?: number
}

/**
 * One frame of the bathroom door: as wide as the doorway's two tiles and a
 * little taller than its wall face, so the leaf can swing out past it.
 */
export const DOOR_FRAME = { w: 32, h: 36 }
/** The leaf fills the doorway inside its posts and under its lintel. */
const LEAF = { x: 2, y: 4, w: 28, h: 28 }

const DOOR_PAINT = { face: '#efe7d6', panel: '#e6dcc7', shade: '#cdc2ab', light: '#fbf7ee', gap: '#2f2a3a' }

/** A four-panel interior door, painted off-white, hinged on the left with a lever handle on the right. */
function drawDoorLeaf(ctx: Ctx, ox: number, oy: number, handleDown: boolean) {
  const r = (x: number, y: number, w: number, h: number, color: string) => rect(ctx, ox + x, oy + y, w, h, color)
  r(0, 0, LEAF.w, LEAF.h, PALETTE.ink)
  r(1, 1, LEAF.w - 2, LEAF.h - 2, DOOR_PAINT.face)
  // The lintel's shadow across the top, and the gap over the floor.
  r(1, 1, LEAF.w - 2, 1, DOOR_PAINT.shade)
  r(1, LEAF.h - 1, LEAF.w - 2, 1, DOOR_PAINT.gap)
  // Recessed panels: shadowed along the top and left, catching the light along the bottom and right.
  for (const [x, y] of [
    [4, 4],
    [15, 4],
    [4, 16],
    [15, 16],
  ]) {
    r(x, y, 9, 9, DOOR_PAINT.panel)
    r(x, y, 9, 1, DOOR_PAINT.shade)
    r(x, y, 1, 9, DOOR_PAINT.shade)
    r(x, y + 8, 9, 1, DOOR_PAINT.light)
    r(x + 8, y + 1, 1, 8, DOOR_PAINT.light)
  }
  // Two hinges on the left stile.
  r(1, 4, 1, 3, WHITE_GOODS.steelDark)
  r(1, 20, 1, 3, WHITE_GOODS.steelDark)
  // A round rose and a lever reaching towards the hinges, pressed down in a rattle, over a keyhole.
  r(23, 13, 2, 2, WHITE_GOODS.steelDark)
  if (handleDown) {
    r(21, 14, 2, 1, WHITE_GOODS.steel)
    r(19, 15, 2, 1, WHITE_GOODS.steel)
  } else {
    r(19, 13, 4, 1, WHITE_GOODS.steel)
    r(19, 14, 4, 1, WHITE_GOODS.steelDark)
  }
  r(23, 17, 1, 2, PALETTE.ink)
}

/**
 * The bathroom door in `pose`, drawn into a DOOR_FRAME at (ox, oy) over its
 * doorway. Opening, it swings into the bathroom on its left hinges: the leaf
 * narrows as it turns, its free edge grows as it comes towards the viewer and
 * it darkens out of the light, until only its edge shows against the post.
 */
export function drawBathroomDoor(ctx: Ctx, ox: number, oy: number, { open, handleDown = false, nudge = 0 }: DoorPose) {
  if (open <= 0) return drawDoorLeaf(ctx, ox + LEAF.x + nudge, oy + LEAF.y, handleDown)
  const leaf = document.createElement('canvas')
  leaf.width = LEAF.w
  leaf.height = LEAF.h
  drawDoorLeaf(leaf.getContext('2d')!, 0, 0, false)
  const turn = (Math.min(open, 1) * Math.PI) / 2
  const width = Math.max(3, Math.round(LEAF.w * Math.cos(turn)))
  const reach = Math.sin(turn) * (DOOR_FRAME.h - LEAF.y - LEAF.h)
  ctx.imageSmoothingEnabled = false
  for (let c = 0; c < width; c++) {
    const along = (c + 0.5) / width
    const height = Math.round(LEAF.h + along * reach)
    // Edge-on, all that's left is the door's thickness.
    const source = width <= 3 ? LEAF.w - 2 : Math.floor(along * LEAF.w)
    ctx.drawImage(leaf, source, 0, 1, LEAF.h, ox + LEAF.x + c, oy + LEAF.y, 1, height)
    rect(ctx, ox + LEAF.x + c, oy + LEAF.y, 1, height, `rgba(20,14,30,${(0.3 * Math.sin(turn)).toFixed(2)})`)
  }
  rect(ctx, ox + LEAF.x + width - 1, oy + LEAF.y, 1, Math.round(LEAF.h + reach), PALETTE.ink)
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
// Furniture, drawn to scale at 1 tile = 50cm.
// Pieces that stand against a north wall are drawn from the wall-face row
// down, so their height reads against the 2.5m wall behind them.

export type PropName =
  | 'console'
  | 'coatstand'
  | 'boots'
  | 'medalstand'
  | 'guestbook'
  | 'bookshelfside'
  | 'wallmap'
  | 'desk'
  | 'officechair'
  | 'floorlamp'
  | 'camerastand'
  | 'drums'
  | 'chimney'
  | 'tv'
  | 'recordplayer'
  | 'cattoy'
  | 'sofa'
  | 'coffeetable'
  | 'diningtable'
  | 'chair'
  | 'chairup'
  | 'coffeecounter'
  | 'sink'
  | 'fridge'
  | 'kcounter'
  | 'khob'
  | 'litterbox'
  | 'nightstand'
  | 'alarmclock'
  | 'wardrobeside'
  | 'toilet'
  | 'basin'
  | 'shower'
  | 'bathmat'
  | 'cafetable'
  | 'cafechair'
  | 'xmastree'
  | 'bolorei'
  | 'sardines'
  | 'garland'
  | 'pumpkin'
  | 'balloons'

export const PROP_SIZES: Record<PropName, { w: number; h: number }> = {
  console: { w: 16, h: 32 }, // 0.5m deep × 1m long, against the side wall
  coatstand: { w: 16, h: 32 },
  boots: { w: 16, h: 16 },
  medalstand: { w: 16, h: 32 }, // a freestanding rail: medals and bib above, running shoes at its foot
  guestbook: { w: 16, h: 16 }, // a little stand with the visitors' book open on it
  bookshelfside: { w: 16, h: 32 }, // 1m of shelving along a side wall, seen from above
  wallmap: { w: 48, h: 32 }, // 1.5m × 1m pin map
  desk: { w: 48, h: 32 }, // 1.4m desk
  officechair: { w: 16, h: 16 },
  floorlamp: { w: 16, h: 32 },
  camerastand: { w: 16, h: 32 },
  drums: { w: 32, h: 32 }, // an electronic kit is about 1m × 1m
  chimney: { w: 64, h: 32 }, // a 2m terracotta chimney breast
  tv: { w: 64, h: 48 }, // 55" screen over a 2m media unit
  recordplayer: { w: 16, h: 32 }, // a 1m sideboard along a side wall with the turntable on top
  cattoy: { w: 16, h: 16 },
  sofa: { w: 64, h: 32 }, // 3-seater, 2m × 0.9m
  coffeetable: { w: 32, h: 16 },
  diningtable: { w: 48, h: 32 }, // seats four
  chair: { w: 16, h: 16 },
  chairup: { w: 16, h: 16 },
  coffeecounter: { w: 16, h: 32 },
  sink: { w: 16, h: 32 },
  fridge: { w: 16, h: 32 },
  kcounter: { w: 16, h: 16 }, // a 60cm unit along a side wall, seen from above
  khob: { w: 16, h: 16 },
  litterbox: { w: 16, h: 16 },
  nightstand: { w: 16, h: 16 },
  alarmclock: { w: 16, h: 16 }, // a nightstand with the alarm clock on it
  wardrobeside: { w: 16, h: 64 }, // 2m of wardrobe along a side wall, seen from above
  toilet: { w: 16, h: 32 },
  basin: { w: 16, h: 32 },
  shower: { w: 32, h: 32 }, // 1m × 1m tray
  bathmat: { w: 32, h: 16 },
  cafetable: { w: 16, h: 16 },
  cafechair: { w: 16, h: 16 },
  // Seasonal (see seasons.ts)
  xmastree: { w: 16, h: 32 }, // a 1.2m tree in a pot
  bolorei: { w: 16, h: 16 }, // laid on the dining table, over its centrepiece
  sardines: { w: 16, h: 16 }, // a plate on the balcony's café table
  garland: { w: 32, h: 16 }, // paper bunting along the top of a wall face
  pumpkin: { w: 16, h: 16 },
  balloons: { w: 16, h: 32 },
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
const WHITE_GOODS = { body: '#e8e4da', line: '#c9c3b5', steel: '#b8bcc4', steelDark: '#8a9099' }

function disc(ctx: Ctx, cx: number, cy: number, r: number, color: string) {
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.round(Math.sqrt(r * r - dy * dy))
    rect(ctx, cx - half, cy + dy, half * 2, 1, color)
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

/**
 * A 60cm kitchen unit along the west wall, seen from above: the dark worktop,
 * and the white doors along its front edge. `extra` puts a chopping board (1)
 * or a bowl of oranges (2) on the worktop.
 */
function drawSideCounter(ctx: Ctx, ox: number, oy: number, extra: number) {
  const r = (x: number, y: number, w: number, h: number, color: string) => rect(ctx, ox + x, oy + y, w, h, color)
  r(0, 0, 12, 16, '#5f5766')
  r(0, 0, 12, 1, '#7d7383')
  r(12, 0, 3, 16, WHITE_GOODS.body)
  r(12, 0, 1, 16, WHITE_GOODS.line)
  r(12, 15, 3, 1, WHITE_GOODS.line)
  r(13, 6, 1, 3, WHITE_GOODS.steelDark)
  r(15, 0, 1, 16, PALETTE.shadow)
  if (extra === 1) {
    r(2, 3, 7, 9, PALETTE.woodLight)
    r(2, 3, 7, 1, PALETTE.woodHighlight)
    r(4, 6, 4, 1, WHITE_GOODS.steel)
  } else if (extra === 2) {
    disc(ctx, ox + 6, oy + 8, 4, '#e8e4da')
    disc(ctx, ox + 5, oy + 7, 1, '#e07a3a')
    disc(ctx, ox + 7, oy + 9, 1, '#e07a3a')
    r(7, 6, 1, 1, '#4f7a3a')
  }
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
  const grid = GRID_PROPS[name]
  if (grid) {
    const variant = Array.isArray(grid) ? grid[Math.abs(Math.floor(oy / PROP_SIZES[name].h)) % grid.length] : grid
    return drawGrid(ctx, variant, ox, oy)
  }
  const r = (x: number, y: number, w: number, h: number, color: string) => rect(ctx, ox + x, oy + y, w, h, color)
  switch (name) {
    // --- Entrance hall --------------------------------------------------------
    case 'medalstand': {
      // The hall is open to the living room, so the medals hang from a freestanding rail.
      r(2, 2, 2, 26, PALETTE.woodDark)
      r(12, 2, 2, 26, PALETTE.woodDark)
      r(1, 2, 14, 2, PALETTE.woodDark)
      r(1, 2, 14, 1, PALETTE.woodLight)
      for (const [x, ribbon, drop] of [
        [4, '#3f6b8a', 7],
        [7, PALETTE.red, 5],
        [10, '#4f7a3a', 8],
      ] as const) {
        r(x, 4, 2, drop, ribbon)
        disc(ctx, ox + x + 1, oy + 6 + drop, 2, PALETTE.brass)
        r(x + 1, 5 + drop, 1, 1, PALETTE.brassLight)
      }
      r(4, 15, 8, 6, PALETTE.paper)
      r(5, 16, 6, 1, PALETTE.red)
      r(6, 18, 4, 2, PALETTE.ink)
      // Running shoes on the bottom rail.
      r(1, 24, 14, 1, PALETTE.woodDark)
      for (const x of [2, 8]) {
        r(x, 25, 6, 4, PALETTE.ink)
        r(x + 1, 26, 4, 2, '#3b7dd8')
        r(x + 1, 27, 4, 1, PALETTE.paper)
      }
      r(1, 30, 14, 1, PALETTE.shadow)
      break
    }
    case 'guestbook': {
      // Stand.
      r(3, 8, 10, 6, PALETTE.ink)
      r(4, 9, 8, 4, PALETTE.wood)
      r(4, 9, 8, 1, PALETTE.woodHighlight)
      r(4, 14, 2, 1, PALETTE.woodDark)
      r(10, 14, 2, 1, PALETTE.woodDark)
      // The book, open, with a red ribbon and a pen.
      r(1, 2, 14, 8, PALETTE.ink)
      r(2, 3, 6, 6, PALETTE.paper)
      r(8, 3, 5, 6, '#fbf6ea')
      r(7, 3, 1, 6, '#b5aa94')
      for (const y of [4, 6]) {
        r(3, y, 4, 1, '#b5aa94')
        r(9, y, 3, 1, '#b5aa94')
      }
      r(5, 9, 1, 3, PALETTE.red)
      r(13, 1, 1, 6, PALETTE.redDark)
      r(13, 7, 1, 1, PALETTE.brass)
      r(2, 15, 12, 1, PALETTE.shadow)
      break
    }
    // --- Study ----------------------------------------------------------------
    case 'wallmap': {
      r(2, 3, 46, 28, PALETTE.shadow)
      r(1, 2, 46, 28, PALETTE.ink)
      r(2, 3, 44, 26, PALETTE.woodDark)
      r(2, 3, 44, 1, PALETTE.woodHighlight)
      r(MAP_WALL.x, MAP_WALL.y, MAP_WALL.w, MAP_WALL.h, '#7fb0c9')
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
      // An electronic kit: mesh pads and rubber cymbals on a black rack, the
      // module blinking, headphones left on the throne.
      r(3, 8, 26, 2, '#2a2a30')
      r(3, 8, 2, 15, '#2a2a30')
      r(27, 8, 2, 15, '#2a2a30')
      for (const [cx, cy] of [
        [6, 6],
        [26, 5],
        [27, 16],
      ] as const) {
        disc(ctx, ox + cx, oy + cy, 4, '#1b1b20')
        disc(ctx, ox + cx, oy + cy, 3, '#3a3a44')
        r(cx, cy, 1, 1, '#1b1b20')
      }
      for (const [cx, cy, rad] of [
        [12, 11, 3],
        [20, 11, 3],
        [10, 18, 4],
        [23, 19, 3],
      ] as const) {
        disc(ctx, ox + cx, oy + cy, rad, PALETTE.ink)
        disc(ctx, ox + cx, oy + cy, rad - 1, '#55555f')
        r(cx - 1, cy - 1, 2, 1, '#6d6d78')
      }
      r(14, 3, 5, 5, PALETTE.ink)
      r(15, 4, 3, 2, '#26323f')
      r(16, 4, 1, 1, '#4cd964')
      r(13, 16, 6, 8, PALETTE.ink)
      r(14, 17, 4, 6, '#3a3a44')
      disc(ctx, ox + 16, oy + 28, 3, PALETTE.ink)
      disc(ctx, ox + 16, oy + 28, 2, '#3a3a44')
      r(13, 26, 7, 1, PALETTE.ink)
      r(13, 26, 1, 3, PALETTE.red)
      r(19, 26, 1, 3, PALETTE.red)
      break
    }
    // --- Living room ----------------------------------------------------------
    case 'chimney': {
      // A limewashed terracotta chimney breast standing proud of the wall, from
      // the ceiling down to its own skirting.
      r(1, 4, 62, 28, '#9c4a30')
      r(3, 4, 58, 24, '#b75d3c')
      r(3, 4, 2, 24, '#a65234')
      r(59, 4, 2, 24, '#a65234')
      for (const [x, y] of [
        [9, 8],
        [48, 6],
        [54, 19],
        [7, 22],
      ] as const) {
        r(x, y, 3, 1, '#c26a48')
      }
      r(3, 28, 58, 4, '#8c412a')
      r(3, 28, 58, 1, '#a65234')
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
    case 'recordplayer': {
      // Against the east wall, seen from above: a walnut sideboard with the
      // turntable spinning on top and record sleeves along its front edge.
      r(3, 0, 13, 32, PALETTE.ink)
      r(4, 1, 12, 30, PALETTE.wood)
      r(4, 1, 12, 1, PALETTE.woodLight)
      r(5, 3, 10, 12, '#2a2a30')
      r(5, 3, 10, 1, '#3a3a44')
      disc(ctx, ox + 10, oy + 9, 4, '#141217')
      disc(ctx, ox + 10, oy + 9, 3, '#24222a')
      disc(ctx, ox + 10, oy + 9, 1, PALETTE.red)
      r(13, 4, 1, 6, WHITE_GOODS.steel)
      r(12, 10, 1, 1, WHITE_GOODS.steel)
      r(6, 13, 1, 1, '#4cd964')
      let y = 17
      let i = 0
      for (const color of ['#c9a227', '#3f6b8a', PALETTE.paper, '#8e2f35', '#4f7a3a', '#e07a3a']) {
        r(3, y, 3, 2, color)
        y += 2 + (i++ % 2)
      }
      r(8, 20, 5, 6, PALETTE.paper)
      r(9, 22, 3, 1, '#3f6b8a')
      r(2, 31, 14, 1, PALETTE.shadow)
      break
    }
    case 'cattoy': {
      // Zeno's felt mouse, tail and all, and a jingly ball.
      r(4, 8, 5, 3, '#9a8f80')
      r(4, 8, 5, 1, '#b5aa94')
      r(8, 7, 1, 1, '#e8a0a8')
      r(3, 10, 1, 1, '#6d6359')
      r(2, 11, 1, 1, '#6d6359')
      r(4, 11, 4, 1, PALETTE.shadow)
      disc(ctx, ox + 12, oy + 11, 2, PALETTE.red)
      r(11, 10, 1, 1, '#e05a48')
      break
    }
    case 'diningtable': {
      r(1, 1, 46, 26, PALETTE.ink)
      r(2, 2, 44, 22, PALETTE.wood)
      r(2, 2, 44, 1, PALETTE.woodLight)
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
      r(2, 24, 44, 3, PALETTE.woodDark)
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
    case 'coffeecounter': {
      drawKitchenUnit(ctx, ox, oy)
      r(4, 9, 8, 8, PALETTE.ink)
      r(5, 10, 6, 6, '#2a2a30')
      r(6, 13, 3, 1, '#c0392b')
      r(9, 15, 2, 2, PALETTE.paper)
      break
    }
    case 'sink': {
      drawKitchenUnit(ctx, ox, oy)
      r(7, 11, 2, 5, WHITE_GOODS.steel)
      r(3, 16, 10, 3, WHITE_GOODS.steel)
      r(4, 17, 8, 1, WHITE_GOODS.steelDark)
      break
    }
    case 'kcounter':
      drawSideCounter(ctx, ox, oy, [0, 1, 2, 1][Math.floor(oy / 16) % 4])
      break
    case 'khob': {
      drawSideCounter(ctx, ox, oy, 0)
      r(1, 1, 9, 14, '#1b1b20')
      for (const [cx, cy] of [
        [3, 4],
        [8, 4],
        [3, 11],
        [8, 11],
      ] as const) {
        disc(ctx, ox + cx, oy + cy, 2, '#3a3a44')
        r(cx, cy, 1, 1, '#1b1b20')
      }
      r(5, 7, 1, 1, '#e05a48')
      break
    }
    case 'litterbox': {
      // An open tray of sand, so whatever Zeno leaves in it is plain to see.
      r(1, 3, 14, 12, PALETTE.ink)
      r(2, 4, 12, 10, '#7fa7bd')
      r(2, 4, 12, 1, '#9fc3d6')
      r(3, 5, 10, 8, '#e3d6b4')
      for (const [x, y] of [
        [4, 6],
        [8, 7],
        [11, 6],
        [5, 10],
        [10, 11],
        [7, 9],
      ] as const) {
        r(x, y, 1, 1, '#cbbd96')
      }
      r(1, 15, 14, 1, PALETTE.shadow)
      break
    }
    // --- Bedroom ----------------------------------------------------------------
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
    case 'wardrobeside': {
      // Against the west wall, seen from above: the walnut top, and four
      // doors along its front edge with brass pulls.
      r(0, 0, 13, 64, PALETTE.ink)
      r(0, 1, 10, 62, PALETTE.woodDark)
      r(0, 1, 10, 1, PALETTE.wood)
      r(10, 1, 3, 62, PALETTE.wood)
      for (const y of [16, 32, 48]) r(10, y, 3, 1, PALETTE.ink)
      for (const y of [6, 22, 38, 54]) r(11, y, 1, 3, PALETTE.brass)
      r(3, 10, 4, 4, PALETTE.paper)
      r(13, 1, 1, 62, PALETTE.shadow)
      break
    }
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
      // The mirror cabinet hangs high on the wall, over a glass shelf: two mirrored doors.
      r(2, -5, 12, 10, PALETTE.ink)
      r(3, -4, 10, 8, WHITE_GOODS.steel)
      r(4, -3, 8, 6, '#a9d4e6')
      r(4, 2, 8, 1, '#93c2d6')
      r(5, -2, 2, 1, '#e8f6fc')
      r(5, -1, 1, 1, '#e8f6fc')
      r(10, 0, 1, 1, '#e8f6fc')
      r(11, -1, 1, 1, '#e8f6fc')
      r(8, -3, 1, 6, WHITE_GOODS.steelDark)
      r(3, 7, 10, 1, '#dfe6ec')
      r(3, 8, 10, 1, WHITE_GOODS.steelDark)
      // The basin set in its counter, a small mixer tap over the bowl.
      r(0, 13, 16, 8, PALETTE.ink)
      r(1, 14, 14, 6, '#f4f6f8')
      r(3, 15, 10, 4, '#dfe6ec')
      r(3, 15, 1, 1, '#f4f6f8')
      r(12, 15, 1, 1, '#f4f6f8')
      r(3, 18, 1, 1, '#f4f6f8')
      r(12, 18, 1, 1, '#f4f6f8')
      r(4, 17, 8, 2, '#c9d3dc')
      r(7, 17, 2, 1, WHITE_GOODS.steelDark)
      r(1, 19, 14, 1, '#dfe6ec')
      r(7, 13, 2, 1, WHITE_GOODS.steelDark)
      r(7, 14, 1, 1, WHITE_GOODS.steel)
      r(7, 15, 1, 1, WHITE_GOODS.steelDark)
      // The cabinet under it: two doors with brass knobs, on a plinth.
      r(0, 21, 16, 10, PALETTE.ink)
      r(1, 21, 14, 9, '#d2b48c')
      r(1, 21, 14, 1, '#e0c8a2')
      r(2, 22, 5, 7, '#c2a27a')
      r(9, 22, 5, 7, '#c2a27a')
      r(3, 23, 3, 5, '#d2b48c')
      r(10, 23, 3, 5, '#d2b48c')
      r(7, 22, 2, 7, '#a8946f')
      r(6, 25, 1, 2, PALETTE.brass)
      r(9, 25, 1, 2, PALETTE.brass)
      r(1, 29, 14, 1, '#8f7a58')
      r(0, 31, 16, 1, PALETTE.shadow)
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
    // --- Balcony ---------------------------------------------------------------
    case 'cafetable': {
      // A round iron café table with a bica on it.
      disc(ctx, ox + 8, oy + 8, 6, PALETTE.ink)
      disc(ctx, ox + 8, oy + 8, 5, '#3a3d46')
      r(4, 6, 6, 1, '#4a4f5c')
      r(7, 7, 3, 2, PALETTE.paper)
      r(8, 8, 1, 1, '#5a3a28')
      break
    }
    case 'cafechair': {
      // A folding iron chair, its back to the street.
      r(4, 3, 8, 8, PALETTE.ink)
      r(5, 4, 6, 6, '#3a3d46')
      r(4, 11, 8, 2, PALETTE.ink)
      r(5, 11, 6, 1, '#4a4f5c')
      r(3, 13, 10, 1, PALETTE.shadow)
      break
    }
    // --- Seasonal ----------------------------------------------------------------
    case 'xmastree': {
      // Three tiers of fir with a star on top, baubles and a terracotta pot.
      for (const [y, half, rows] of [
        [3, 2, 6],
        [8, 3, 7],
        [14, 4, 9],
      ] as const) {
        for (let i = 0; i < rows; i++) {
          const w = Math.min(half + Math.floor(i / 2), 7)
          r(8 - w, y + i, w * 2, 1, i === rows - 1 ? '#1f4a33' : '#2f6b45')
          r(8 - w, y + i, 1, 1, '#1f4a33')
        }
      }
      r(7, 7, 1, 2, '#4f9a64')
      r(6, 13, 1, 2, '#4f9a64')
      for (const [x, y, color] of [
        [6, 6, PALETTE.red],
        [10, 10, PALETTE.brassLight],
        [5, 12, '#6b8aa8'],
        [9, 16, PALETTE.red],
        [4, 19, PALETTE.brassLight],
        [11, 20, '#6b8aa8'],
        [7, 21, PALETTE.red],
      ] as const)
        r(x, y, 1, 1, color)
      r(7, 0, 2, 3, PALETTE.brass)
      r(6, 1, 4, 1, PALETTE.brassLight)
      r(7, 23, 2, 2, PALETTE.woodDark)
      r(4, 25, 8, 5, '#a8553a')
      r(4, 25, 8, 1, '#c46a4a')
      r(3, 30, 10, 1, PALETTE.shadow)
      break
    }
    case 'bolorei': {
      // The crown-shaped Christmas cake: a golden ring studded with candied fruit.
      disc(ctx, ox + 8, oy + 12, 5, '#a8692e')
      disc(ctx, ox + 8, oy + 11, 5, '#d39a4e')
      disc(ctx, ox + 8, oy + 11, 2, PALETTE.wood)
      for (const [x, y, color] of [
        [5, 8, PALETTE.red],
        [10, 8, '#4f9a64'],
        [12, 11, '#e8c95a'],
        [4, 12, '#4f9a64'],
        [8, 14, PALETTE.red],
        [11, 14, '#f4ecd8'],
      ] as const)
        r(x, y, 1, 1, color)
      break
    }
    case 'sardines': {
      // Two grilled sardines on a slice of bread, the June way.
      r(3, 4, 10, 9, '#b5803e')
      r(4, 5, 8, 7, '#e3b874')
      for (const y of [5, 9]) {
        r(2, y, 9, 2, '#a9b4bd')
        r(2, y, 9, 1, '#5a6672')
        r(3, y + 1, 1, 1, PALETTE.ink)
        r(11, y - 1, 2, 1, '#5a6672')
        r(11, y + 2, 2, 1, '#5a6672')
        r(6, y, 1, 2, '#3a3340')
      }
      break
    }
    case 'garland': {
      // Paper bunting: a string sagging between two nails, flags in arraial colours.
      const colors = ['#e05a48', '#e8c95a', '#4f9a64', '#6b8aa8', '#d97aa8']
      for (let x = 0; x < 32; x++) {
        const y = 2 + Math.round(Math.sin((x / 31) * Math.PI) * 3)
        r(x, y, 1, 1, '#f4ecd8')
        if (x % 6 === 2 && x < 30) {
          const color = colors[(x / 6) % colors.length | 0]
          r(x, y + 1, 3, 2, color)
          r(x + 1, y + 3, 1, 1, color)
        }
      }
      break
    }
    case 'pumpkin': {
      r(3, 14, 11, 1, PALETTE.shadow)
      disc(ctx, ox + 8, oy + 10, 5, '#c4621e')
      r(4, 6, 8, 9, '#e07a2a')
      r(7, 6, 2, 9, '#c4621e')
      r(7, 3, 2, 3, '#4f7a3a')
      r(9, 3, 2, 1, '#4f7a3a')
      // A jack-o'-lantern face, lit from inside.
      r(5, 8, 2, 2, '#ffd56a')
      r(9, 8, 2, 2, '#ffd56a')
      r(5, 12, 6, 1, '#ffd56a')
      r(6, 11, 1, 1, '#ffd56a')
      r(9, 11, 1, 1, '#ffd56a')
      break
    }
    case 'balloons': {
      // A bunch of balloons tied to a weight on the floor.
      for (const [x, y, color, light] of [
        [5, 4, '#e05a48', '#f08a7a'],
        [11, 5, '#6b8aa8', '#9cbad4'],
        [8, 10, '#e8c95a', '#f6e39a'],
      ] as const) {
        disc(ctx, ox + x, oy + y, 3, color)
        r(x - 2, y - 2, 1, 2, light)
        r(x, y + 4, 1, 1, color)
      }
      r(8, 14, 1, 13, '#b5aa94')
      r(5, 7, 1, 7, '#b5aa94')
      r(11, 9, 1, 5, '#b5aa94')
      r(6, 13, 5, 1, '#b5aa94')
      r(6, 27, 5, 3, PALETTE.ink)
      r(7, 27, 3, 1, '#4a4458')
      r(5, 30, 7, 1, PALETTE.shadow)
      break
    }
  }
}

// ---------------------------------------------------------------------------
// Interaction cues

const OUTLINE_COLOR = '#fff3c4'

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
// Zeno, the tuxedo cat

/** Zeno faces down, up or side-on; the game flips side frames to face left. */
export type Facing = 'down' | 'up' | 'side'
export const FACINGS: Facing[] = ['down', 'up', 'side']

export const CAT_FRAMES = ['down-idle', 'down-a', 'down-b', 'up-idle', 'up-a', 'up-b', 'side-idle', 'side-a', 'side-b', 'sit'] as const
export type CatFrame = (typeof CAT_FRAMES)[number]

const CAT = { coat: '#1f1d24', sheen: '#3a3742', white: '#f4f1ea', eye: '#b7d35a', nose: '#e8a0a8' }

/** One 16x16 frame of Zeno: black coat, white bib, muzzle and socks. Side frames face right. */
export function drawCat(ctx: Ctx, ox: number, oy: number, frame: CatFrame, costume?: 'witch') {
  const r = (x: number, y: number, w: number, h: number, color: string) => rect(ctx, ox + x, oy + y, w, h, color)
  const [facing, step] = frame === 'sit' ? ['sit', 'idle'] : frame.split('-')
  const stride = step === 'a' ? 1 : step === 'b' ? -1 : 0
  if (facing === 'side') {
    r(3, 15, 11, 1, PALETTE.shadow)
    // Tail up and curling over at the tip.
    r(2, 9, 2, 1, CAT.coat)
    r(1, 5, 1, 4, CAT.coat)
    r(2, 4, 1, 1, CAT.coat)
    r(3, 8, 8, 5, CAT.coat)
    r(4, 8, 6, 1, CAT.sheen)
    r(10, 5, 4, 4, CAT.coat)
    r(10, 4, 1, 1, CAT.coat)
    r(13, 4, 1, 1, CAT.coat)
    r(14, 7, 1, 1, CAT.coat)
    r(13, 7, 1, 2, CAT.white)
    r(14, 8, 1, 1, CAT.white)
    r(14, 7, 1, 1, CAT.nose)
    r(12, 6, 1, 1, CAT.eye)
    r(10, 9, 2, 3, CAT.white)
    // Legs swing in opposite pairs; socks are white.
    for (const [x, swing] of [
      [4, -stride],
      [6, stride],
      [9, stride],
      [11, -stride],
    ] as const) {
      r(x + swing, 13, 1, 1, CAT.coat)
      r(x + swing, 14, 1, 1, CAT.white)
    }
  } else if (facing === 'down') {
    r(4, 15, 8, 1, PALETTE.shadow)
    r(12, 9, 1, 3, CAT.coat)
    r(13, 8, 1, 2, CAT.coat)
    r(5, 9, 6, 5, CAT.coat)
    r(6, 9, 4, 3, CAT.white)
    r(4, 4, 8, 5, CAT.coat)
    r(4, 3, 2, 1, CAT.coat)
    r(10, 3, 2, 1, CAT.coat)
    r(5, 4, 1, 1, CAT.sheen)
    r(7, 6, 2, 3, CAT.white)
    r(6, 6, 1, 1, CAT.eye)
    r(9, 6, 1, 1, CAT.eye)
    r(7, 7, 2, 1, CAT.nose)
    r(5, 13 + Math.max(0, stride), 2, 2 - Math.max(0, stride), CAT.white)
    r(9, 13 + Math.max(0, -stride), 2, 2 - Math.max(0, -stride), CAT.white)
  } else if (facing === 'up') {
    r(4, 15, 8, 1, PALETTE.shadow)
    r(5, 9, 6, 5, CAT.coat)
    r(6, 9, 4, 1, CAT.sheen)
    r(4, 4, 8, 5, CAT.coat)
    r(4, 3, 2, 1, CAT.coat)
    r(10, 3, 2, 1, CAT.coat)
    r(5, 5, 6, 1, CAT.sheen)
    r(11, 7, 1, 5, CAT.coat)
    r(12, 6, 1, 1, CAT.coat)
    r(5, 14, 2, 1, stride > 0 ? CAT.coat : CAT.white)
    r(9, 14, 2, 1, stride < 0 ? CAT.coat : CAT.white)
  } else {
    // Sitting side-on, tail wrapped round the front paws.
    r(3, 15, 10, 1, PALETTE.shadow)
    r(5, 8, 5, 6, CAT.coat)
    r(4, 11, 2, 3, CAT.coat)
    r(5, 8, 2, 1, CAT.sheen)
    r(8, 3, 4, 4, CAT.coat)
    r(8, 2, 1, 1, CAT.coat)
    r(11, 2, 1, 1, CAT.coat)
    r(12, 5, 1, 1, CAT.nose)
    r(11, 5, 1, 2, CAT.white)
    r(10, 4, 1, 1, CAT.eye)
    r(9, 7, 2, 4, CAT.white)
    r(9, 13, 3, 1, CAT.white)
    r(2, 14, 8, 1, CAT.coat)
    r(2, 13, 1, 1, CAT.coat)
  }
  if (costume === 'witch') {
    // A tiny witch's hat for Halloween, its brim resting between his ears.
    const [cx, top] = facing === 'side' ? [12, -1] : facing === 'sit' ? [10, -3] : [8, -2]
    const hat = (x: number, y: number, w: number, color: string) => {
      if (top + y >= 0) r(x, top + y, w, 1, color)
    }
    hat(cx, 1, 1, '#5b3a7a')
    hat(cx - 1, 2, 2, '#5b3a7a')
    hat(cx - 2, 3, 4, '#5b3a7a')
    hat(cx - 2, 4, 4, PALETTE.brass)
    hat(cx - 4, 5, 8, '#3f2756')
  }
}

/** A 7x6 heart that floats up when Zeno is petted. */
export function drawHeart(ctx: Ctx) {
  const rows = ['.kk.kk.', 'krrkrrk', 'krrrrrk', '.krrrk.', '..krk..', '...k...']
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === 'k') rect(ctx, x, y, 1, 1, PALETTE.ink)
      if (row[x] === 'r') rect(ctx, x, y, 1, 1, '#e05a68')
    }
  })
}

/** Two clumps in the litter sand, drawn over the tray until the box is cleaned. */
export function drawPoop(ctx: Ctx) {
  for (const [x, y] of [
    [5, 7],
    [9, 9],
  ] as const) {
    rect(ctx, x, y, 3, 2, '#5a3a24')
    rect(ctx, x + 1, y - 1, 1, 1, '#5a3a24')
    rect(ctx, x, y, 1, 1, '#7a5234')
    rect(ctx, x, y + 2, 3, 1, 'rgba(20, 14, 30, 0.2)')
  }
}

/** Three wavy fumes, 9x8, that rise off Zeno's litter box until it's cleaned. */
export function drawStink(ctx: Ctx) {
  const rows = ['.g..g..g.', 'g..g..g..', '.g..g..g.', '..g..g..g', '.g..g..g.', 'g..g..g..', '.g..g..g.', '..g..g..g']
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === 'g') rect(ctx, x, y, 1, 1, '#8fa35a')
  })
}
