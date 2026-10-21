import type { InteractAction } from './bridge'
import type { Point } from './layout'
import type { LimezuSprite } from './limezu-furniture'
import { PROP_SIZES, type PropName } from './pixels'
import { getTopic, type TopicId } from './topics'

/** Frame indices into the Kenney "Roguelike Indoors" sheet (27 columns). */
const K = {
  mirror: 400,
  paintings: [340, 341, 342, 367, 368, 369],
  landscapes: [343, 370, 397],
  runnerH: { left: 243, mid: 244, right: 245 },
}

export type Decor =
  | { kind: 'kenney'; frame: number; x: number; y: number; solid: boolean }
  | { kind: 'prop'; prop: PropName; x: number; y: number; solid: boolean }
  /** A Modern Interiors sprite standing on one tile; tall ones rise over the tile above. */
  | { kind: 'limezu'; sprite: LimezuSprite; x: number; y: number; solid: boolean }

export interface Interactable {
  id: string
  label: string
  tiles: Point[]
  action: InteractAction
}

export interface Furnishings {
  decor: Decor[]
  interactables: Interactable[]
  npcStart: Point
  /** João wanders inside this rectangle when nobody is talking to him. */
  npcArea: { x: number; y: number; w: number; h: number }
  zeno: {
    start: Point
    /** Furniture that's solid for people but that Zeno happily walks on. */
    perches: Point[]
    /** Favourite places he trots off to and sits in for a while. */
    spots: Point[]
    /** Where his toy mouse starts; he bats it around the flat from there. */
    toy: Point
    /** His litter box, visited every few minutes. */
    litterBox: Point
  }
}

function tilesOf(x: number, y: number, w: number, h: number): Point[] {
  const tiles: Point[] = []
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) tiles.push({ x: x + dx, y: y + dy })
  return tiles
}

export function propTiles(decor: Extract<Decor, { kind: 'prop' }>): Point[] {
  const size = PROP_SIZES[decor.prop]
  return tilesOf(decor.x, decor.y, size.w / 16, size.h / 16)
}

/** Opening a topic goes straight into its window. */
export function topicAction(id: TopicId): InteractAction {
  return { type: 'navigate', href: getTopic(id).href }
}

/**
 * Everything placed in the house. Props drawn on a wall face (the rows directly
 * above a room) sit on tiles that are already solid; floor props block movement.
 */
export function furnishHouse(): Furnishings {
  const decor: Decor[] = []
  const interactables: Interactable[] = []
  const kenney = (frame: number, x: number, y: number, solid = false) =>
    decor.push({ kind: 'kenney', frame, x, y, solid })
  const limezu = (sprite: LimezuSprite, x: number, y: number, solid = true) =>
    decor.push({ kind: 'limezu', sprite, x, y, solid })
  const prop = (name: PropName, x: number, y: number, solid = true) => {
    const item: Decor = { kind: 'prop', prop: name, x, y, solid }
    decor.push(item)
    return propTiles(item)
  }
  const topicItem = (id: TopicId, tiles: Point[]) =>
    interactables.push({ id, label: getTopic(id).item, tiles, action: topicAction(id) })
  const paintings = [...K.paintings, ...K.landscapes]

  // Rugs first: decor is drawn in order, and furniture stands on them.
  prop('rugbed', 14, 7, false)
  prop('rugstudy', 18, 15, false)
  prop('rugliving', 2, 4, false)

  // --- Living room (5 × 5m) -----------------------------------------------------
  // Two street windows either side of a terracotta chimney breast; the TV hangs on
  // it, so the sofa faces the soft north light rather than having it behind the screen.
  prop('chimney', 4, 1, false)
  topicItem('watching', prop('tv', 4, 1))
  prop('coffeetable', 5, 5)
  prop('sofa', 4, 7)
  prop('floorlamp', 3, 7)
  // Dining behind the sofa, by the kitchen's pocket door: two steps from the hob.
  // Chairs can be walked over (pulled out of the way); tables and sofas can't.
  prop('diningtable', 1, 10)
  prop('chair', 1, 9, false)
  prop('chair', 3, 9, false)
  prop('chairup', 1, 12, false)
  prop('chairup', 3, 12, false)
  // The right-hand side stays clear: it's the way in from the hall.
  prop('recordplayer', 10, 5)
  limezu('leafyPlant', 1, 3)
  limezu('tallBush', 10, 3)

  // --- Kitchen (3 × 2.5m) -------------------------------------------------------
  // An L of counters on the two walls without doors: sink and coffee machine
  // along the north wall, the hob on the west wall away from the sink, and the
  // fridge at the end of the run by the pocket door, with floor in front of it.
  prop('counter', 1, 14)
  prop('sink', 2, 14)
  interactables.push({
    id: 'coffee',
    label: 'Coffee machine — pull a bica',
    tiles: prop('coffeecounter', 3, 14),
    action: { type: 'panel', panel: 'bica' },
  })
  interactables.push({
    id: 'fridge',
    label: 'Fridge magnets — where was this taken?',
    tiles: prop('fridge', 4, 14),
    action: { type: 'panel', panel: 'geoguess' },
  })
  prop('kcounter', 1, 16)
  prop('khob', 1, 17)
  prop('kcounter', 1, 18)
  prop('kcounter', 1, 19)
  interactables.push({
    id: 'litterbox',
    label: 'Clean Zeno’s litter box',
    tiles: prop('litterbox', 6, 19),
    action: { type: 'dialogue', id: 'litterbox-clean' },
  })

  // --- Entrance hall (1.5 × 3.5m), open to the living room ------------------------
  topicItem('running', prop('medalstand', 8, 13))
  prop('console', 8, 15)
  interactables.push({
    id: 'letterbox',
    label: 'Post on the console — get in touch',
    tiles: [{ x: 8, y: 15 }],
    action: { type: 'dialogue', id: 'letterbox' },
  })
  interactables.push({
    id: 'directory',
    label: 'Floor plan — house directory',
    tiles: [{ x: 8, y: 16 }],
    action: { type: 'panel', panel: 'directory' },
  })
  topicItem('hiking', [...prop('coatstand', 10, 15), ...prop('boots', 10, 17)])
  interactables.push({
    id: 'guestbook',
    label: 'Guestbook — your visit so far',
    tiles: prop('guestbook', 10, 18),
    action: { type: 'panel', panel: 'guestbook' },
  })
  prop('doormat', 9, 19, false)
  limezu('fern', 8, 19)
  interactables.push({
    id: 'front-door',
    label: 'Front door',
    tiles: [
      { x: 9, y: 20 },
      { x: 10, y: 20 },
    ],
    action: { type: 'dialogue', id: 'front-door' },
  })

  // --- Corridor (2 × 1m) --------------------------------------------------------
  kenney(K.runnerH.left, 12, 14)
  kenney(K.runnerH.mid, 13, 14)
  kenney(K.runnerH.mid, 14, 14)
  kenney(K.runnerH.right, 15, 14)
  kenney(paintings[0], 12, 12)
  kenney(paintings[4], 13, 12)

  // --- Bedroom (4 × 4m) ---------------------------------------------------------
  interactables.push({
    id: 'bed',
    label: 'Bed — take a nap',
    tiles: prop('bed', 15, 2),
    action: { type: 'dialogue', id: 'bed' },
  })
  prop('nightstand', 14, 3)
  interactables.push({
    id: 'alarm',
    label: 'Alarm clock',
    tiles: prop('alarmclock', 18, 3),
    action: { type: 'dialogue', id: 'alarm' },
  })
  kenney(K.landscapes[2], 16, 1)
  interactables.push({
    id: 'wardrobe',
    label: 'Wardrobe — change outfit',
    tiles: prop('wardrobeside', 12, 4),
    action: { type: 'panel', panel: 'wardrobe' },
  })
  limezu('snakePlant', 12, 10)

  // --- Balcony (1 × 4m) ---------------------------------------------------------
  prop('cafetable', 22, 4)
  prop('cafechair', 22, 5, false)
  limezu('palm', 21, 3)
  limezu('topiary', 22, 10)
  interactables.push({
    id: 'balcony',
    label: 'Railing — look out over Lisbon',
    tiles: [
      { x: 21, y: 2 },
      { x: 22, y: 2 },
      ...[3, 4, 5, 6, 7, 8, 9, 10].map((y) => ({ x: 23, y })),
    ],
    action: { type: 'dialogue', id: 'balcony' },
  })

  // --- Bathroom (2 × 2.5m), behind a shut door ------------------------------
  interactables.push({
    id: 'bathroom-door',
    label: 'Bathroom door',
    tiles: [
      { x: 14, y: 15 },
      { x: 15, y: 15 },
      { x: 14, y: 16 },
      { x: 15, y: 16 },
    ],
    action: { type: 'dialogue', id: 'bathroom' },
  })
  prop('toilet', 12, 16)
  prop('basin', 13, 16)
  prop('shower', 14, 20)
  prop('bathmat', 12, 20, false)

  // --- Study (3 × 3.5m) ---------------------------------------------------------
  // Entered from the end of the corridor, so its whole north wall is free for
  // the map and the desk.
  topicItem('trips', prop('wallmap', 17, 11))
  topicItem('home-server', prop('desk', 20, 12))
  prop('officechair', 21, 14, false)
  topicItem('writing', [...prop('bookshelfside', 22, 15), ...prop('bookshelfside', 22, 17)])
  prop('floorlamp', 17, 15)
  topicItem('drums', prop('drums', 17, 17))
  topicItem('camera', prop('camerastand', 20, 18))
  limezu('pottedTree', 22, 19)

  return {
    decor,
    interactables,
    npcStart: { x: 2, y: 9 },
    npcArea: { x: 1, y: 4, w: 10, h: 9 },
    zeno: {
      start: { x: 7, y: 11 },
      perches: [
        ...[4, 5, 6, 7].map((x) => ({ x, y: 8 })), // the sofa seat
        ...[15, 16, 17].flatMap((x) => [4, 5, 6].map((y) => ({ x, y }))), // the duvet
        { x: 6, y: 19 }, // the litter box
      ],
      spots: [
        { x: 5, y: 8 }, // sofa
        { x: 16, y: 5 }, // bed
        { x: 8, y: 3 }, // under the street window
        { x: 22, y: 7 }, // balcony
        { x: 19, y: 16 }, // the study rug
        { x: 4, y: 16 }, // waiting by the fridge
      ],
      toy: { x: 7, y: 10 },
      litterBox: { x: 6, y: 19 },
    },
  }
}
