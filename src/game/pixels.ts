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
  brass: '#c9a227',
  brassLight: '#e8c95a',
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
  powderblue: { base: '#d4e4f0', accent: '#c6d9e8', board: '#e0d5c2' },
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
  } else if (kind === 'powderblue') {
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

const DOOR_PAINT = {
  face: '#efe7d6',
  panel: '#e6dcc7',
  shade: '#cdc2ab',
  light: '#fbf7ee',
  gap: '#2f2a3a',
  steel: '#b8bcc4',
  steelDark: '#8a9099',
}

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
  r(1, 4, 1, 3, DOOR_PAINT.steelDark)
  r(1, 20, 1, 3, DOOR_PAINT.steelDark)
  // A round rose and a lever reaching towards the hinges, pressed down in a rattle, over a keyhole.
  r(23, 13, 2, 2, DOOR_PAINT.steelDark)
  if (handleDown) {
    r(21, 14, 2, 1, DOOR_PAINT.steel)
    r(19, 15, 2, 1, DOOR_PAINT.steel)
  } else {
    r(19, 13, 4, 1, DOOR_PAINT.steel)
    r(19, 14, 4, 1, DOOR_PAINT.steelDark)
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

/** Furniture draws from its grid sprite (sprites/props.ts); a prop with several picks one by where it stands. */
export function drawProp(ctx: Ctx, ox: number, oy: number, name: PropName) {
  const grid = GRID_PROPS[name]
  const sprite = Array.isArray(grid) ? grid[Math.abs(Math.floor(oy / PROP_SIZES[name].h)) % grid.length] : grid
  drawGrid(ctx, sprite, ox, oy)
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
