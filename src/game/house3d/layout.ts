import type { InteractAction } from '../bridge'
import type { FloorKind, RoomId, WallKind } from '../layout'
import houseLayout from './house-layout.json'

/**
 * The low-poly house's layout: one hand-edited file, house-layout.json, that
 * both the Blender build (scripts/lowpoly/build_house.py) and the /house-3d page
 * read. Everything is in tiles of 0.5 m; one tile is `scale.tile` units in
 * Blender and three.js. Tile (x, y) counts east and south from the flat's
 * north-west corner and is centred at ((x + 0.5) · tile, 0, (y + 0.5) · tile) in
 * three.js (Blender +Y is north, which the glTF export turns into three.js −Z).
 *
 * Walls run along the lines between tiles: an `h` wall lies on the line
 * y = `at` from x = `from` to `to`, a `v` wall on x = `at`. Inner walls are
 * centred on their line; outer walls stand just outside the flat, so every
 * room's floor is whole tiles.
 */

export type Tile = [number, number]
/** x, y, width, height in tiles. */
export type Rect = [number, number, number, number]

export interface Scale {
  /** Blender and three.js units per tile. */
  tile: number
  wallHeight: number
  /** Thickness of the walls round the flat, built outside its floor. */
  outerWall: number
  /** Thickness of the walls between rooms, centred on their line. */
  innerWall: number
  /** The height the flat's outer south and west walls are cut down to, and that inner walls drop to. */
  cutHeight: number
  doorHeight: number
}

export interface Room3d {
  id: RoomId
  name: string
  rect: Rect
  floor: FloorKind
  /** The balcony's `railing` gives it railings on its outer sides instead of walls. */
  wall: WallKind
  /** Where the room teleport puts the visitor. */
  spawn: Tile
}

export interface Opening {
  /** `door` is a doorway (with a door model if `door`), `opening` a gap with no wall above it. */
  kind: 'door' | 'opening' | 'window'
  /** The first tile along the wall. */
  from: number
  width: number
  door?: boolean
}

export interface Wall {
  id: string
  axis: 'h' | 'v'
  /** The tile line the wall stands on. */
  at: number
  from: number
  to: number
  /** The rooms on either side: [north, south] for `h`, [west, east] for `v`; null is outside the flat. */
  rooms: [RoomId | null, RoomId | null]
  openings: Opening[]
}

export interface Furniture {
  id: string
  room: RoomId
  /** `pack:<name>` for a KayKit Furniture Bits model, otherwise one of the build script's own builders. */
  model: string
  /** The tiles it stands on. */
  rect: Rect
  /** Degrees anticlockwise seen from above (Blender's Z rotation). */
  rotation?: number
  /** Solid furniture blocks walking; chairs and rugs don't. */
  solid: boolean
  /** Nudged from the centre of `rect`, in units: [east, south, up]. */
  offset?: [number, number, number]
  scale?: [number, number, number]
  /** Pack colours swapped for house swatches, e.g. { "yellow": "sofa_blue" }. */
  colours?: Record<string, string>
}

export interface Interactable3d {
  id: string
  label: string
  tiles: Tile[]
  /** Furniture that counts as this item when clicked. */
  furniture: string[]
  /** What the pixel house does with it; absent for things only the 3D page handles (the lamp). */
  action?: InteractAction
}

export interface Layout3d {
  scale: Scale
  rooms: Room3d[]
  walls: Wall[]
  furniture: Furniture[]
  interactables: Interactable3d[]
  /** Where the visitor arrives: in the hall, by the front door. */
  spawn: Tile
  zeno: {
    start: Tile
    /** Furniture that's solid for people but that Zeno happily walks on. */
    perches: Tile[]
    spots: Tile[]
    toy: Tile
    litterBox: Tile
  }
}

export const LAYOUT = houseLayout as unknown as Layout3d

/** The tiles a rectangle covers. */
export function rectTiles([x, y, w, h]: Rect): Tile[] {
  const tiles: Tile[] = []
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) tiles.push([x + dx, y + dy])
  return tiles
}

export const tileKey = (x: number, y: number) => `${x},${y}`

/** An axis-aligned box on the floor, in units: x east, z south. */
export interface Box {
  x0: number
  z0: number
  x1: number
  z1: number
}

/** Whether a wall is one of the flat's outer south and west walls, on the camera's side and cut down for good. */
export function isCutDown(wall: Wall): boolean {
  return wall.axis === 'h' ? wall.rooms[1] === null : wall.rooms[0] === null
}

export function isOuter(wall: Wall): boolean {
  return wall.rooms[0] === null || wall.rooms[1] === null
}

/** The stretches of a wall between its doors and openings (windows don't break it), in tiles along it. */
export function wallRuns(wall: Wall): [number, number][] {
  const gaps = wall.openings.filter((o) => o.kind !== 'window').sort((a, b) => a.from - b.from)
  const runs: [number, number][] = []
  let at = wall.from
  for (const gap of gaps) {
    if (gap.from > at) runs.push([at, gap.from])
    at = gap.from + gap.width
  }
  if (at < wall.to) runs.push([at, wall.to])
  return runs
}

/**
 * The flat as a walking grid: which tiles are floor, which are taken by solid
 * furniture, which steps between tiles a wall blocks, and the boxes a body
 * collides with between tiles.
 */
export function makeGrid(layout: Layout3d = LAYOUT) {
  const T = layout.scale.tile
  const roomOf = new Map<string, Room3d>()
  for (const room of layout.rooms) for (const [x, y] of rectTiles(room.rect)) roomOf.set(tileKey(x, y), room)
  const solid = new Set<string>()
  for (const item of layout.furniture) if (item.solid) for (const [x, y] of rectTiles(item.rect)) solid.add(tileKey(x, y))

  /** Steps a wall blocks, keyed by the tile west of (or north of) the line and the direction. */
  const blockedSteps = new Set<string>()
  const boxes: Box[] = []
  for (const wall of layout.walls) {
    const open = new Set<number>()
    for (const o of wall.openings) if (o.kind !== 'window') for (let i = 0; i < o.width; i++) open.add(o.from + i)
    for (let i = wall.from; i < wall.to; i++) {
      if (open.has(i)) continue
      blockedSteps.add(wall.axis === 'h' ? `${i},${wall.at - 1},s` : `${wall.at - 1},${i},e`)
    }
    const outer = isOuter(wall)
    // Across the line: inner walls straddle it, outer ones stand outside the flat.
    const outside = wall.rooms[0] === null ? -1 : 1
    const [w0, w1] = outer
      ? outside < 0
        ? [-layout.scale.outerWall, 0]
        : [0, layout.scale.outerWall]
      : [-layout.scale.innerWall / 2, layout.scale.innerWall / 2]
    for (const [a, b] of wallRuns(wall)) {
      const line = wall.at * T
      boxes.push(
        wall.axis === 'h'
          ? { x0: a * T, x1: b * T, z0: line + w0, z1: line + w1 }
          : { x0: line + w0, x1: line + w1, z0: a * T, z1: b * T },
      )
    }
  }

  const roomAt = (x: number, y: number) => roomOf.get(tileKey(x, y))
  const walkable = (x: number, y: number) => roomOf.has(tileKey(x, y)) && !solid.has(tileKey(x, y))

  /** Whether a wall stands between a tile and its neighbour one 4-way step away. */
  const wallBetween = (x: number, y: number, dx: number, dy: number) => {
    if (dx === 1) return blockedSteps.has(`${x},${y},e`)
    if (dx === -1) return blockedSteps.has(`${x - 1},${y},e`)
    if (dy === 1) return blockedSteps.has(`${x},${y},s`)
    return blockedSteps.has(`${x},${y - 1},s`)
  }

  /** Whether one 4-way step between neighbouring tiles is free. */
  const canStep = (x: number, y: number, dx: number, dy: number) => walkable(x + dx, y + dy) && !wallBetween(x, y, dx, dy)

  const STEPS: Tile[] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]

  /** Shortest 4-way path over walkable tiles to any goal tile, excluding the start. */
  const findPath = (from: Tile, goals: Set<string>): Tile[] | null => {
    const prev = new Map<string, string | null>([[tileKey(...from), null]])
    const queue: Tile[] = [from]
    for (let head = 0; head < queue.length; head++) {
      const [x, y] = queue[head]
      if (goals.has(tileKey(x, y))) {
        const path: Tile[] = []
        for (let at: string | null = tileKey(x, y); at && at !== tileKey(...from); at = prev.get(at) ?? null) {
          const [px, py] = at.split(',').map(Number)
          path.unshift([px, py])
        }
        return path
      }
      for (const [dx, dy] of STEPS) {
        const next = tileKey(x + dx, y + dy)
        if (prev.has(next) || !canStep(x, y, dx, dy)) continue
        prev.set(next, tileKey(x, y))
        queue.push([x + dx, y + dy])
      }
    }
    return null
  }

  /** Walkable tiles next to an item, not through a wall, where the visitor stands to use it. */
  const standingTiles = (tiles: Tile[]) => {
    const out = new Set<string>()
    for (const [x, y] of tiles)
      for (const [dx, dy] of STEPS) {
        if (walkable(x + dx, y + dy) && !wallBetween(x, y, dx, dy)) out.add(tileKey(x + dx, y + dy))
      }
    return out
  }

  /**
   * Whether a body `radius` units across from its centre at (x, z) would touch
   * a wall, solid furniture or the edge of the flat.
   */
  const blocked = (x: number, z: number, radius: number) => {
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ])
      if (!walkable(Math.floor((x + sx * radius) / T), Math.floor((z + sz * radius) / T))) return true
    return boxes.some((b) => x + radius > b.x0 && x - radius < b.x1 && z + radius > b.z0 && z - radius < b.z1)
  }

  return { tile: T, roomAt, walkable, wallBetween, canStep, findPath, standingTiles, blocked, wallBoxes: boxes }
}

export type Grid = ReturnType<typeof makeGrid>
