/// <reference types="bun" />
import { describe, expect, test } from 'bun:test'
import { LAYOUT, makeGrid, rectTiles, tileKey, type Rect, type Tile } from '../../src/game/house3d/layout'
import { getTopic } from '../../src/game/topics'

const grid = makeGrid(LAYOUT)
const roomById = new Map(LAYOUT.rooms.map((room) => [room.id, room]))
const inside = ([x, y, w, h]: Rect, [tx, ty]: Tile) => tx >= x && ty >= y && tx < x + w && ty < y + h

describe('low-poly house layout', () => {
  test('rooms fill one rectangle without overlapping', () => {
    const seen = new Map<string, string>()
    for (const room of LAYOUT.rooms)
      for (const [x, y] of rectTiles(room.rect)) {
        expect(seen.get(tileKey(x, y)), `${room.id} overlaps at ${x},${y}`).toBeUndefined()
        seen.set(tileKey(x, y), room.id)
      }
    const width = Math.max(...LAYOUT.rooms.map((r) => r.rect[0] + r.rect[2]))
    const height = Math.max(...LAYOUT.rooms.map((r) => r.rect[1] + r.rect[3]))
    expect(seen.size).toBe(width * height)
  })

  test('every edge between rooms, and round the flat, has exactly one wall naming the rooms either side', () => {
    const covered = new Map<string, string>()
    for (const wall of LAYOUT.walls) {
      expect(wall.from).toBeLessThan(wall.to)
      for (let i = wall.from; i < wall.to; i++) {
        const [before, after]: [Tile, Tile] = wall.axis === 'h' ? [[i, wall.at - 1], [i, wall.at]] : [[wall.at - 1, i], [wall.at, i]]
        const edge = `${wall.axis}:${wall.at}:${i}`
        expect(covered.get(edge), `${wall.id} doubles ${covered.get(edge)}`).toBeUndefined()
        covered.set(edge, wall.id)
        expect(grid.roomAt(...before)?.id ?? null, `${wall.id} at ${i}`).toBe(wall.rooms[0])
        expect(grid.roomAt(...after)?.id ?? null, `${wall.id} at ${i}`).toBe(wall.rooms[1])
      }
      for (const o of wall.openings) {
        expect(o.from, `${wall.id} opening`).toBeGreaterThanOrEqual(wall.from)
        expect(o.from + o.width, `${wall.id} opening`).toBeLessThanOrEqual(wall.to)
      }
    }
    // Every tile edge where the room changes (or the flat ends) is walled.
    for (const room of LAYOUT.rooms)
      for (const [x, y] of rectTiles(room.rect)) {
        for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
          if (grid.roomAt(x + dx, y + dy)?.id === room.id) continue
          const edge = dx ? `v:${dx > 0 ? x + 1 : x}:${y}` : `h:${dy > 0 ? y + 1 : y}:${x}`
          expect(covered.has(edge), `${room.id} is open at ${x},${y} towards ${dx},${dy}`).toBe(true)
        }
      }
  })

  test('furniture stands inside its room, and solid pieces never share a tile', () => {
    const taken = new Map<string, string>()
    const ids = new Set<string>()
    for (const item of LAYOUT.furniture) {
      expect(ids.has(item.id), `${item.id} is listed twice`).toBe(false)
      ids.add(item.id)
      const room = roomById.get(item.room)!
      expect(room, item.id).toBeDefined()
      for (const tile of rectTiles(item.rect)) {
        expect(inside(room.rect, tile), `${item.id} leaves the ${item.room} at ${tile}`).toBe(true)
        if (!item.solid) continue
        expect(taken.get(tileKey(...tile)), `${item.id} overlaps`).toBeUndefined()
        taken.set(tileKey(...tile), item.id)
      }
    }
  })

  test('every interactable can be reached from a walkable tile beside it', () => {
    const furniture = new Set(LAYOUT.furniture.map((f) => f.id))
    for (const item of LAYOUT.interactables) {
      expect(grid.standingTiles(item.tiles).size, item.id).toBeGreaterThan(0)
      for (const id of item.furniture) expect(furniture.has(id), `${item.id} → ${id}`).toBe(true)
      const path = grid.findPath(LAYOUT.spawn, grid.standingTiles(item.tiles))
      expect(path, `${item.id} can't be reached from the front door`).not.toBeNull()
    }
  })

  test('the TV opens the same page as the pixel house', () => {
    const tv = LAYOUT.interactables.find((i) => i.id === 'watching')!
    expect(tv.action).toEqual({ type: 'navigate', href: getTopic('watching').href })
  })

  test('the visitor arrives in the hall and can walk to every room', () => {
    expect(grid.roomAt(...LAYOUT.spawn)?.id).toBe('hall')
    expect(grid.walkable(...LAYOUT.spawn)).toBe(true)
    for (const room of LAYOUT.rooms) {
      expect(grid.roomAt(...room.spawn)?.id, room.id).toBe(room.id)
      expect(grid.walkable(...room.spawn), `${room.id} spawn`).toBe(true)
      expect(grid.findPath(LAYOUT.spawn, new Set([tileKey(...room.spawn)])), `no way to the ${room.id}`).not.toBeNull()
    }
  })

  test('walls stop a walk that doorways allow', () => {
    // Living room to bedroom: a wall at x = 10, so the way round is through the hall and corridor.
    const path = grid.findPath([9, 5], new Set([tileKey(10, 5)]))!
    expect(path.length).toBeGreaterThan(10)
    expect(grid.canStep(9, 5, 1, 0)).toBe(false)
    expect(grid.canStep(8, 9, 0, 1)).toBe(true) // the open side to the hall
    // A body can't stand in a wall, but fits through a doorway.
    expect(grid.blocked(10 * grid.tile, 5.5 * grid.tile, 0.2)).toBe(true)
    expect(grid.blocked(10 * grid.tile, 10.5 * grid.tile, 0.2)).toBe(false)
  })

  test("Zeno's places are where a cat can be", () => {
    const perches = new Set(LAYOUT.zeno.perches.map((t) => tileKey(...t)))
    for (const tile of [LAYOUT.zeno.start, ...LAYOUT.zeno.spots, LAYOUT.zeno.toy, LAYOUT.zeno.litterBox])
      expect(grid.walkable(...tile) || perches.has(tileKey(...tile)), `${tile}`).toBe(true)
  })
})
