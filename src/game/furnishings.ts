import type { InteractAction } from './bridge'
import type { Point } from './layout'
import { PROP_SIZES, type PropName } from './pixels'
import { getTopic, type TopicId } from './topics'

/** Frame indices into the Kenney "Roguelike Indoors" sheet (27 columns). */
const K = {
  plant: 16,
  plantSmall: 17,
  mirror: 400,
  paintings: [340, 341, 342, 367, 368, 369],
  landscapes: [343, 370, 397],
  runnerH: { left: 243, mid: 244, right: 245 },
}

export type Decor =
  | { kind: 'kenney'; frame: number; x: number; y: number; solid: boolean }
  | { kind: 'prop'; prop: PropName; x: number; y: number; solid: boolean }

export interface Interactable {
  id: string
  label: string
  tiles: Point[]
  action: InteractAction
}

export interface Label {
  text: string
  x: number
  y: number
}

export interface Furnishings {
  decor: Decor[]
  interactables: Interactable[]
  labels: Label[]
  npcStart: Point
  /** João wanders inside this rectangle when nobody is talking to him. */
  npcArea: { x: number; y: number; w: number; h: number }
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

/** Opening a topic: straight into its window if it lives in the house, else a look first. */
export function topicAction(id: TopicId): InteractAction {
  const topic = getTopic(id)
  return topic.inHouse ? { type: 'navigate', href: topic.href } : { type: 'dialogue', id: `topic:${id}` }
}

/**
 * Everything placed in the house. Props drawn on a wall face (the rows directly
 * above a room) sit on tiles that are already solid; floor props block movement.
 */
export function furnishHouse(): Furnishings {
  const decor: Decor[] = []
  const interactables: Interactable[] = []
  const labels: Label[] = []
  const kenney = (frame: number, x: number, y: number, solid = false) =>
    decor.push({ kind: 'kenney', frame, x, y, solid })
  const prop = (name: PropName, x: number, y: number, solid = true) => {
    const item: Decor = { kind: 'prop', prop: name, x, y, solid }
    decor.push(item)
    return propTiles(item)
  }
  const topicItem = (id: TopicId, tiles: Point[], extra?: { key: string; label: string }) =>
    interactables.push({
      id: extra?.key ?? id,
      label: extra?.label ?? getTopic(id).item,
      tiles,
      action: topicAction(id),
    })
  const paintings = [...K.paintings, ...K.landscapes]

  // Rugs first: decor is drawn in order, and furniture stands on them.
  prop('rugbed', 2, 7, false)
  prop('rugstudy', 18, 5, false)
  prop('rugliving', 2, 17, false)

  // --- Bedroom (4 × 3.5m) -------------------------------------------------------
  prop('bed', 3, 2)
  prop('nightstand', 2, 3)
  prop('nightstand', 6, 3)
  prop('wardrobe', 7, 2)
  kenney(K.landscapes[2], 1, 2)
  kenney(K.plantSmall, 8, 9, true)

  // --- Bathroom (2 × 3.5m) ------------------------------------------------------
  prop('toilet', 10, 2)
  prop('basin', 11, 2)
  prop('shower', 12, 3)
  prop('bathmat', 11, 7, false)

  // --- Study (5 × 3.5m) ---------------------------------------------------------
  topicItem('writing', [15, 16, 17, 18].flatMap((x) => prop('bookshelf', x, 2)))
  topicItem('trips', prop('wallmap', 19, 1))
  topicItem('home-server', prop('desk', 22, 2))
  prop('officechair', 23, 4)
  prop('armchair', 15, 6)
  prop('floorlamp', 17, 6)
  topicItem('camera', prop('camerastand', 24, 5))
  topicItem('drums', prop('drums', 23, 7))
  kenney(K.plant, 15, 9, true)
  kenney(K.plantSmall, 24, 9, true)

  // --- Corridor (1m wide) -------------------------------------------------------
  kenney(K.runnerH.left, 2, 13)
  for (let x = 3; x < 23; x++) kenney(K.runnerH.mid, x, 13)
  kenney(K.runnerH.right, 23, 13)
  ;[2, 8, 15, 23].forEach((x, i) => kenney(paintings[(i * 2) % paintings.length], x, 11))
  kenney(K.plant, 1, 12, true)
  kenney(K.plant, 24, 12, true)

  // --- Living room (6 × 4m) -----------------------------------------------------
  topicItem('watching', prop('tv', 3, 14))
  kenney(K.landscapes[0], 9, 15)
  kenney(K.landscapes[1], 11, 15)
  prop('coffeetable', 4, 18)
  prop('sofa', 3, 20)
  prop('floorlamp', 7, 20)
  prop('diningtable', 9, 19)
  prop('chair', 9, 18)
  prop('chair', 11, 18)
  prop('chairup', 9, 21)
  prop('chairup', 11, 21)
  kenney(K.plant, 1, 16, true)
  kenney(K.plant, 1, 23, true)

  // --- Kitchen (3 × 4m) ---------------------------------------------------------
  prop('counter', 19, 15)
  prop('coffeecounter', 20, 15)
  prop('stove', 21, 15)
  prop('sink', 22, 15)
  prop('counter', 23, 15)
  topicItem('trips', prop('fridge', 24, 15), { key: 'fridge', label: 'Fridge magnets — every trip' })
  prop('kitchentable', 20, 19)
  prop('chair', 20, 18)
  prop('chairup', 21, 21)
  kenney(K.plantSmall, 24, 23, true)

  // --- Entrance hall (2 × 4m) ---------------------------------------------------
  topicItem('hiking', [...prop('coathooks', 14, 14), ...prop('boots', 14, 16)])
  topicItem('running', [...prop('medalhanger', 17, 14), ...prop('shoerack', 17, 16)])
  prop('console', 14, 21)
  interactables.push({
    id: 'letterbox',
    label: 'Post on the console — get in touch',
    tiles: [{ x: 14, y: 21 }],
    action: { type: 'dialogue', id: 'letterbox' },
  })
  interactables.push({
    id: 'directory',
    label: 'Floor plan — house directory',
    tiles: [{ x: 14, y: 22 }],
    action: { type: 'directory' },
  })
  prop('doormat', 15, 23, false)
  kenney(K.plantSmall, 17, 23, true)
  interactables.push({
    id: 'front-door',
    label: 'Front door',
    tiles: [
      { x: 15, y: 24 },
      { x: 16, y: 24 },
    ],
    action: { type: 'dialogue', id: 'front-door' },
  })

  // Room names over the doorways, read from the corridor.
  labels.push({ text: 'BEDROOM', x: 5 * 16, y: 10 * 16 + 2 })
  labels.push({ text: 'BATHROOM', x: 12 * 16, y: 10 * 16 + 2 })
  labels.push({ text: 'STUDY', x: 20 * 16, y: 10 * 16 + 2 })
  labels.push({ text: 'HALL', x: 16 * 16, y: 14 * 16 + 2 })

  return {
    decor,
    interactables,
    labels,
    npcStart: { x: 8, y: 17 },
    npcArea: { x: 1, y: 17, w: 12, h: 7 },
  }
}
