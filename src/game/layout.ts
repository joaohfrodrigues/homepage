export const TILE = 16

/** Real-world size of one tile. Furniture and rooms are sized from this. */
export const METRES_PER_TILE = 0.5

/**
 * Floor plan of the apartment, one character per 16px tile (50cm):
 *   #  wall (rendered as a cap or a wall face depending on what's below it)
 *   .  floor
 *   D  doorway through a north wall (walkable)
 *   d  doorway through a side wall (walkable)
 *   X  a shut door (the bathroom: occupied)
 *   F  front door
 *
 * A wall run directly above a floor renders as a two-tile-high wall face, so
 * every room's north wall is two rows of `#` (or `D` for its door).
 *
 * A Lisbon-style T2 of about 75m²: bedroom, bathroom and study off a 1m-wide
 * corridor, and the entrance hall opening onto the living room and kitchen.
 */
export const FLOOR_PLAN = [
  '##########################',
  '##########################',
  '##########################',
  '#........#....#..........#',
  '#........#....#..........#',
  '#........#....#..........#',
  '#........#....#..........#',
  '#........#....#..........#',
  '#........#....#..........#',
  '#........#....#..........#',
  '####DD#####XX######DD#####',
  '####DD#####XX######DD#####',
  '#........................#',
  '#........................#',
  '###############DD#########',
  '###############DD#########',
  '#............#....#......#',
  '#............d....d......#',
  '#............d....d......#',
  '#............#....#......#',
  '#............#....#......#',
  '#............#....#......#',
  '#............#....#......#',
  '#............#....#......#',
  '###############FF#########',
]

export const MAP_WIDTH = FLOOR_PLAN[0].length
export const MAP_HEIGHT = FLOOR_PLAN.length

export type RoomId = 'hall' | 'corridor' | 'living' | 'kitchen' | 'study' | 'bedroom' | 'bathroom'

export type FloorKind = 'wood' | 'checker' | 'parquet' | 'tile' | 'bath'
export type WallKind = 'cream' | 'rose' | 'library' | 'sage' | 'bath' | 'tile'
export type Direction = 'up' | 'down' | 'left' | 'right'

export interface Point {
  x: number
  y: number
}

export interface Room {
  id: RoomId
  name: string
  /** One line for the directory. */
  blurb: string
  /** Interior floor tiles, inclusive. */
  rect: { x: number; y: number; w: number; h: number }
  floor: FloorKind
  wall: WallKind
  spawn: Point
  spawnFacing: Direction
  /** Rooms with something to see get their own entry in the directory list. */
  listed: boolean
  /** Behind a shut door: shown on the floor plan but not somewhere to teleport. */
  locked?: boolean
}

export const ROOMS: Room[] = [
  {
    id: 'hall',
    name: 'Entrance hall',
    blurb: 'Front door, the post, and the running and hiking kit.',
    rect: { x: 14, y: 16, w: 4, h: 8 },
    floor: 'checker',
    wall: 'rose',
    spawn: { x: 15, y: 23 },
    spawnFacing: 'up',
    listed: true,
  },
  {
    id: 'corridor',
    name: 'Corridor',
    blurb: 'Bedroom, bathroom and study open off it.',
    rect: { x: 1, y: 12, w: 24, h: 2 },
    floor: 'wood',
    wall: 'cream',
    spawn: { x: 16, y: 13 },
    spawnFacing: 'up',
    listed: false,
  },
  {
    id: 'living',
    name: 'Living room',
    blurb: 'The TV, the dining table — and usually João.',
    rect: { x: 1, y: 16, w: 12, h: 8 },
    floor: 'wood',
    wall: 'cream',
    spawn: { x: 12, y: 17 },
    spawnFacing: 'left',
    listed: true,
  },
  {
    id: 'kitchen',
    name: 'Kitchen',
    blurb: 'Pull a bica, or guess where the fridge-magnet photos were taken.',
    rect: { x: 19, y: 16, w: 6, h: 8 },
    floor: 'tile',
    wall: 'tile',
    spawn: { x: 19, y: 17 },
    spawnFacing: 'right',
    listed: true,
  },
  {
    id: 'study',
    name: 'Study',
    blurb: 'Wall map, bookshelves, the home server, camera and drums.',
    rect: { x: 15, y: 3, w: 10, h: 7 },
    floor: 'parquet',
    wall: 'library',
    spawn: { x: 19, y: 9 },
    spawnFacing: 'up',
    listed: true,
  },
  {
    id: 'bedroom',
    name: 'Bedroom',
    blurb: 'Change outfit at the wardrobe, or nap until nightfall.',
    rect: { x: 1, y: 3, w: 8, h: 7 },
    floor: 'wood',
    wall: 'sage',
    spawn: { x: 4, y: 9 },
    spawnFacing: 'up',
    listed: true,
  },
  {
    id: 'bathroom',
    name: 'Bathroom',
    blurb: 'Second door on the left.',
    rect: { x: 10, y: 3, w: 4, h: 7 },
    floor: 'bath',
    wall: 'bath',
    spawn: { x: 11, y: 9 },
    spawnFacing: 'up',
    listed: false,
    locked: true,
  },
]

export function getRoom(id: RoomId): Room {
  return ROOMS.find((room) => room.id === id)!
}

export function roomAt(x: number, y: number): Room | undefined {
  return ROOMS.find(
    ({ rect }) => x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h,
  )
}

export function cellAt(x: number, y: number): string {
  if (y < 0 || y >= MAP_HEIGHT || x < 0 || x >= MAP_WIDTH) return ' '
  return FLOOR_PLAN[y][x]
}

/** Tiles the player can stand on, ignoring furniture and characters. */
export function isFloorCell(x: number, y: number): boolean {
  const cell = cellAt(x, y)
  return cell === '.' || cell === 'D' || cell === 'd'
}

export type WallPart = 'cap' | 'upper' | 'lower'

/**
 * How a wall-like cell (#, D, F) should be drawn: the two rows above a room
 * floor are its wall face, anything else is the top of a wall seen from above.
 */
export function wallPartAt(x: number, y: number): WallPart {
  if (cellAt(x, y + 1) === '.') return 'lower'
  if (cellAt(x, y + 2) === '.') return 'upper'
  return 'cap'
}

/** The room whose floor sits below a wall face, which decides its wallpaper. */
export function roomBelow(x: number, y: number): Room | undefined {
  for (let dy = 1; dy <= 2; dy++) {
    const room = roomAt(x, y + dy)
    if (room) return room
  }
  return undefined
}

/** The room a piece of furniture belongs to, including things hung on a wall face. */
export function roomOf(tiles: Point[]): Room | undefined {
  for (const tile of tiles) {
    const room = roomAt(tile.x, tile.y) ?? roomBelow(tile.x, tile.y) ?? roomAt(tile.x, tile.y - 1)
    if (room) return room
  }
  return undefined
}
