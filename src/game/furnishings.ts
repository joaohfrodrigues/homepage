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
  const topicItem = (id: TopicId, tiles: Point[]) =>
    interactables.push({ id, label: getTopic(id).item, tiles, action: topicAction(id) })

  // --- Study: a cosy library around the map table --------------------------
  prop('rug', 3, 4, false)
  topicItem('writing', [1, 2, 3, 4].flatMap((x) => prop('bookshelf', x, 2)))
  prop('fireplace', 6, 1)
  topicItem('home-server', [...prop('desk', 8, 2), ...prop('serverrack', 10, 2)])
  kenney(K.plant, 11, 3, true)
  topicItem('trips', prop('maptable', 4, 5))
  prop('armchair', 9, 6)
  prop('floorlamp', 10, 5)
  topicItem('camera', prop('camerastand', 1, 6))
  kenney(K.plantSmall, 1, 9, true)
  kenney(K.plant, 11, 9, true)

  // --- Living room ----------------------------------------------------------
  prop('rugteal', 15, 4, false)
  topicItem('watching', prop('tv', 17, 2))
  kenney(K.landscapes[0], 14, 2)
  kenney(K.landscapes[1], 21, 2)
  kenney(K.plant, 13, 3, true)
  kenney(K.plant, 23, 3, true)
  prop('sofa', 16, 7)
  topicItem('drums', prop('drums', 21, 6))
  kenney(K.plantSmall, 13, 9, true)

  // --- Mudroom --------------------------------------------------------------
  kenney(K.runnerH.left, 2, 14)
  for (let x = 3; x < 22; x++) kenney(K.runnerH.mid, x, 14)
  kenney(K.runnerH.right, 22, 14)
  topicItem('running', [...prop('medalboard', 2, 10), ...prop('shoerack', 2, 12)])
  topicItem('hiking', [...prop('coathooks', 20, 10), ...prop('boots', 21, 12)])
  kenney(K.mirror, 9, 11)
  kenney(K.paintings[4], 15, 11)
  kenney(K.plant, 1, 16, true)
  kenney(K.plant, 23, 16, true)

  prop('doormat', 12, 16, false)
  prop('letterbox', 11, 16)
  interactables.push({
    id: 'letterbox',
    label: 'Letterbox — get in touch',
    tiles: [{ x: 11, y: 16 }],
    action: { type: 'dialogue', id: 'letterbox' },
  })

  interactables.push({
    id: 'directory',
    label: 'House directory',
    tiles: prop('signboard', 14, 15),
    action: { type: 'directory' },
  })
  labels.push({ text: 'DIRECTORY', x: 14 * 16 + 8, y: 15 * 16 - 4 })

  interactables.push({
    id: 'front-door',
    label: 'Front door',
    tiles: [{ x: 12, y: 17 }],
    action: { type: 'dialogue', id: 'front-door' },
  })

  // Room names over the doorways, read from the mudroom.
  labels.push({ text: 'STUDY', x: 6 * 16 + 8, y: 10 * 16 + 2 })
  labels.push({ text: 'LIVING ROOM', x: 18 * 16 + 8, y: 10 * 16 + 2 })

  return {
    decor,
    interactables,
    labels,
    npcStart: { x: 19, y: 5 },
    npcArea: { x: 13, y: 4, w: 11, h: 6 },
  }
}
