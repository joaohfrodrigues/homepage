import * as Phaser from 'phaser'
import type { HouseBridge, Hint, InteractAction } from './bridge'
import { furnishHouse, propTiles, type Furnishings, type Interactable } from './furnishings'
import {
  FLOOR_PLAN,
  MAP_HEIGHT,
  MAP_WIDTH,
  TILE,
  cellAt,
  getRoom,
  isFloorCell,
  roomAt,
  roomBelow,
  wallPartAt,
  type Point,
  type RoomId,
} from './layout'
import { isOnMap, projectToMap } from './map-projection'
import {
  FIREPLACE_FIRE,
  LIGHT_SOURCES,
  MAP_TABLE,
  FACINGS,
  PROP_SIZES,
  STEPS,
  SERVER_LEDS,
  drawCharacter,
  drawDoorway,
  drawFloor,
  drawFrontDoor,
  drawProp,
  drawWallCap,
  drawWallFace,
  type CharacterName,
  type Facing,
  type PropName,
} from './pixels'
import type { Trip } from '@/lib/photos'

export interface HouseSceneConfig {
  bridge: HouseBridge
  trips: Trip[]
  startRoom: RoomId
  fontFamily: string
}

type Direction = 'up' | 'down' | 'left' | 'right'

const DELTAS: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

const KEY_STEPS: Record<string, Direction> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
}

const KENNEY_COLUMNS = 27
const PLAYER_STEP_MS = 150
const NPC_STEP_MS = 260

interface Walker {
  sprite: Phaser.GameObjects.Sprite
  who: CharacterName
  tile: Point
  facing: Direction
  moving: boolean
}

type Target = { kind: 'object'; object: Interactable } | { kind: 'npc' }

const key = (p: Point) => `${p.x},${p.y}`

export class HouseScene extends Phaser.Scene {
  private cfg!: HouseSceneConfig
  private furnishings!: Furnishings
  private solid = new Set<string>()
  private objectsByTile = new Map<string, Interactable>()
  private player!: Walker
  private npc!: Walker
  private npcLabel!: Phaser.GameObjects.Text
  private keys!: Record<string, Phaser.Input.Keyboard.Key>
  private highlight!: Phaser.GameObjects.Graphics
  private inputEnabled = true
  private path: Point[] = []
  private pendingTarget: Target | null = null
  /**
   * Key presses are queued from keydown events rather than read with
   * Keyboard.JustDown: Phaser clears a key's "just down" flag on keyup, so a tap
   * that starts and ends within one frame would otherwise be lost.
   */
  private queuedStep: Direction | null = null
  private queuedInteract = false
  /** Keys pressed before this (e.g. Enter on a dialogue choice) belong to React. */
  private inputEnabledAt = 0
  private hoverTarget: Target | null = null
  private lastHint = ''
  private currentRoom: RoomId | null = null
  private hasMoved = false
  private npcTalking = false
  private unsubscribers: (() => void)[] = []

  constructor() {
    super('house')
  }

  init(cfg: HouseSceneConfig) {
    this.cfg = cfg
    this.furnishings = furnishHouse()
  }

  preload() {
    this.load.spritesheet('furniture', '/house/furniture.png', {
      frameWidth: 16,
      frameHeight: 16,
      spacing: 1,
    })
    this.load.image('europe-wall', '/house/europe-map-wall.png')
  }

  create() {
    this.bakeHouse()
    this.bakeCharacters()
    this.buildCollision()
    this.addLabels()
    this.addAmbience()

    this.highlight = this.add.graphics().setDepth(5)

    const start = getRoom(this.cfg.startRoom).spawn
    this.player = this.addWalker('guest', start, this.spawnFacing(this.cfg.startRoom))
    const npcStart = this.furnishings.npcStart
    this.npc = this.addWalker('joao', npcStart, 'down')
    this.npcLabel = this.add
      .text(0, 0, 'João', this.textStyle('#f4ecd8', '#2a2233'))
      .setOrigin(0.5, 1)
      .setDepth(20)
    this.syncNpcLabel()

    this.setupCamera()
    this.setupInput()
    this.setupBridge()

    this.time.addEvent({ delay: 1800, loop: true, callback: () => this.wanderNpc() })

    this.updateRoom()
    this.updateHint()
    this.cfg.bridge.game.emit('ready')

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubscribers.forEach((off) => off()))
  }

  update() {
    if (!this.inputEnabled || this.player.moving) return

    const direction = this.heldDirection() ?? this.queuedStep
    this.queuedStep = null
    if (direction) {
      this.path = []
      this.pendingTarget = null
      this.tryStep(direction)
      return
    }

    if (this.path.length > 0) {
      const next = this.path.shift()!
      const dir = this.directionTo(this.player.tile, next)
      if (dir && this.isWalkable(next.x, next.y)) {
        this.tryStep(dir)
      } else {
        // Something (usually João) stepped into the way — give up on the walk.
        this.path = []
        this.pendingTarget = null
      }
      return
    }

    if (this.pendingTarget) {
      const target = this.pendingTarget
      this.pendingTarget = null
      this.faceTarget(target)
      this.interact(target)
      return
    }

    if (this.queuedInteract) {
      this.queuedInteract = false
      this.interactFacing()
    }
  }

  // -------------------------------------------------------------------------
  // Baking the static house into one texture

  private bakeHouse() {
    const width = MAP_WIDTH * TILE
    const height = MAP_HEIGHT * TILE
    const texture = this.textures.createCanvas('house-base', width, height)!
    const ctx = texture.getContext()
    ctx.imageSmoothingEnabled = false

    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const ox = x * TILE
        const oy = y * TILE
        const cell = FLOOR_PLAN[y][x]
        const below = roomBelow(x, y)
        if (cell === '.') {
          drawFloor(ctx, ox, oy, roomAt(x, y)?.floor ?? 'wood', x, y)
        } else if (cell === 'F') {
          drawFrontDoor(ctx, ox, oy)
        } else {
          const part = wallPartAt(x, y)
          if (part === 'cap' || !below) {
            drawWallCap(ctx, ox, oy)
          } else if (cell === 'D') {
            drawDoorway(ctx, ox, oy, below.floor, part, x, y, {
              left: cellAt(x - 1, y) !== 'D',
              right: cellAt(x + 1, y) !== 'D',
            })
          } else {
            drawWallFace(ctx, ox, oy, below.wall, part)
          }
        }
      }
    }

    const sheet = this.textures.get('furniture').getSourceImage() as HTMLImageElement
    for (const item of this.furnishings.decor) {
      if (item.kind === 'kenney') {
        const sx = (item.frame % KENNEY_COLUMNS) * 17
        const sy = Math.floor(item.frame / KENNEY_COLUMNS) * 17
        ctx.drawImage(sheet, sx, sy, 16, 16, item.x * TILE, item.y * TILE, 16, 16)
      } else {
        drawProp(ctx, item.x * TILE, item.y * TILE, item.prop)
      }
    }

    this.drawTableMap(ctx)
    texture.refresh()
    this.add.image(0, 0, 'house-base').setOrigin(0, 0).setDepth(0)
  }

  /** The trip map spread over the study's map table, one pin per trip. */
  private drawTableMap(ctx: CanvasRenderingContext2D) {
    const table = this.propAt('maptable')
    if (!table) return
    const map = this.textures.get('europe-wall').getSourceImage() as HTMLImageElement
    const ox = table.x * TILE + MAP_TABLE.x
    const oy = table.y * TILE + MAP_TABLE.y
    ctx.drawImage(map, ox, oy, MAP_TABLE.w, MAP_TABLE.h)
    for (const trip of this.cfg.trips) {
      const stop = trip.stops[0]
      if (!stop || !isOnMap(stop.lat, stop.lon)) continue
      const pos = projectToMap(stop.lat, stop.lon)
      const px = ox + Math.round(pos.x * (MAP_TABLE.w - 1))
      const py = oy + Math.round(pos.y * (MAP_TABLE.h - 1))
      ctx.fillStyle = '#2a2233'
      ctx.fillRect(px - 1, py - 1, 3, 3)
      ctx.fillStyle = '#e04434'
      ctx.fillRect(px, py, 1, 1)
    }
  }

  private bakeCharacters() {
    const who: CharacterName[] = ['guest', 'joao']
    const texture = this.textures.createCanvas('house-chars', FACINGS.length * STEPS.length * TILE, who.length * TILE)!
    const ctx = texture.getContext()
    who.forEach((name, row) => {
      FACINGS.forEach((facing, fi) => {
        STEPS.forEach((step, si) => {
          const col = fi * STEPS.length + si
          drawCharacter(ctx, col * TILE, row * TILE, name, facing, step)
          texture.add(`${name}-${facing}-${step}`, 0, col * TILE, row * TILE, TILE, TILE)
        })
      })
    })
    texture.refresh()

    for (const name of who) {
      for (const facing of FACINGS) {
        this.anims.create({
          key: `${name}-walk-${facing}`,
          frames: ['a', 'idle', 'b', 'idle'].map((step) => ({
            key: 'house-chars',
            frame: `${name}-${facing}-${step}`,
          })),
          frameRate: name === 'guest' ? 10 : 7,
          repeat: -1,
        })
      }
    }
  }

  private buildCollision() {
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        if (!isFloorCell(x, y)) this.solid.add(key({ x, y }))
      }
    }
    for (const item of this.furnishings.decor) {
      if (!item.solid) continue
      const tiles = item.kind === 'prop' ? propTiles(item) : [{ x: item.x, y: item.y }]
      tiles.forEach((tile) => this.solid.add(key(tile)))
    }
    for (const object of this.furnishings.interactables) {
      object.tiles.forEach((tile) => this.objectsByTile.set(key(tile), object))
    }
  }

  private addLabels() {
    for (const label of this.furnishings.labels) {
      this.add
        .text(label.x, label.y, label.text, this.textStyle('#f4ecd8', '#2a2233'))
        .setOrigin(0.5, 0.5)
        .setDepth(4)
    }
  }

  private textStyle(color: string, background?: string, fontSize = '6px'): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontFamily: this.cfg.fontFamily,
      fontSize,
      color,
      backgroundColor: background,
      padding: background ? { x: 2, y: 1 } : undefined,
      resolution: 8,
    }
  }

  private propAt(name: PropName): Point | undefined {
    return this.furnishings.decor.find((item) => item.kind === 'prop' && item.prop === name)
  }

  /** The cosy bits that move: fire, warm light pools and the server's LEDs. */
  private addAmbience() {
    const glow = this.textures.createCanvas('glow', 64, 64)!
    const gctx = glow.getContext()
    const gradient = gctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    gradient.addColorStop(0, 'rgba(255, 196, 120, 0.55)')
    gradient.addColorStop(1, 'rgba(255, 196, 120, 0)')
    gctx.fillStyle = gradient
    gctx.fillRect(0, 0, 64, 64)
    glow.refresh()

    for (const item of this.furnishings.decor) {
      if (item.kind !== 'prop') continue
      const light = LIGHT_SOURCES[item.prop]
      if (!light) continue
      const pool = this.add
        .image(item.x * TILE + light.x, item.y * TILE + light.y, 'glow')
        .setDisplaySize(light.radius * 2, light.radius * 2)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(item.prop === 'tv' ? 0.35 : 0.7)
        .setDepth(30)
      if (item.prop === 'fireplace') {
        this.tweens.add({ targets: pool, alpha: 0.45, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      }
    }

    const fireplace = this.propAt('fireplace')
    if (fireplace) {
      const flames = this.add.graphics().setDepth(1)
      const fx = fireplace.x * TILE + FIREPLACE_FIRE.x
      const bottom = fireplace.y * TILE + FIREPLACE_FIRE.y + FIREPLACE_FIRE.h
      const colors = [0xe0662b, 0xf2a43a, 0xffe08a]
      const draw = () => {
        flames.clear()
        for (let i = 0; i < FIREPLACE_FIRE.w; i += 2) {
          const centre = 1 - Math.abs(i - FIREPLACE_FIRE.w / 2) / (FIREPLACE_FIRE.w / 2)
          const height = Math.round((2 + centre * (FIREPLACE_FIRE.h - 3)) * (0.6 + Math.random() * 0.4))
          colors.forEach((color, layer) => {
            const h = Math.max(0, height - layer * 3)
            flames.fillStyle(color, 1)
            flames.fillRect(fx + i, bottom - h - 2, 2, h)
          })
        }
      }
      draw()
      this.time.addEvent({ delay: 120, loop: true, callback: draw })
    }

    const rack = this.propAt('serverrack')
    if (rack) {
      const leds = this.add.graphics().setDepth(1)
      const blink = () => {
        leds.clear()
        for (const led of SERVER_LEDS) {
          const on = Math.random() > 0.25
          leds.fillStyle(on ? 0x4cd964 : 0x1d4d2a, 1)
          leds.fillRect(rack.x * TILE + led.x, rack.y * TILE + led.y, 1, 1)
          if (Math.random() > 0.7) {
            leds.fillStyle(0xf2a43a, 1)
            leds.fillRect(rack.x * TILE + led.x + 1, rack.y * TILE + led.y, 1, 1)
          }
        }
      }
      blink()
      this.time.addEvent({ delay: 350, loop: true, callback: blink })
    }
  }

  // -------------------------------------------------------------------------
  // Characters and movement

  private addWalker(who: CharacterName, tile: Point, facing: Direction): Walker {
    const sprite = this.add
      .sprite(tile.x * TILE + TILE / 2, tile.y * TILE + TILE / 2, 'house-chars', `${who}-down-idle`)
      .setDepth(10 + tile.y / 100)
    const walker: Walker = { sprite, who, tile: { ...tile }, facing, moving: false }
    this.setIdle(walker)
    return walker
  }

  private spriteFacing(direction: Direction): Facing {
    return direction === 'left' || direction === 'right' ? 'side' : direction
  }

  private setIdle(walker: Walker) {
    walker.sprite.stop()
    walker.sprite.setFrame(`${walker.who}-${this.spriteFacing(walker.facing)}-idle`)
    walker.sprite.setFlipX(walker.facing === 'left')
  }

  private face(walker: Walker, direction: Direction) {
    walker.facing = direction
    if (!walker.moving) this.setIdle(walker)
  }

  private heldDirection(): Direction | null {
    const k = this.keys
    if (k.LEFT.isDown || k.A.isDown) return 'left'
    if (k.RIGHT.isDown || k.D.isDown) return 'right'
    if (k.UP.isDown || k.W.isDown) return 'up'
    if (k.DOWN.isDown || k.S.isDown) return 'down'
    return null
  }

  private isWalkable(x: number, y: number, ignoreNpc = false): boolean {
    if (this.solid.has(key({ x, y }))) return false
    if (!ignoreNpc && this.npc && this.npc.tile.x === x && this.npc.tile.y === y) return false
    if (this.player && this.player.tile.x === x && this.player.tile.y === y) return false
    return true
  }

  private tryStep(direction: Direction) {
    const walker = this.player
    const target = { x: walker.tile.x + DELTAS[direction].x, y: walker.tile.y + DELTAS[direction].y }
    this.face(walker, direction)
    if (!this.isWalkable(target.x, target.y)) {
      this.updateHint()
      return
    }
    if (!this.hasMoved) {
      this.hasMoved = true
      this.cfg.bridge.game.emit('moved')
    }
    this.moveWalker(walker, target, PLAYER_STEP_MS, () => {
      this.updateRoom()
      this.updateHint()
      // Stop the walk cycle unless the next frame keeps us moving.
      if (!this.heldDirection() && !this.queuedStep && this.path.length === 0) this.setIdle(walker)
    })
  }

  private moveWalker(walker: Walker, target: Point, duration: number, onDone: () => void) {
    walker.moving = true
    walker.tile = { ...target }
    walker.sprite.setFlipX(walker.facing === 'left')
    const anim = `${walker.who}-walk-${this.spriteFacing(walker.facing)}`
    if (walker.sprite.anims.currentAnim?.key !== anim || !walker.sprite.anims.isPlaying) {
      walker.sprite.play(anim)
    }
    this.tweens.add({
      targets: walker.sprite,
      x: target.x * TILE + TILE / 2,
      y: target.y * TILE + TILE / 2,
      duration,
      onUpdate: () => {
        if (walker === this.npc) this.syncNpcLabel()
      },
      onComplete: () => {
        walker.moving = false
        walker.sprite.setDepth(10 + target.y / 100)
        onDone()
      },
    })
  }

  private directionTo(from: Point, to: Point): Direction | null {
    const dx = to.x - from.x
    const dy = to.y - from.y
    if (Math.abs(dx) + Math.abs(dy) !== 1) return null
    if (dx === 1) return 'right'
    if (dx === -1) return 'left'
    return dy === 1 ? 'down' : 'up'
  }

  /** Direction from `from` towards the closest of `tiles` (used to face objects). */
  private directionToward(from: Point, tiles: Point[]): Direction {
    let best = tiles[0]
    let bestDistance = Infinity
    for (const tile of tiles) {
      const distance = Math.abs(tile.x - from.x) + Math.abs(tile.y - from.y)
      if (distance < bestDistance) {
        best = tile
        bestDistance = distance
      }
    }
    const dx = best.x - from.x
    const dy = best.y - from.y
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left'
    return dy > 0 ? 'down' : 'up'
  }

  /** Breadth-first search to the nearest tile in `goals`. Returns the steps, excluding the start. */
  private findPath(goals: Point[]): Point[] | null {
    const start = this.player.tile
    const goalKeys = new Set(goals.map(key))
    if (goalKeys.has(key(start))) return []
    const previous = new Map<string, Point | null>([[key(start), null]])
    const queue: Point[] = [start]
    while (queue.length > 0) {
      const current = queue.shift()!
      for (const delta of Object.values(DELTAS)) {
        const next = { x: current.x + delta.x, y: current.y + delta.y }
        const k = key(next)
        if (previous.has(k) || !this.isWalkable(next.x, next.y)) continue
        previous.set(k, current)
        if (goalKeys.has(k)) {
          const steps: Point[] = []
          let step: Point | null = next
          while (step && key(step) !== key(start)) {
            steps.unshift(step)
            step = previous.get(key(step)) ?? null
          }
          return steps
        }
        queue.push(next)
      }
    }
    return null
  }

  private neighbours(tiles: Point[]): Point[] {
    const own = new Set(tiles.map(key))
    return tiles
      .flatMap((tile) => Object.values(DELTAS).map((d) => ({ x: tile.x + d.x, y: tile.y + d.y })))
      .filter((tile) => !own.has(key(tile)))
  }

  // -------------------------------------------------------------------------
  // João

  private wanderNpc() {
    if (this.npc.moving || this.npcTalking || !this.inputEnabled) return
    if (this.pendingTarget?.kind === 'npc') return
    if (Math.random() < 0.35) return
    const directions = Object.keys(DELTAS) as Direction[]
    const direction = directions[Math.floor(Math.random() * directions.length)]
    const target = { x: this.npc.tile.x + DELTAS[direction].x, y: this.npc.tile.y + DELTAS[direction].y }
    const area = this.furnishings.npcArea
    const inArea =
      target.x >= area.x && target.x < area.x + area.w && target.y >= area.y && target.y < area.y + area.h
    this.npc.facing = direction
    if (!inArea || !this.isWalkable(target.x, target.y, true)) {
      this.setIdle(this.npc)
      return
    }
    this.moveWalker(this.npc, target, NPC_STEP_MS, () => {
      this.setIdle(this.npc)
      this.syncNpcLabel()
      this.updateHint()
    })
  }

  private syncNpcLabel() {
    this.npcLabel.setPosition(Math.round(this.npc.sprite.x), Math.round(this.npc.sprite.y - 8))
  }

  // -------------------------------------------------------------------------
  // Interaction

  private targetAt(tile: Point): Target | null {
    if (this.npc.tile.x === tile.x && this.npc.tile.y === tile.y) return { kind: 'npc' }
    const object = this.objectsByTile.get(key(tile))
    return object ? { kind: 'object', object } : null
  }

  private facingTile(): Point {
    const d = DELTAS[this.player.facing]
    return { x: this.player.tile.x + d.x, y: this.player.tile.y + d.y }
  }

  private targetTiles(target: Target): Point[] {
    return target.kind === 'npc' ? [this.npc.tile] : target.object.tiles
  }

  private targetLabel(target: Target): string {
    return target.kind === 'npc' ? 'Talk to João' : target.object.label
  }

  private faceTarget(target: Target) {
    this.face(this.player, this.directionToward(this.player.tile, this.targetTiles(target)))
    this.updateHint()
  }

  private interactFacing() {
    const target = this.targetAt(this.facingTile())
    if (target) this.interact(target)
  }

  private interact(target: Target) {
    let action: InteractAction
    if (target.kind === 'npc') {
      const opposite: Record<Direction, Direction> = { up: 'down', down: 'up', left: 'right', right: 'left' }
      if (Math.abs(this.npc.tile.x - this.player.tile.x) + Math.abs(this.npc.tile.y - this.player.tile.y) === 1) {
        this.face(this.npc, opposite[this.player.facing])
      }
      this.npcTalking = true
      action = { type: 'dialogue', id: 'joao' }
    } else {
      action = target.object.action
    }
    this.cfg.bridge.game.emit('interact', action)
  }

  private handleTap(pointer: Phaser.Input.Pointer) {
    if (!this.inputEnabled) return
    const tile = { x: Math.floor(pointer.worldX / TILE), y: Math.floor(pointer.worldY / TILE) }
    const target = this.targetAt(tile)

    if (target) {
      const tiles = this.targetTiles(target)
      const adjacent = this.neighbours(tiles)
      const isAdjacent = adjacent.some((t) => t.x === this.player.tile.x && t.y === this.player.tile.y)
      if (isAdjacent && !this.player.moving) {
        this.faceTarget(target)
        this.interact(target)
        return
      }
      const path = this.findPath(adjacent)
      if (path) {
        this.path = path
        this.pendingTarget = target
      }
      return
    }

    if (!this.isWalkable(tile.x, tile.y)) return
    const path = this.findPath([tile])
    if (path) {
      this.path = path
      this.pendingTarget = null
    }
  }

  private handleHover(pointer: Phaser.Input.Pointer) {
    const tile = { x: Math.floor(pointer.worldX / TILE), y: Math.floor(pointer.worldY / TILE) }
    this.hoverTarget = this.targetAt(tile)
    this.input.setDefaultCursor(this.hoverTarget ? 'pointer' : 'default')
    this.updateHint()
  }

  private updateHint() {
    const facing = this.targetAt(this.facingTile())
    const target = this.hoverTarget ?? facing
    this.drawHighlight(target)
    const hint: Hint | null = target
      ? { label: this.targetLabel(target), hover: this.hoverTarget !== null && target === this.hoverTarget }
      : null
    const signature = hint ? `${hint.label}|${hint.hover}` : ''
    if (signature === this.lastHint) return
    this.lastHint = signature
    this.cfg.bridge.game.emit('hint', hint)
  }

  private drawHighlight(target: Target | null) {
    this.highlight.clear()
    if (!target || !this.inputEnabled) return
    const tiles = this.targetTiles(target)
    const xs = tiles.map((t) => t.x)
    const ys = tiles.map((t) => t.y)
    const x = Math.min(...xs) * TILE
    const y = Math.min(...ys) * TILE
    const w = (Math.max(...xs) + 1) * TILE - x
    const h = (Math.max(...ys) + 1) * TILE - y
    this.highlight.lineStyle(1, 0xe8c95a, 0.9)
    this.highlight.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
  }

  private updateRoom() {
    const room = roomAt(this.player.tile.x, this.player.tile.y)
    if (!room || room.id === this.currentRoom) return
    this.currentRoom = room.id
    this.cfg.bridge.game.emit('room', room.id)
  }

  private spawnFacing(_room: RoomId): Direction {
    // Every spawn point is just inside a door, looking into the room.
    return 'up'
  }

  private teleport(roomId: RoomId) {
    const room = getRoom(roomId)
    const spawn = room.spawn
    this.path = []
    this.pendingTarget = null
    this.cameras.main.fadeOut(140, 20, 18, 28)
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      // Shoo João out of the way if he's standing on the spawn tile.
      if (this.npc.tile.x === spawn.x && this.npc.tile.y === spawn.y) {
        const free = this.neighbours([spawn]).find((t) => this.isWalkable(t.x, t.y, true))
        if (free) {
          this.npc.tile = free
          this.npc.sprite.setPosition(free.x * TILE + TILE / 2, free.y * TILE + TILE / 2)
          this.syncNpcLabel()
        }
      }
      this.player.tile = { ...spawn }
      this.player.sprite.setPosition(spawn.x * TILE + TILE / 2, spawn.y * TILE + TILE / 2)
      this.player.sprite.setDepth(10 + spawn.y / 100)
      this.player.facing = this.spawnFacing(roomId)
      this.setIdle(this.player)
      this.cameras.main.centerOn(this.player.sprite.x, this.player.sprite.y)
      this.cameras.main.fadeIn(180, 20, 18, 28)
      this.currentRoom = null
      this.updateRoom()
      this.updateHint()
    })
  }

  // -------------------------------------------------------------------------
  // Setup

  private setupCamera() {
    const camera = this.cameras.main
    // No bounds, like Pokémon: the player stays centred and the void past the
    // walls is simply dark.
    camera.setRoundPixels(true)
    camera.startFollow(this.player.sprite, true, 0.18, 0.18)
    // Pokémon-style framing: about 17 tiles along the longer side of the
    // screen, at a whole-number zoom so every pixel stays square.
    const applyZoom = () => {
      const { width, height } = this.scale.gameSize
      camera.setZoom(Math.max(2, Math.round(Math.max(width, height) / (17 * TILE))))
    }
    applyZoom()
    this.scale.on(Phaser.Scale.Events.RESIZE, applyZoom)
  }

  private setupInput() {
    const keyboard = this.input.keyboard!
    // No key capture: overlays rendered by React need arrows/space for their own inputs.
    const names = ['UP', 'DOWN', 'LEFT', 'RIGHT', 'W', 'A', 'S', 'D'] as const
    this.keys = Object.fromEntries(
      names.map((name) => [name, keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[name], false)]),
    )
    keyboard.on('keydown', (event: KeyboardEvent) => {
      if (event.timeStamp < this.inputEnabledAt) return
      const step = KEY_STEPS[event.code]
      if (step) this.queuedStep = step
      if (event.code === 'KeyE' || event.code === 'Space' || event.code === 'Enter') this.queuedInteract = true
    })
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => this.handleTap(pointer))
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      if (pointer.wasTouch) return
      this.handleHover(pointer)
    })
    this.input.on(Phaser.Input.Events.GAME_OUT, () => {
      this.hoverTarget = null
      this.updateHint()
    })
  }

  private setupBridge() {
    const { ui } = this.cfg.bridge
    this.unsubscribers.push(
      ui.on('teleport', (room) => this.teleport(room)),
      ui.on('interactFacing', () => this.interactFacing()),
      ui.on('inputEnabled', (enabled) => {
        this.inputEnabled = enabled
        this.input.keyboard!.enabled = enabled
        this.input.keyboard!.resetKeys()
        this.path = []
        this.pendingTarget = null
        this.queuedStep = null
        this.queuedInteract = false
        if (enabled) {
          this.inputEnabledAt = performance.now()
          this.npcTalking = false
        } else {
          this.hoverTarget = null
          this.input.setDefaultCursor('default')
        }
        this.updateHint()
      }),
    )
  }
}
