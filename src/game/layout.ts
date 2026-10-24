export const TILE = 16

/** Real-world size of one tile. Furniture and rooms are sized from this. */
export const METRES_PER_TILE = 0.5

/**
 * Floor plan of the apartment, one character per 16px tile (50cm):
 *   #  wall (rendered as a cap or a wall face depending on what's below it)
 *   .  floor
 *   D  doorway through a north wall (walkable)
 *   d  doorway through a side wall (walkable)
 *   X  a shut door (the bathroom: occupied until its mission opens it)
 *   F  front door
 *   W  window: tall and glazed in a wall face; in a back wall seen from above,
 *      plain wall (it shows on the façade outside, and lets the sun in)
 *   =  the balcony's front railing; |  its side railing
 *      (space) outside the flat
 *
 * A wall run directly above a floor renders as a two-tile-high wall face, so
 * every room's north wall is two rows of `#` (or `D`/`W`).
 *
 * A compact Lisbon T2 of about 55m² with the street along the top: the living
 * room and bedroom get the façade windows, the kitchen and study look onto the
 * courtyard at the back. The hall opens straight into the living room, and the
 * small kitchen opens to both: to the living room through a pocket door and to
 * the hall by the front door, so meals never cross the entrance. A 2m corridor
 * serves the bedroom, bathroom and study, and the bedroom steps out onto a
 * small balcony nook over the street.
 */
export const FLOOR_PLAN = [
  ' #################     ',
  ' #WW####WW#WW#####     ',
  ' #WW####WW#WW#####===  ',
  ' #........#......#..|  ',
  ' #........#......#..|  ',
  ' #........#......d..|  ',
  ' #........#......d..|  ',
  ' #........#......####  ',
  ' #........#......####  ',
  ' #........###DD########',
  ' #........###DD########',
  '####DD#...d....d......#',
  '####DD#...d....d......#',
  '#.....#...###XX#......#',
  '#.....#...###XX#......#',
  '#.....d...#....#......#',
  '#.....d...#....#......#',
  '#.....#...#....#......#',
  '##WW####FF#....###WW###',
  '          #....#       ',
  '          ##WW##       ',
]

export const MAP_WIDTH = FLOOR_PLAN[0].length
export const MAP_HEIGHT = FLOOR_PLAN.length

export type RoomId = 'hall' | 'corridor' | 'living' | 'kitchen' | 'study' | 'bedroom' | 'bathroom' | 'balcony'

/** Parts of the house a mission opens up (see `src/game/missions.ts`). */
export type UnlockId = 'bathroom'

/** Shut doors on the plan and what opens each: once open it is drawn and walked as a doorway. */
const LOCKED_DOORS: Partial<Record<string, UnlockId>> = { X: 'bathroom' }

const NOTHING_UNLOCKED: ReadonlySet<UnlockId> = new Set()

/**
 * One light oak runs through every room but the kitchen and bathroom. Its
 * planks run front-to-back, towards the street windows, except in the
 * corridor, where they follow its length.
 */
export type FloorKind = 'oak' | 'oak-across' | 'hydraulic' | 'bath' | 'balcony'
export type WallKind = 'warmwhite' | 'azulejo' | 'library' | 'sage' | 'bath' | 'metro' | 'railing'
export type Direction = 'up' | 'down' | 'left' | 'right'

export interface Point {
  x: number
  y: number
}

export interface Room {
  id: RoomId
  name: string
  /** Interior floor tiles, inclusive. */
  rect: { x: number; y: number; w: number; h: number }
  floor: FloorKind
  wall: WallKind
  spawn: Point
  spawnFacing: Direction
  /** Behind a shut door until this is unlocked: shown on the floor plan but not somewhere to teleport. */
  unlock?: UnlockId
}

export const ROOMS: Room[] = [
  {
    id: 'hall',
    name: 'Entrance hall',
    rect: { x: 7, y: 11, w: 3, h: 7 },
    floor: 'oak',
    wall: 'azulejo',
    spawn: { x: 8, y: 14 },
    spawnFacing: 'up',
  },
  {
    id: 'corridor',
    name: 'Corridor',
    rect: { x: 11, y: 11, w: 4, h: 2 },
    floor: 'oak-across',
    wall: 'warmwhite',
    spawn: { x: 12, y: 12 },
    spawnFacing: 'up',
  },
  {
    id: 'living',
    name: 'Living room',
    rect: { x: 2, y: 3, w: 8, h: 8 },
    floor: 'oak',
    wall: 'warmwhite',
    spawn: { x: 8, y: 9 },
    spawnFacing: 'up',
  },
  {
    id: 'kitchen',
    name: 'Kitchen',
    rect: { x: 1, y: 13, w: 5, h: 5 },
    floor: 'hydraulic',
    wall: 'metro',
    spawn: { x: 4, y: 15 },
    spawnFacing: 'left',
  },
  {
    id: 'study',
    name: 'Study',
    rect: { x: 16, y: 11, w: 6, h: 7 },
    floor: 'oak',
    wall: 'library',
    spawn: { x: 17, y: 12 },
    spawnFacing: 'up',
  },
  {
    id: 'bedroom',
    name: 'Bedroom',
    rect: { x: 11, y: 3, w: 6, h: 6 },
    floor: 'oak',
    wall: 'sage',
    spawn: { x: 13, y: 7 },
    spawnFacing: 'up',
  },
  {
    id: 'bathroom',
    name: 'Bathroom',
    rect: { x: 11, y: 15, w: 4, h: 5 },
    floor: 'bath',
    wall: 'bath',
    spawn: { x: 12, y: 17 },
    spawnFacing: 'up',
    unlock: 'bathroom',
  },
  {
    id: 'balcony',
    name: 'Balcony',
    rect: { x: 18, y: 3, w: 2, h: 4 },
    floor: 'balcony',
    wall: 'railing',
    spawn: { x: 18, y: 5 },
    spawnFacing: 'up',
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

/** Whether a room can be walked into, given what has been unlocked. */
export function isRoomOpen(room: Room, unlocks: ReadonlySet<UnlockId> = NOTHING_UNLOCKED): boolean {
  return room.unlock === undefined || unlocks.has(room.unlock)
}

/** The plan's character at a tile; a shut door that has been unlocked reads as a doorway (`D`). */
export function cellAt(x: number, y: number, unlocks: ReadonlySet<UnlockId> = NOTHING_UNLOCKED): string {
  if (y < 0 || y >= MAP_HEIGHT || x < 0 || x >= MAP_WIDTH) return ' '
  const cell = FLOOR_PLAN[y][x]
  const unlock = LOCKED_DOORS[cell]
  return unlock && unlocks.has(unlock) ? 'D' : cell
}

/** Tiles the player can stand on, ignoring furniture and characters. */
export function isFloorCell(x: number, y: number, unlocks?: ReadonlySet<UnlockId>): boolean {
  const cell = cellAt(x, y, unlocks)
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
