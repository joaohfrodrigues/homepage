import { test, expect } from './fixtures'
import { decorTiles, furnishHouse } from '../../src/game/furnishings'
import { MAP_HEIGHT, MAP_WIDTH, ROOMS, TILE, getRoom, isFloorCell, type Point, type UnlockId } from '../../src/game/layout'
import { limezuRect } from '../../src/game/limezu-furniture'
import { MISSIONS } from '../../src/game/missions'
import { SEASONS, type Season } from '../../src/game/seasons'

// Pure checks on the floor plan and furniture: no browser needed.

const key = (p: Point) => `${p.x},${p.y}`
const neighbours = (p: Point): Point[] => [
  { x: p.x + 1, y: p.y },
  { x: p.x - 1, y: p.y },
  { x: p.x, y: p.y + 1 },
  { x: p.x, y: p.y - 1 },
]

function solidFurniture(season: Season | null): Set<string> {
  const solid = new Set<string>()
  for (const item of furnishHouse(season).decor) {
    if (!item.solid) continue
    decorTiles(item).forEach((tile) => solid.add(key(tile)))
  }
  return solid
}

/** Everything missions can open, as if the visitor had finished them all. */
const EVERYTHING = new Set(MISSIONS.flatMap((mission) => (mission.reward.unlock ? [mission.reward.unlock] : [])))

const onFloor = (p: Point, unlocks?: Set<UnlockId>) =>
  p.x >= 0 && p.y >= 0 && p.x < MAP_WIDTH && p.y < MAP_HEIGHT && isFloorCell(p.x, p.y, unlocks)

/** Every tile a visitor can stand on, walking from the front door. */
function reachableFromFrontDoor(season: Season | null, unlocks?: Set<UnlockId>): Set<string> {
  const solid = solidFurniture(season)
  return reachable(getRoom('hall').spawn, (p) => onFloor(p, unlocks) && !solid.has(key(p)))
}

/** Every tile Zeno can get to: the floor, plus the furniture he's allowed on. */
function reachableByZeno(season: Season | null): Set<string> {
  const solid = solidFurniture(season)
  const { start, perches } = furnishHouse(season).zeno
  const perch = new Set(perches.map(key))
  return reachable(start, (p) => onFloor(p) && (!solid.has(key(p)) || perch.has(key(p))))
}

function reachable(start: Point, walkable: (p: Point) => boolean): Set<string> {
  const seen = new Set([key(start)])
  const queue = [start]
  while (queue.length > 0) {
    for (const next of neighbours(queue.shift()!)) {
      if (walkable(next) && !seen.has(key(next))) {
        seen.add(key(next))
        queue.push(next)
      }
    }
  }
  return seen
}

// Every check holds with each season's decorations up, as well as on an ordinary day.
for (const season of [null, ...SEASONS]) {
  test.describe(`House layout${season ? ` (${season})` : ''}`, () => {
    test('every interactable can be reached and faced from the floor', () => {
      const reachable = reachableFromFrontDoor(season)
      const stranded = furnishHouse(season)
        .interactables.filter((object) => !object.tiles.some((tile) => neighbours(tile).some((n) => reachable.has(key(n)))))
        .map((object) => object.id)
      expect(stranded).toEqual([])
    })

    test('every open room spawns the visitor on a reachable tile', () => {
      const reachable = reachableFromFrontDoor(season)
      const blocked = ROOMS.filter((room) => !room.unlock && !reachable.has(key(room.spawn))).map((room) => room.id)
      expect(blocked).toEqual([])
    })

    test('once missions open everything, every room and interactable can be reached', () => {
      const reachable = reachableFromFrontDoor(season, EVERYTHING)
      const blocked = ROOMS.filter((room) => !reachable.has(key(room.spawn))).map((room) => room.id)
      expect(blocked).toEqual([])
      const stranded = furnishHouse(season)
        .interactables.filter((object) => !object.until || !EVERYTHING.has(object.until))
        .filter((object) => !object.tiles.some((tile) => neighbours(tile).some((n) => reachable.has(key(n)))))
        .map((object) => object.id)
      expect(stranded).toEqual([])
    })

    test('Zeno can reach all his favourite spots, his toy and his litter box', () => {
      const reachable = reachableByZeno(season)
      const { spots, toy, litterBox } = furnishHouse(season).zeno
      const missed = [...spots, toy, litterBox].filter((spot) => !reachable.has(key(spot)))
      expect(missed).toEqual([])
    })

    test('tall pack furniture only rises over tiles nobody stands on', () => {
      // Furniture is baked under the characters, so someone standing behind a tall
      // plant would be drawn over its leaves. A few pixels of overhang is fine.
      const reachable = reachableFromFrontDoor(season)
      const exposed = furnishHouse(season)
        .decor.filter((item) => item.kind === 'limezu')
        .filter((item) => {
          const overhang = item.y * TILE - limezuRect(item.sprite, item.x, item.y, item.area?.w, item.area?.h).y
          return overhang > 4 && reachable.has(key({ x: item.x, y: item.y - 1 }))
        })
        .map((item) => `${item.sprite} at ${item.x},${item.y}`)
      expect(exposed).toEqual([])
    })

    test('decorations take up only their own tiles, never a path to somewhere else', () => {
      const taken = solidFurniture(season)
      // Before any mission and after them all.
      for (const unlocks of [undefined, EVERYTHING]) {
        const everyday = reachableFromFrontDoor(null, unlocks)
        const today = reachableFromFrontDoor(season, unlocks)
        const cutOff = [...everyday].filter((tile) => !today.has(tile) && !taken.has(tile))
        expect(cutOff).toEqual([])
      }
    })
  })
}
