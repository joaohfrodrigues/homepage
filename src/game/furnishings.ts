import type { InteractAction } from './bridge'
import type { Point, UnlockId } from './layout'
import type { LimezuSprite } from './limezu-furniture'
import { PROP_SIZES, type PropName } from './pixels'
import type { Season } from './seasons'
import { getTopic, type TopicId } from './topics'

export type Decor =
  | { kind: 'prop'; prop: PropName; x: number; y: number; solid: boolean }
  /** A Modern Interiors sprite standing on one tile; tall ones rise over the tile above. */
  /** A Modern Interiors sprite centred over `area` tiles (one by default). */
  | { kind: 'limezu'; sprite: LimezuSprite; x: number; y: number; solid: boolean; area?: { w: number; h: number } }

export interface Interactable {
  id: string
  label: string
  tiles: Point[]
  action: InteractAction
  /** Gone once this is unlocked, like the handle of a door that now stands open. */
  until?: UnlockId
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

/** The tiles a piece of decor covers: a prop's size, a pack sprite's area, or one tile. */
export function decorTiles(decor: Decor): Point[] {
  if (decor.kind === 'prop') return propTiles(decor)
  if (decor.kind === 'limezu' && decor.area) return tilesOf(decor.x, decor.y, decor.area.w, decor.area.h)
  return [{ x: decor.x, y: decor.y }]
}

/** Opening a topic goes straight into its window. */
function topicAction(id: TopicId): InteractAction {
  return { type: 'navigate', href: getTopic(id).href }
}

/**
 * Everything placed in the house. Props drawn on a wall face (the rows directly
 * above a room) sit on tiles that are already solid; floor props block movement.
 * A `season` adds its decorations on top.
 */
export function furnishHouse(season: Season | null = null): Furnishings {
  const decor: Decor[] = []
  const interactables: Interactable[] = []
  const limezu = (sprite: LimezuSprite, x: number, y: number, solid = true) =>
    decor.push({ kind: 'limezu', sprite, x, y, solid })
  /** A solid pack sprite over a w x h area; returns its tiles. */
  const limezuArea = (sprite: LimezuSprite, x: number, y: number, w: number, h: number) => {
    const item: Decor = { kind: 'limezu', sprite, x, y, solid: true, area: { w, h } }
    decor.push(item)
    return decorTiles(item)
  }
  /** Rugs lie flat under everything, centred over their area. */
  const rug = (sprite: LimezuSprite, x: number, y: number, w: number, h: number) =>
    decor.push({ kind: 'limezu', sprite, x, y, solid: false, area: { w, h } })
  const prop = (name: PropName, x: number, y: number, solid = true) => {
    const item: Decor = { kind: 'prop', prop: name, x, y, solid }
    decor.push(item)
    return propTiles(item)
  }
  const topicItem = (id: TopicId, tiles: Point[]) =>
    interactables.push({ id, label: getTopic(id).item, tiles, action: topicAction(id) })

  // Rugs first: decor is drawn in order, and furniture stands on them.
  rug('rugTerracotta', 3, 3, 5, 4)
  rug('rugBeige', 12, 6, 5, 2)
  rug('rugTaupeStudy', 17, 13, 4, 4)
  rug('runnerTaupe', 11, 11, 4, 2)
  rug('doormatTaupe', 8, 17, 2, 1)

  // --- Living room (4 × 4m) -----------------------------------------------------
  // Two street windows either side of a terracotta chimney breast; the TV hangs on
  // it, so the sofa faces the soft north light rather than having it behind the screen.
  prop('chimney', 4, 1, false)
  topicItem('watching', prop('tv', 4, 1))
  prop('coffeetable', 5, 4)
  prop('sofa', 4, 5)
  prop('floorlamp', 3, 5)
  // Dining behind the sofa, by the kitchen's pocket door: two steps from the hob.
  // Chairs can be walked over (pulled out of the way); tables and sofas can't.
  prop('diningtable', 2, 8)
  prop('chair', 2, 7, false)
  prop('chair', 4, 7, false)
  prop('chairup', 2, 10, false)
  prop('chairup', 4, 10, false)
  // The right-hand side stays clear: it's the way in from the hall.
  interactables.push({
    id: 'recordplayer',
    label: 'Record player — put some music on',
    tiles: prop('recordplayer', 9, 5),
    action: { type: 'panel', panel: 'recordplayer' },
  })
  limezu('leafyPlant', 2, 3)
  limezu('tallBush', 9, 3)

  // --- Kitchen (2.5 × 2.5m) -----------------------------------------------------
  // An L of counters on the two walls without doors: sink and coffee machine
  // along the north wall, the hob on the west wall away from the sink, and the
  // fridge at the end of the run by the pocket door, with floor in front of it.
  prop('sink', 1, 12)
  interactables.push({
    id: 'coffee',
    label: 'Coffee machine — pull a bica',
    tiles: prop('coffeecounter', 2, 12),
    action: { type: 'panel', panel: 'bica' },
  })
  interactables.push({
    id: 'fridge',
    label: 'Fridge — magnets, and something cold',
    tiles: prop('fridge', 3, 12),
    action: { type: 'dialogue', id: 'fridge' },
  })
  prop('kcounter', 1, 14)
  prop('khob', 1, 15)
  prop('kcounter', 1, 16)
  prop('kcounter', 1, 17)
  interactables.push({
    id: 'litterbox',
    label: 'Clean Zeno’s litter box',
    tiles: prop('litterbox', 5, 17),
    action: { type: 'dialogue', id: 'litterbox-clean' },
  })

  // --- Entrance hall (1.5 × 3.5m), open to the living room ------------------------
  topicItem('running', prop('medalstand', 7, 11))
  prop('console', 7, 13)
  interactables.push({
    id: 'letterbox',
    label: 'Post on the console — get in touch',
    tiles: [{ x: 7, y: 13 }],
    action: { type: 'dialogue', id: 'letterbox' },
  })
  interactables.push({
    id: 'directory',
    label: 'Floor plan — house directory',
    tiles: [{ x: 7, y: 14 }],
    action: { type: 'panel', panel: 'directory' },
  })
  topicItem('hiking', [...prop('coatstand', 9, 13), ...prop('boots', 9, 15)])
  interactables.push({
    id: 'guestbook',
    label: 'Guestbook — your visit so far',
    tiles: prop('guestbook', 9, 16),
    action: { type: 'panel', panel: 'guestbook' },
  })
  limezu('fern', 7, 17)
  interactables.push({
    id: 'front-door',
    label: 'Front door',
    tiles: [
      { x: 8, y: 18 },
      { x: 9, y: 18 },
    ],
    action: { type: 'dialogue', id: 'front-door' },
  })

  // --- Corridor (2 × 1m) ---------------------------------------------------------
  // Its one free stretch of wall, left of the bedroom door, carries the leaderboards.
  interactables.push({
    id: 'leaderboards',
    label: 'Trophy poster — leaderboards',
    tiles: limezuArea('trophyPoster', 11, 9, 2, 2),
    action: { type: 'panel', panel: 'leaderboards' },
  })

  // --- Bedroom (3 × 3m) ---------------------------------------------------------
  // A double bed against the north wall between two bedside tables, the
  // wardrobe along the west wall under the window.
  interactables.push({
    id: 'bed',
    label: 'Bed — take a nap',
    tiles: limezuArea('bedTeakGrey', 14, 3, 2, 2),
    action: { type: 'dialogue', id: 'bed' },
  })
  prop('nightstand', 13, 3)
  interactables.push({
    id: 'alarm',
    label: 'Alarm clock',
    tiles: prop('alarmclock', 16, 3),
    action: { type: 'dialogue', id: 'alarm' },
  })
  interactables.push({
    id: 'wardrobe',
    label: 'Wardrobe — change outfit',
    tiles: prop('wardrobeside', 11, 4),
    action: { type: 'panel', panel: 'wardrobe' },
  })
  limezu('snakePlant', 11, 8)

  // --- Balcony (1 × 2m) ---------------------------------------------------------
  prop('cafetable', 19, 4)
  prop('cafechair', 19, 5, false)
  limezu('palm', 18, 3)
  limezu('topiary', 19, 6)
  interactables.push({
    id: 'balcony',
    label: 'Railing — look out over Lisbon',
    tiles: [
      { x: 18, y: 2 },
      { x: 19, y: 2 },
      ...[3, 4, 5, 6].map((y) => ({ x: 20, y })),
    ],
    action: { type: 'dialogue', id: 'balcony' },
  })

  // --- Bathroom (2 × 2.5m), behind a stuck door until its mission -------------
  interactables.push({
    id: 'bathroom-door',
    label: 'Bathroom door',
    tiles: [
      { x: 13, y: 13 },
      { x: 14, y: 13 },
      { x: 13, y: 14 },
      { x: 14, y: 14 },
    ],
    action: { type: 'dialogue', id: 'bathroom' },
    until: 'bathroom',
  })
  prop('toilet', 11, 14)
  interactables.push({
    id: 'cabinet',
    label: 'Mirror cabinet',
    tiles: prop('basin', 12, 14),
    action: { type: 'dialogue', id: 'cabinet' },
  })
  prop('shower', 13, 18)
  prop('bathmat', 11, 18, false)

  // --- Study (3 × 3.5m) ---------------------------------------------------------
  // Entered from the end of the corridor, so its whole north wall is free for
  // the map and the desk.
  topicItem('trips', prop('wallmap', 16, 9))
  topicItem('home-server', prop('desk', 19, 10))
  prop('officechair', 20, 12, false)
  topicItem('writing', [...prop('bookshelfside', 21, 13), ...prop('bookshelfside', 21, 15)])
  prop('floorlamp', 16, 13)
  topicItem('drums', prop('drums', 16, 15))
  topicItem('camera', prop('camerastand', 19, 16))
  limezu('pottedTree', 21, 17)

  // --- Seasonal -----------------------------------------------------------------
  // Only spare floor, tabletops and wall faces, so every path and item
  // stays reachable whatever the date.
  const garlands = () => [2, 4, 6, 8].forEach((x) => prop('garland', x, 1, false))
  if (season === 'xmas') {
    prop('xmastree', 5, 8)
    prop('bolorei', 3, 8, false)
  } else if (season === 'santos') {
    garlands()
    prop('sardines', 19, 4, false)
    // Manjericos in their pots along the balcony railing.
    limezu('sprig', 19, 2, false)
    limezu('sprig', 20, 2, false)
  } else if (season === 'halloween') {
    prop('pumpkin', 9, 17)
  } else if (season === 'newyear' || season === 'birthday') {
    garlands()
    prop('balloons', 5, 8)
  }

  return {
    decor,
    interactables,
    npcStart: { x: 6, y: 8 },
    npcArea: { x: 2, y: 3, w: 8, h: 8 },
    zeno: {
      start: { x: 6, y: 9 },
      perches: [
        ...[4, 5, 6, 7].map((x) => ({ x, y: 5 })), // the sofa seat, beyond its back
        ...[14, 15].flatMap((x) => [3, 4].map((y) => ({ x, y }))), // the duvet
        { x: 5, y: 17 }, // the litter box
      ],
      spots: [
        { x: 5, y: 5 }, // sofa
        { x: 15, y: 4 }, // bed
        { x: 8, y: 3 }, // under the street window
        { x: 18, y: 6 }, // balcony
        { x: 18, y: 14 }, // the study rug
        { x: 4, y: 14 }, // waiting by the fridge
      ],
      toy: { x: 7, y: 8 },
      litterBox: { x: 5, y: 17 },
    },
  }
}
