export const TILE = 16

/**
 * Floor plan of the house, one character per 16px tile:
 *   #  wall (rendered as a cap or a wall face depending on what's below it)
 *   .  floor
 *   D  open doorway (walkable)
 *   F  front door
 *
 * A wall run directly above a floor renders as a two-tile-high wall face, so
 * every room's north wall is two rows of `#` (or `D` for its door).
 *
 * Kept to Pokémon-house proportions: two cosy rooms upstairs of a mudroom,
 * each holding several topics as furniture rather than one room per topic.
 */
export const FLOOR_PLAN = [
  '#########################',
  '#########################',
  '#########################',
  '#...........#...........#',
  '#...........#...........#',
  '#...........#...........#',
  '#...........#...........#',
  '#...........#...........#',
  '#...........#...........#',
  '#...........#...........#',
  '######D###########D######',
  '######D###########D######',
  '#.......................#',
  '#.......................#',
  '#.......................#',
  '#.......................#',
  '#.......................#',
  '############F############',
]

export const MAP_WIDTH = FLOOR_PLAN[0].length
export const MAP_HEIGHT = FLOOR_PLAN.length

export type RoomId = 'entry' | 'study' | 'living'

export type FloorKind = 'wood' | 'checker' | 'parquet'
export type WallKind = 'cream' | 'rose' | 'library'

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
}

export const ROOMS: Room[] = [
  {
    id: 'entry',
    name: 'Mudroom',
    blurb: 'Front door, letterbox, and the running and hiking kit.',
    rect: { x: 1, y: 12, w: 23, h: 5 },
    floor: 'checker',
    wall: 'rose',
    spawn: { x: 12, y: 16 },
  },
  {
    id: 'study',
    name: 'Study',
    blurb: 'Map table, bookshelves, the home server and the camera.',
    rect: { x: 1, y: 3, w: 11, h: 7 },
    floor: 'parquet',
    wall: 'library',
    spawn: { x: 6, y: 9 },
  },
  {
    id: 'living',
    name: 'Living room',
    blurb: 'The TV, the drum kit — and usually João.',
    rect: { x: 13, y: 3, w: 11, h: 7 },
    floor: 'wood',
    wall: 'cream',
    spawn: { x: 18, y: 9 },
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
  return cell === '.' || cell === 'D'
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
