import * as Phaser from 'phaser'
import type { Weather } from '@/lib/weather'
import { FLOOR_PLAN, MAP_HEIGHT, MAP_WIDTH, TILE, cellAt, type Point } from './layout'
import { drawFloor, drawWallCap, hash, rect, type Ctx } from './pixels'

/**
 * The Lisbon block around the flat, baked once under the house: the
 * neighbours' terracotta roofs on either side, the back façades (azulejos,
 * painted plaster, shutters, laundry and iron wall lanterns) and a calçada
 * courtyard with an orange tree behind. Gulls glide over by day when the sky
 * is calm.
 */

/** How far the block reaches past the flat, in tiles. The camera shows a little of the courtyard. */
const MARGIN = { left: 22, right: 22, top: 6, bottom: 12 }
/** Rows of courtyard below the flat that the camera may scroll down to. */
export const COURTYARD_VIEW_ROWS = 4
/** The last courtyard row; the next street's roofs start after it. */
const COURT_END = MAP_HEIGHT + 5
const BUILDING_WIDTH = 7
const BACKGROUND = '#141019'

const IRON = '#2b2a33'
const STONE = { base: '#d8d0bd', line: '#c4bba6' }

/** Telha roofs, each neighbour a slightly different batch. */
const ROOFS = [
  { base: '#b8583c', dark: '#8f3f2b', light: '#d07454' },
  { base: '#a94f37', dark: '#7f3826', light: '#c56a4c' },
  { base: '#c0673f', dark: '#94492c', light: '#d8835a' },
]

type Facade =
  | { kind: 'plaster'; base: string; shade: string; shutter: string }
  | { kind: 'azulejo'; base: string; tile: string; shutter: string }

/** The flat's own back wall is green-and-white azulejos. */
const HOUSE_FACADE: Facade = {
  kind: 'azulejo',
  base: '#e6efe9',
  tile: '#7fae98',
  shutter: '#6b4630',
}
const NEIGHBOUR_FACADES: Facade[] = [
  { kind: 'plaster', base: '#e7a99a', shade: '#d4948a', shutter: '#2f6b4f' },
  { kind: 'plaster', base: '#f0d68a', shade: '#dcc073', shutter: '#3f6fae' },
  { kind: 'azulejo', base: '#eef2f7', tile: '#86a3cc', shutter: '#2f6b4f' },
  { kind: 'plaster', base: '#f3efe6', shade: '#ddd6c6', shutter: '#8e2a20' },
  { kind: 'azulejo', base: '#f4ecd8', tile: '#d8bd6c', shutter: '#2f6b4f' },
]

/** Façade tiles with an iron lantern on them, each lit at night. */
const LAMP_COLUMNS = [-19, -12, -5, 16, 25, 32, 39]

/** World-pixel centres of the wall lanterns' glass, for the night glow. */
export const EXTERIOR_LAMPS: Point[] = LAMP_COLUMNS.map((tx) => ({
  x: tx * TILE + 8,
  y: (MAP_HEIGHT - 2) * TILE + 16 + 8,
}))

/**
 * The building's shared stairwell behind the front door, walls included: a
 * cut-away landing like the flat's rooms, which the back wall wraps round.
 */
const FRONT_DOOR = FLOOR_PLAN[MAP_HEIGHT - 3].indexOf('F')
const STAIRWELL = { x0: FRONT_DOOR - 2, x1: FRONT_DOOR + 2, y0: MAP_HEIGHT - 2, y1: MAP_HEIGHT + 1 }

function inStairwell(tx: number, ty: number) {
  return tx >= STAIRWELL.x0 && tx <= STAIRWELL.x1 && ty >= STAIRWELL.y0 && ty <= STAIRWELL.y1
}

/** Open to the sky: neither the flat nor the stairwell. */
export function isOutdoors(tx: number, ty: number) {
  return cellAt(tx, ty) === ' ' && !inStairwell(tx, ty)
}

/** The flat's back windows, as their left column and the row of the wall top they sit under. */
const HOUSE_WINDOWS = findBackWindows()

interface Building {
  /** Westmost and eastmost tile columns. */
  x0: number
  x1: number
  roof: (typeof ROOFS)[number]
  facade: Facade
  /** The row its roof ridge runs along. */
  ridge: number
}

/** The lowest row of the flat in each column; neighbours line up with the kitchen and study. */
function southEdge(tx: number): number {
  if (tx >= STAIRWELL.x0 && tx <= STAIRWELL.x1) return STAIRWELL.y1
  if (tx < 0 || tx >= MAP_WIDTH) return MAP_HEIGHT - 3
  for (let ty = MAP_HEIGHT - 1; ty >= 0; ty--) if (FLOOR_PLAN[ty][tx] !== ' ') return ty
  return MAP_HEIGHT - 3
}

function findBackWindows(): { x: number; y: number }[] {
  const windows: { x: number; y: number }[] = []
  for (let tx = 0; tx < MAP_WIDTH - 1; tx++) {
    const ty = southEdge(tx)
    if (cellAt(tx, ty) === 'W' && cellAt(tx - 1, ty) !== 'W') windows.push({ x: tx, y: ty })
  }
  return windows
}

/**
 * The building a column belongs to. The flat's own façade spans the map;
 * roof cells inside the map (beside the balcony, above the living room)
 * belong to the nearest neighbour.
 */
function buildingAt(tx: number, forRoof = false): Building | null {
  if (tx >= 0 && tx < MAP_WIDTH && !forRoof) return null
  const side = tx < MAP_WIDTH / 2 ? -1 : 1
  const index =
    side < 0 ? Math.floor(Math.max(0, -tx - 1) / BUILDING_WIDTH) : Math.floor(Math.max(0, tx - MAP_WIDTH) / BUILDING_WIDTH)
  const x0 = side < 0 ? -(index + 1) * BUILDING_WIDTH : MAP_WIDTH + index * BUILDING_WIDTH
  const seed = side * 31 + index * 7
  return {
    x0,
    x1: x0 + BUILDING_WIDTH - 1,
    roof: ROOFS[Math.floor(hash(seed, 3) * ROOFS.length)],
    facade: NEIGHBOUR_FACADES[(index * 2 + (side > 0 ? 1 : 0)) % NEIGHBOUR_FACADES.length],
    ridge: 5 + Math.floor(hash(seed, 11) * 7),
  }
}

/** A building of the next street over, behind the courtyard. */
function backBuildingAt(tx: number): Building {
  const index = Math.floor((tx + MARGIN.left) / 6)
  return {
    x0: index * 6 - MARGIN.left,
    x1: index * 6 - MARGIN.left + 5,
    roof: ROOFS[Math.floor(hash(index, 17) * ROOFS.length)],
    facade: NEIGHBOUR_FACADES[0],
    ridge: COURT_END + 3 + Math.floor(hash(index, 23) * 2),
  }
}

// ---------------------------------------------------------------------------
// Painting

/** Paints the whole block onto `ctx`, whose origin is the top-left of the exterior texture. */
export function paintExterior(ctx: Ctx) {
  ctx.imageSmoothingEnabled = false
  ctx.save()
  ctx.translate(MARGIN.left * TILE, MARGIN.top * TILE)
  for (let ty = -MARGIN.top; ty < MAP_HEIGHT + MARGIN.bottom; ty++) {
    for (let tx = -MARGIN.left; tx < MAP_WIDTH + MARGIN.right; tx++) {
      if (cellAt(tx, ty) !== ' ') continue
      const ox = tx * TILE
      const oy = ty * TILE
      const edge = southEdge(tx)
      if (inStairwell(tx, ty)) {
        const wall = tx === STAIRWELL.x0 || tx === STAIRWELL.x1 || ty === STAIRWELL.y1
        if (wall) drawWallCap(ctx, ox, oy)
        else drawFloor(ctx, ox, oy, 'balcony', tx, ty)
      } else if (ty < 0) drawStreetBelow(ctx, ox, oy, tx, ty)
      else if (ty <= edge) drawRoof(ctx, ox, oy, buildingAt(tx, true)!, tx, ty, edge)
      else if (ty <= edge + 2)
        drawFacade(ctx, ox, oy, buildingAt(tx)?.facade ?? HOUSE_FACADE, ty === edge + 1 ? 'upper' : 'lower', tx, ty)
      else if (ty <= COURT_END) drawCalcada(ctx, ox, oy, ty === edge + 3)
      else drawRoof(ctx, ox, oy, backBuildingAt(tx), tx, ty, Infinity, COURT_END + 1)
    }
  }
  drawRoofFeatures(ctx)
  drawFacadeWindows(ctx)
  drawLanding(ctx)
  drawLaundry(ctx)
  for (const tx of LAMP_COLUMNS) drawWallLantern(ctx, tx * TILE + 8, (MAP_HEIGHT - 2) * TILE + 16 + 5)
  drawCourtyard(ctx)
  ctx.restore()
  fadeEdges(ctx)
}

/** North of the block the street is a narrow, shaded gap far below. */
function drawStreetBelow(ctx: Ctx, ox: number, oy: number, tx: number, ty: number) {
  rect(ctx, ox, oy, 16, 16, '#221c2b')
  if (ty === -1) rect(ctx, ox, oy + 13, 16, 3, 'rgba(0,0,0,0.25)')
  for (let i = 0; i < 3; i++) {
    if (hash(tx * 3 + i, ty) > 0.6)
      rect(ctx, ox + Math.floor(hash(tx, ty * 5 + i) * 15), oy + Math.floor(hash(ty, tx * 7 + i) * 15), 1, 1, '#3a3344')
  }
}

/**
 * Curved terracotta tiles in courses, the shaded slope above the ridge and
 * the sunny one below, a party wall between neighbours and a gutter at the eave.
 */
function drawRoof(ctx: Ctx, ox: number, oy: number, building: Building, tx: number, ty: number, eave: number, top = -Infinity) {
  const { roof, ridge } = building
  rect(ctx, ox, oy, 16, 16, roof.base)
  for (let course = 0; course < 4; course++) {
    const y = oy + course * 4
    const shift = (course + ty) % 2 ? 2 : 0
    for (let x = shift; x < 16; x += 4) {
      rect(ctx, ox + x, y, 1, 3, roof.light)
      rect(ctx, ox + x + 2, y + 3, 2, 1, roof.dark)
    }
    rect(ctx, ox, y + 3, 16, 1, 'rgba(60,20,10,0.25)')
  }
  if (ty < ridge) rect(ctx, ox, oy, 16, 16, 'rgba(40,15,25,0.16)')
  if (ty === ridge) {
    rect(ctx, ox, oy, 16, 3, '#d98a66')
    rect(ctx, ox, oy + 3, 16, 1, roof.dark)
    for (let x = (tx * 16) % 6; x < 16; x += 6) rect(ctx, ox + x, oy, 1, 3, roof.dark)
  }
  if (ty === top) {
    rect(ctx, ox, oy, 16, 2, STONE.base)
    rect(ctx, ox, oy + 2, 16, 1, 'rgba(0,0,0,0.25)')
  }
  if (tx === building.x0) {
    rect(ctx, ox, oy, 2, 16, STONE.base)
    rect(ctx, ox + 2, oy, 1, 16, 'rgba(0,0,0,0.2)')
  }
  if (ty === eave) {
    rect(ctx, ox, oy + 13, 16, 2, '#7d7a80')
    rect(ctx, ox, oy + 15, 16, 1, '#5c5862')
  }
}

/** A back wall seen from the courtyard: eave tiles on top, a stone plinth at the foot. */
function drawFacade(ctx: Ctx, ox: number, oy: number, facade: Facade, part: 'upper' | 'lower', tx: number, ty: number) {
  rect(ctx, ox, oy, 16, 16, facade.base)
  if (facade.kind === 'azulejo') {
    for (let y = 0; y < 16; y += 4) {
      for (let x = 0; x < 16; x += 4) {
        rect(ctx, ox + x + 1, oy + y + 1, 2, 2, facade.tile)
        rect(ctx, ox + x, oy + y, 4, 1, 'rgba(0,0,0,0.04)')
      }
    }
  } else {
    for (let i = 0; i < 6; i++) {
      if (hash(tx * 6 + i, ty) > 0.5)
        rect(ctx, ox + Math.floor(hash(tx + i, ty * 3) * 15), oy + Math.floor(hash(ty + i, tx * 5) * 15), 2, 1, facade.shade)
    }
  }
  if (part === 'upper') {
    rect(ctx, ox, oy, 16, 3, '#a14a33')
    for (let x = (tx * 16) % 3; x < 16; x += 3) rect(ctx, ox + x, oy + 2, 1, 1, '#7a3524')
    rect(ctx, ox, oy + 3, 16, 1, '#f3efe6')
    rect(ctx, ox, oy + 4, 16, 1, 'rgba(0,0,0,0.12)')
  } else {
    rect(ctx, ox, oy + 13, 16, 3, STONE.base)
    rect(ctx, ox, oy + 13, 16, 1, STONE.line)
  }
  const building = buildingAt(tx)
  if (building && tx === building.x0) rect(ctx, ox, oy + 4, 2, 9, 'rgba(0,0,0,0.12)')
}

/**
 * Calçada portuguesa: small white limestone setts with bands of black basalt
 * waving through them (the "mar largo" of the Rossio).
 */
function drawCalcada(ctx: Ctx, ox: number, oy: number, underWall: boolean) {
  rect(ctx, ox, oy, 16, 16, '#bdb6a6')
  for (let y = 0; y < 16; y += 3) {
    for (let x = (y / 3) % 2 ? 1 : 0; x < 16; x += 3) {
      const wx = ox + x
      const wy = oy + y
      const wave = (wy + 5 * Math.sin((wx * Math.PI) / 24)) % 22
      const dark = wave >= 0 && wave < 5
      const light = hash(wx, wy) > 0.5
      rect(ctx, wx, wy, 2, 2, dark ? (light ? '#4a4850' : '#3b3a40') : light ? '#ece8dd' : '#e2ddd0')
    }
  }
  if (underWall) rect(ctx, ox, oy, 16, 3, 'rgba(20,14,30,0.18)')
}

/** Chimneys and the odd skylight on the neighbours' roofs, and a gull resting on one chimney. */
function drawRoofFeatures(ctx: Ctx) {
  for (let index = 0; index < 4; index++) {
    for (const side of [-1, 1]) {
      const b = buildingAt(side < 0 ? -1 - index * BUILDING_WIDTH : MAP_WIDTH + index * BUILDING_WIDTH, true)!
      const seed = side * 13 + index
      const cx = (b.x0 + 1 + Math.floor(hash(seed, 41) * 4)) * TILE + 3
      const cy = (b.ridge - 1) * TILE + 6
      drawChimney(ctx, cx, cy)
      if (index === 0 && side > 0) drawRestingGull(ctx, cx + 1, cy - 3)
      if (hash(seed, 43) > 0.4) {
        const sx = (b.x0 + 1 + Math.floor(hash(seed, 47) * 5)) * TILE + 2
        const sy = (b.ridge + 3) * TILE + 4
        rect(ctx, sx, sy, 12, 9, '#e9e3d6')
        rect(ctx, sx + 1, sy + 1, 10, 7, '#5d7f99')
        rect(ctx, sx + 2, sy + 2, 3, 1, '#9cc0d6')
        rect(ctx, sx, sy + 9, 12, 1, 'rgba(0,0,0,0.25)')
      }
    }
  }
}

function drawChimney(ctx: Ctx, x: number, y: number) {
  rect(ctx, x + 2, y + 10, 10, 3, 'rgba(30,10,10,0.25)')
  rect(ctx, x, y, 10, 11, '#ece6d8')
  rect(ctx, x + 7, y, 3, 11, '#cfc6b3')
  rect(ctx, x - 1, y - 2, 12, 3, '#a14a33')
  rect(ctx, x + 2, y - 1, 6, 1, '#3b3540')
}

function drawRestingGull(ctx: Ctx, x: number, y: number) {
  rect(ctx, x + 1, y, 3, 2, '#f4f4f0')
  rect(ctx, x, y + 1, 1, 1, '#e8c33a')
  rect(ctx, x + 2, y + 2, 5, 2, '#f4f4f0')
  rect(ctx, x + 3, y + 2, 4, 1, '#a9b1ba')
  rect(ctx, x + 7, y + 2, 1, 1, IRON)
}

/** Shuttered windows: the flat's own under its back windows, the neighbours' in a row. */
function drawFacadeWindows(ctx: Ctx) {
  for (const window of HOUSE_WINDOWS)
    drawShutteredWindow(ctx, window.x * TILE, (window.y + 1) * TILE, 2, HOUSE_FACADE.shutter, false)
  for (let tx = -MARGIN.left; tx < MAP_WIDTH + MARGIN.right; tx++) {
    const b = buildingAt(tx)
    if (!b) continue
    const local = tx - b.x0
    if (local % 2 === 0 || local === BUILDING_WIDTH - 1) continue
    drawShutteredWindow(ctx, tx * TILE, (MAP_HEIGHT - 2) * TILE, 1, b.facade.shutter, hash(tx, 61) > 0.55)
  }
}

/** A window `tiles` wide spanning both rows of a façade, its shutters open. */
function drawShutteredWindow(ctx: Ctx, ox: number, oy: number, tiles: number, shutter: string, flowers: boolean) {
  const w = tiles * 16 - 10
  const x = ox + 5
  const y = oy + 6
  const h = 19
  rect(ctx, x - 1, y - 1, w + 2, h + 1, '#f7f3ea')
  rect(ctx, x, y, w, h - 1, '#4f6f86')
  rect(ctx, x + 1, y + 1, 2, 1, '#9cc0d6')
  rect(ctx, x + 1, y + 2, 1, 2, '#9cc0d6')
  rect(ctx, x + Math.floor(w / 2), y, 1, h - 1, '#f7f3ea')
  rect(ctx, x, y + 7, w, 1, '#f7f3ea')
  for (const sx of [x - 4, x + w + 1]) {
    rect(ctx, sx, y - 1, 3, h, shutter)
    for (let sy = y + 1; sy < y + h - 1; sy += 2) rect(ctx, sx, sy, 3, 1, 'rgba(0,0,0,0.2)')
  }
  rect(ctx, x - 2, y + h - 1, w + 4, 2, '#e3dccd')
  rect(ctx, x - 2, y + h + 1, w + 4, 1, 'rgba(0,0,0,0.18)')
  if (flowers) {
    rect(ctx, x - 1, y + h - 3, w + 2, 2, '#4f7a3a')
    for (let fx = x; fx < x + w; fx += 2) rect(ctx, fx, y + h - 4 + (fx % 4 ? 0 : 1), 1, 1, '#d6453d')
  }
}

/**
 * The landing behind the front door: a doormat, the shared stair going down
 * into the dark beside a wooden handrail, and a neighbour's plant.
 */
function drawLanding(ctx: Ctx) {
  const x = (STAIRWELL.x0 + 1) * TILE
  const y = STAIRWELL.y0 * TILE
  const depth = (STAIRWELL.y1 - STAIRWELL.y0) * TILE
  // Under the door: a coir mat with a dark border.
  rect(ctx, FRONT_DOOR * TILE + 3, y + 1, 26, 11, '#5a4430')
  rect(ctx, FRONT_DOOR * TILE + 4, y + 2, 24, 9, '#b08a55')
  for (let i = 6; i < 26; i += 3) rect(ctx, FRONT_DOOR * TILE + i, y + 3, 1, 7, '#9c7646')
  // Worn lioz treads, each a step lower and darker, down past the bottom wall.
  const steps = depth / 4
  for (let i = 0; i < steps; i++) {
    const shade = Math.round(228 - i * (150 / steps))
    rect(ctx, x, y + i * 4, 14, 4, `rgb(${shade}, ${shade - 7}, ${shade - 20})`)
    rect(ctx, x, y + i * 4 + 3, 14, 1, 'rgba(20,14,30,0.3)')
    rect(ctx, x + 1, y + i * 4, 6, 1, 'rgba(255,255,255,0.18)')
  }
  rect(ctx, x, y + depth - 10, 14, 10, 'rgba(20,14,30,0.35)')
  // The handrail: a walnut rail on iron balusters.
  for (let by = y + 2; by < y + depth; by += 5) rect(ctx, x + 14, by, 1, 3, IRON)
  rect(ctx, x + 15, y, 2, depth, '#6b4630')
  rect(ctx, x + 15, y, 1, depth, '#8a5d3f')
  drawPot(ctx, (FRONT_DOOR + 1) * TILE + 4, y + depth - 13)
}

/** Washing on a line under the kitchen window, as every back window in Lisbon has. */
function drawLaundry(ctx: Ctx) {
  const kitchen = HOUSE_WINDOWS.find((window) => window.x < 8)
  if (!kitchen) return
  const x0 = kitchen.x * TILE - 22
  const x1 = kitchen.x * TILE + 40
  const y = (kitchen.y + 2) * TILE + 11
  rect(ctx, x0, y, x1 - x0, 1, '#d9d4c8')
  const clothes = [
    { w: 9, h: 8, color: '#c0392b', shirt: true },
    { w: 3, h: 5, color: '#f4ecd8', shirt: false },
    { w: 3, h: 5, color: '#f4ecd8', shirt: false },
    { w: 10, h: 10, color: '#3f6fae', shirt: false },
    { w: 9, h: 8, color: '#e8c33a', shirt: true },
    { w: 7, h: 11, color: '#f7f3ea', shirt: false },
  ]
  let cx = x0 + 3
  for (const item of clothes) {
    if (item.shirt) {
      rect(ctx, cx, y + 1, item.w, 3, item.color)
      rect(ctx, cx + 2, y + 4, item.w - 4, item.h - 3, item.color)
    } else {
      rect(ctx, cx, y + 1, item.w, item.h, item.color)
    }
    rect(ctx, cx + item.w - 1, y + 1, 1, item.h, 'rgba(0,0,0,0.12)')
    rect(ctx, cx + 1, y, 1, 2, '#8a5d3f')
    cx += item.w + 2
  }
}

/** A black iron candeeiro on its bracket, the glass that glows at night. */
function drawWallLantern(ctx: Ctx, x: number, y: number) {
  rect(ctx, x - 1, y - 2, 3, 1, IRON)
  rect(ctx, x, y - 1, 1, 1, IRON)
  rect(ctx, x - 2, y, 5, 1, IRON)
  rect(ctx, x - 2, y + 1, 5, 6, IRON)
  rect(ctx, x - 1, y + 1, 3, 5, '#f2d48a')
  rect(ctx, x, y + 1, 1, 5, '#fff0c2')
  rect(ctx, x - 1, y + 7, 3, 1, IRON)
  rect(ctx, x, y + 8, 1, 1, IRON)
}

/** The courtyard's orange tree, a bench and potted geraniums along the walls. */
function drawCourtyard(ctx: Ctx) {
  const base = MAP_HEIGHT * TILE
  drawOrangeTree(ctx, 3 * TILE + 8, base + 2 * TILE + 6)
  drawBench(ctx, 19 * TILE + 2, base + 2 * TILE + 4)
  for (const [x, y] of [
    [-1 * TILE + 4, base + 1],
    [14 * TILE + 3, base + 2 * TILE + 1],
    [16 * TILE + 3, base + 1],
    [22 * TILE + 6, base + 1],
    [-9 * TILE + 5, base + 1],
    [27 * TILE + 3, base + 1],
  ]) {
    drawPot(ctx, x, y)
  }
}

function drawOrangeTree(ctx: Ctx, cx: number, cy: number) {
  ctx.fillStyle = 'rgba(20,14,30,0.22)'
  ctx.beginPath()
  ctx.ellipse(cx + 4, cy + 6, 15, 9, 0, 0, Math.PI * 2)
  ctx.fill()
  // The bed's stone ring, then the canopy.
  rect(ctx, cx - 7, cy + 4, 14, 6, STONE.base)
  rect(ctx, cx - 6, cy + 5, 12, 4, '#6b4a2e')
  const leaf = (dx: number, dy: number, r: number, color: string) => {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(cx + dx, cy + dy, r, 0, Math.PI * 2)
    ctx.fill()
  }
  leaf(0, -4, 13, '#2f5a2c')
  leaf(-4, -7, 9, '#3d6b35')
  leaf(5, -5, 8, '#3d6b35')
  leaf(-2, -10, 5, '#55893f')
  for (let i = 0; i < 9; i++) {
    const a = hash(i, 71) * Math.PI * 2
    const r = 3 + hash(i, 73) * 8
    rect(ctx, Math.round(cx + Math.cos(a) * r), Math.round(cy - 5 + Math.sin(a) * r), 2, 2, '#f08a24')
  }
}

function drawBench(ctx: Ctx, x: number, y: number) {
  rect(ctx, x + 1, y + 9, 28, 2, 'rgba(20,14,30,0.22)')
  rect(ctx, x, y, 30, 9, IRON)
  for (let i = 0; i < 3; i++) rect(ctx, x + 1, y + 1 + i * 3, 28, 2, i % 2 ? '#8a5d3f' : '#a2714c')
}

function drawPot(ctx: Ctx, x: number, y: number) {
  rect(ctx, x + 1, y + 8, 8, 2, 'rgba(20,14,30,0.22)')
  rect(ctx, x, y + 3, 9, 6, '#b5603c')
  rect(ctx, x, y + 3, 9, 1, '#cf7a52')
  rect(ctx, x + 1, y, 7, 3, '#4f7a3a')
  for (let i = 0; i < 3; i++) rect(ctx, x + 1 + i * 3, y - (i % 2), 2, 2, '#d6453d')
}

/** The block fades into the night at its far edges rather than stopping dead. */
function fadeEdges(ctx: Ctx) {
  const { width, height } = ctx.canvas
  const fade = 5 * TILE
  for (const [x0, x1] of [
    [fade, 0],
    [width - fade, width],
  ]) {
    const gradient = ctx.createLinearGradient(x0, 0, x1, 0)
    gradient.addColorStop(0, 'rgba(20,16,25,0)')
    gradient.addColorStop(1, BACKGROUND)
    ctx.fillStyle = gradient
    ctx.fillRect(Math.min(x0, x1), 0, fade, height)
  }
  const bottom = ctx.createLinearGradient(0, height - 3 * TILE, 0, height)
  bottom.addColorStop(0, 'rgba(20,16,25,0)')
  bottom.addColorStop(1, BACKGROUND)
  ctx.fillStyle = bottom
  ctx.fillRect(0, height - 3 * TILE, width, 3 * TILE)
}

// ---------------------------------------------------------------------------
// The scene layer

/** How grey the block goes under each sky. */
const TINT: Record<Weather, number> = {
  clear: 0xffffff,
  cloudy: 0xd4d6dc,
  rain: 0xb8bcc6,
  storm: 0xa2a6b2,
}
/** Gaps between gulls, and how fast they glide, in px/s. */
const GULL_GAP_MS: [number, number] = [16_000, 34_000]
const FIRST_GULL_MS: [number, number] = [5_000, 10_000]
const GULL_SPEED: [number, number] = [38, 54]
const GULL_W = 11
const GULL_H = 15

const between = ([min, max]: [number, number]) => min + Math.random() * (max - min)

/** A gull from above, facing right: wings spread, or raised mid-beat. */
function drawGull(ctx: Ctx, ox: number, raised: boolean) {
  const white = '#f4f4f0'
  const wing = '#a9b1ba'
  rect(ctx, ox, 7, 2, 1, '#c9ced4')
  rect(ctx, ox + 2, 6, 7, 3, white)
  rect(ctx, ox + 8, 6, 2, 2, white)
  rect(ctx, ox + 10, 7, 1, 1, '#e8c33a')
  const reach = raised ? 3 : 5
  for (const dir of [-1, 1]) {
    for (let i = 1; i <= reach; i++) {
      const y = dir < 0 ? 6 - i : 8 + i
      const x = ox + 5 - Math.floor(i / 2)
      rect(ctx, x, y, 3, 1, i === reach ? IRON : wing)
    }
  }
}

/**
 * Bakes the block under the house and sends a gull gliding across the view
 * every so often, by day and under a calm sky. `onCry` fires as each one
 * passes, for its call. Under reduced motion the gulls stay away; one still
 * rests on a chimney.
 */
export class Exterior {
  private image: Phaser.GameObjects.Image
  private night: boolean
  private weather: Weather = 'clear'

  constructor(
    private scene: Phaser.Scene,
    private options: { reducedMotion: boolean; night: boolean; onCry: () => void },
  ) {
    this.night = options.night
    const width = (MAP_WIDTH + MARGIN.left + MARGIN.right) * TILE
    const height = (MAP_HEIGHT + MARGIN.top + MARGIN.bottom) * TILE
    const texture = scene.textures.createCanvas('house-exterior', width, height)!
    paintExterior(texture.getContext())
    texture.refresh()
    this.image = scene.add
      .image(-MARGIN.left * TILE, -MARGIN.top * TILE, 'house-exterior')
      .setOrigin(0)
      .setDepth(-1)

    const gull = scene.textures.createCanvas('gull', GULL_W * 2, GULL_H)!
    drawGull(gull.getContext(), 0, false)
    drawGull(gull.getContext(), GULL_W, true)
    gull.add('spread', 0, 0, 0, GULL_W, GULL_H)
    gull.add('raised', 0, GULL_W, 0, GULL_W, GULL_H)
    gull.refresh()

    if (!options.reducedMotion) this.queueGull(between(FIRST_GULL_MS))
  }

  setNight(on: boolean) {
    this.night = on
  }

  setWeather(weather: Weather) {
    this.weather = weather
    this.image.setTint(TINT[weather])
  }

  private calm() {
    return !this.night && (this.weather === 'clear' || this.weather === 'cloudy')
  }

  private queueGull(delay: number) {
    this.scene.time.delayedCall(delay, () => {
      if (this.calm() && !document.hidden) {
        this.glide()
        if (Math.random() < 0.3) this.scene.time.delayedCall(between([500, 1200]), () => this.glide(true))
      }
      this.queueGull(between(GULL_GAP_MS))
    })
  }

  /** One gull across the camera's view, with a lazy flap and a call on the way. */
  private glide(follower = false) {
    const view = this.scene.cameras.main.worldView
    const rightward = Math.random() < 0.5
    const startX = rightward ? view.x - GULL_W : view.right + GULL_W
    const endX = rightward ? view.right + GULL_W : view.x - GULL_W
    const startY = view.y + view.height * (0.15 + Math.random() * 0.6)
    const endY = startY + (Math.random() - 0.5) * view.height * 0.4
    const duration = (Math.abs(endX - startX) / between(GULL_SPEED)) * 1000

    const bird = this.scene.add.image(startX, startY, 'gull', 'spread').setDepth(28.6).setFlipX(!rightward)
    const shadow = this.scene.add
      .image(startX + 6, startY + 18, 'gull', 'spread')
      .setDepth(1.5)
      .setFlipX(!rightward)
      .setTint(0x000000)
      .setAlpha(0.15)
    let beat = 0
    const flap = this.scene.time.addEvent({
      delay: 170,
      loop: true,
      callback: () => {
        // Bursts of flapping between long glides.
        beat = (beat + 1) % 16
        const frame = beat < 6 && beat % 2 ? 'raised' : 'spread'
        bird.setFrame(frame)
        shadow.setFrame(frame)
      },
    })
    this.scene.tweens.add({
      targets: bird,
      x: endX,
      y: endY,
      duration,
      onUpdate: () => shadow.setPosition(bird.x + 6, bird.y + 18),
      onComplete: () => {
        flap.remove()
        bird.destroy()
        shadow.destroy()
      },
    })
    if (!follower) this.scene.time.delayedCall(duration * 0.3, this.options.onCry)
  }
}
