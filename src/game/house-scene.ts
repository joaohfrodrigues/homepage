import * as Phaser from 'phaser'
import type { HouseBridge, Hint, InteractAction } from './bridge'
import { furnishHouse, propTiles, type Decor, type Furnishings, type Interactable } from './furnishings'
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
  roomOf,
  wallPartAt,
  type Direction,
  type Point,
  type RoomId,
} from './layout'
import { LIMEZU_FURNITURE_URL, drawLimezu, limezuRect } from './limezu-furniture'
import { fitView, isOnMap, projectToMap } from './map-projection'
import { LAND_URL, renderMap, type LandData } from './world-map'
import {
  LIGHT_SOURCES,
  MAP_WALL,
  FACINGS,
  PROP_SIZES,
  DESK_LEDS,
  CAT_FRAMES,
  drawCat,
  drawHeart,
  drawPoop,
  drawStink,
  drawFocusArrow,
  drawSparkle,
  traceSilhouette,
  drawCapWindow,
  drawDoorway,
  drawFloor,
  drawRailingFront,
  drawRailingSide,
  drawWindow,
  drawClosedDoor,
  drawFrontDoor,
  drawSideDoorway,
  drawProp,
  drawWallCap,
  drawWallFace,
  type Facing,
  type PropName,
} from './pixels'
import {
  CHARACTERS_URL,
  CHARACTER_ANIMS,
  CHARACTER_DIRECTIONS,
  CHAR_FRAMES,
  CHAR_H,
  CHAR_HEADROOM,
  CHAR_W,
  LOOKS,
  drawCharacter,
  type CharacterName,
  type Outfit,
} from './characters'
import type { Trip } from '@/lib/photos'

export interface HouseSceneConfig {
  bridge: HouseBridge
  trips: Trip[]
  startRoom: RoomId
  fontFamily: string
  night: boolean
  outfit: Outfit
}

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
const ZENO_STEP_MS = 300
const ZENO_TICK_MS = 380
/** Zeno gives up on a favourite spot that's further than this many steps away. */
const ZENO_MAX_TRIP = 40
/** How far he'll chase the toy after batting it before losing interest. */
const ZENO_MAX_CHASE = 6
const TOY_SLIDE_MS = 120
/** Gaps between his games with the toy, and between litter box visits. */
const ZENO_PLAY_GAP_MS: [number, number] = [60_000, 120_000]
const ZENO_LITTER_GAP_MS: [number, number] = [120_000, 240_000]
/** People leave chairs to visitors and cats; João stays off them. */
const CHAIR_PROPS = new Set<PropName>(['chair', 'chairup', 'officechair', 'cafechair'])

const between = ([min, max]: [number, number]) => min + Math.random() * (max - min)

interface Walker {
  sprite: Phaser.GameObjects.Sprite
  who: CharacterName | 'zeno'
  tile: Point
  facing: Direction
  moving: boolean
}

type Target = { kind: 'object'; object: Interactable } | { kind: 'npc' } | { kind: 'zeno' }

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
  /** Per-interactable focus outline, "lit up" overlay and nearby sparkle. */
  private cues = new Map<
    string,
    {
      outline: Phaser.GameObjects.Image
      shine: Phaser.GameObjects.Image
      sparkle: Phaser.GameObjects.Image
      bounds: { x: number; y: number; w: number; h: number }
    }
  >()
  private npcOutline!: Phaser.GameObjects.Sprite
  private zeno!: Walker
  private zenoOutline!: Phaser.GameObjects.Sprite
  /** Tiles Zeno can stand on that people can't: the sofa, the bed, his litter box. */
  private zenoPerches = new Set<string>()
  private zenoPath: Point[] = []
  private zenoRestUntil = 0
  /** True while he's on his way to one of his spots, so he settles there on arrival. */
  private zenoOnTrip = false
  /** In a game with his toy, and how many more pounces he has in him. */
  private zenoPlaying = false
  private zenoChases = 0
  private toy!: Phaser.GameObjects.Image
  private toyTile!: Point
  private zenoNextPlayAt = 0
  private zenoNextLitterAt = 0
  private zenoLitterTrip = false
  /** Busy in his litter box: not to be petted. */
  private zenoInBox = false
  private litterDirty = false
  private stink!: Phaser.GameObjects.Image
  private poop!: Phaser.GameObjects.Image
  private chairs = new Set<string>()
  private focusArrow!: Phaser.GameObjects.Image
  private focused: Target | null = null
  private reducedMotion = false
  private glows: { image: Phaser.GameObjects.Image; day: number; night: number }[] = []
  private nightOverlay!: Phaser.GameObjects.Rectangle
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
  /** Held on the touch D-pad; read alongside the keyboard each frame. */
  private padDirection: Direction | null = null
  private tapToMove = true
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
    this.load.json('world-land', LAND_URL)
    this.load.image('house-characters', CHARACTERS_URL)
    this.load.image('limezu-furniture', LIMEZU_FURNITURE_URL)
  }

  create() {
    this.bakeHouse()
    this.bakeCharacters()
    this.bakeZeno()
    this.buildCollision()
    this.addAmbience()

    this.bakeCues()

    const start = getRoom(this.cfg.startRoom).spawn
    this.player = this.addWalker('guest', start, this.spawnFacing(this.cfg.startRoom))
    const npcStart = this.furnishings.npcStart
    this.npc = this.addWalker('joao', npcStart, 'down')
    this.npcLabel = this.add
      .text(0, 0, 'João', this.textStyle('#f4ecd8', '#2a2233'))
      .setOrigin(0.5, 1)
      .setDepth(34)
    this.syncNpcLabel()
    this.npcOutline = this.add
      .sprite(this.npc.sprite.x, this.npc.sprite.y, 'house-chars-outline', 'joao-down-idle-0')
      .setOrigin(0.5, 1)
      .setVisible(false)

    this.setupCamera()
    this.setupInput()
    this.setupBridge()

    const zeno = this.furnishings.zeno
    zeno.perches.forEach((tile) => this.zenoPerches.add(key(tile)))
    this.zeno = this.addWalker('zeno', zeno.start, 'down', 'house-zeno')
    this.zenoOutline = this.add
      .sprite(this.zeno.sprite.x, this.zeno.sprite.y, 'house-zeno-outline', 'zeno-down-idle')
      .setOrigin(0.5, 1)
      .setVisible(false)

    // His first visit to the litter box comes within a minute or so, so visitors get to see it.
    this.zenoNextPlayAt = this.time.now + between([30_000, 60_000])
    this.zenoNextLitterAt = this.time.now + between([40_000, 80_000])
    const box = zeno.litterBox
    this.stink = this.add
      .image(box.x * TILE + 4, box.y * TILE - 2, 'litter-stink')
      .setOrigin(0, 1)
      .setDepth(4)
      .setVisible(false)
    this.poop = this.add
      .image(box.x * TILE, box.y * TILE, 'litter-poop')
      .setOrigin(0, 0)
      .setDepth(3)
      .setVisible(false)
    if (!this.reducedMotion) {
      this.tweens.add({ targets: this.stink, y: this.stink.y - 2, alpha: 0.5, duration: 900, yoyo: true, repeat: -1 })
    }

    this.toyTile = { ...zeno.toy }
    this.toy = this.add
      .image(this.toyTile.x * TILE, this.toyTile.y * TILE, 'zeno-toy')
      .setOrigin(0, 0)
      .setDepth(2)

    this.time.addEvent({ delay: 1800, loop: true, callback: () => this.wanderNpc() })
    this.time.addEvent({ delay: ZENO_TICK_MS, loop: true, callback: () => this.tickZeno() })

    this.updateRoom()
    this.updateHint()
    this.cfg.bridge.game.emit('ready')

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubscribers.forEach((off) => off()))
  }

  update(time: number) {
    this.animateCues(time)
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
        if (cell === ' ') {
          // Outside the flat: leave it to the camera's dark background.
          continue
        } else if (cell === '=') {
          drawRailingFront(ctx, ox, oy)
        } else if (cell === '|') {
          drawRailingSide(ctx, ox, oy, roomAt(x - 1, y)?.floor ?? 'balcony', x, y)
        } else if (cell === '.') {
          drawFloor(ctx, ox, oy, roomAt(x, y)?.floor ?? 'oak', x, y)
        } else if (cell === 'F') {
          drawFrontDoor(ctx, ox, oy, cellAt(x - 1, y) === 'F' ? 'right' : 'left')
        } else if (cell === 'd') {
          drawSideDoorway(ctx, ox, oy, roomAt(x - 1, y)?.floor ?? 'oak', roomAt(x + 1, y)?.floor ?? 'oak', x, y)
        } else {
          const part = wallPartAt(x, y)
          const edges = { left: cellAt(x - 1, y) !== cell, right: cellAt(x + 1, y) !== cell }
          if (cell === 'W' && (part === 'cap' || !below)) {
            drawCapWindow(ctx, ox, oy, edges)
          } else if (part === 'cap' || !below) {
            drawWallCap(ctx, ox, oy)
          } else if (cell === 'W') {
            drawWindow(ctx, ox, oy, below.wall, part, edges)
          } else if (cell === 'X') {
            drawClosedDoor(ctx, ox, oy, below.wall, part, cellAt(x - 1, y) === 'X' ? 'right' : 'left')
          } else if (cell === 'D') {
            drawDoorway(ctx, ox, oy, below.floor, part, x, y, edges)
          } else {
            drawWallFace(ctx, ox, oy, below.wall, part)
          }
        }
      }
    }

    for (const item of this.furnishings.decor) this.drawDecor(ctx, item, 0, 0)

    this.drawWallMap(ctx)
    texture.refresh()
    this.add.image(0, 0, 'house-base').setOrigin(0, 0).setDepth(0)
  }

  /** The trip map in its frame on the study wall, one pin per trip. */
  private drawWallMap(ctx: CanvasRenderingContext2D) {
    const frame = this.propAt('wallmap')
    if (!frame) return
    const land = this.cache.json.get('world-land') as LandData | undefined
    const ox = frame.x * TILE + MAP_WALL.x
    const oy = frame.y * TILE + MAP_WALL.y
    const firstStops = this.cfg.trips.map((trip) => trip.stops[0]).filter((stop) => stop && isOnMap(stop.lat, stop.lon))
    // Framed around every trip, like the full-size travel map.
    const view = fitView(firstStops, MAP_WALL.w / MAP_WALL.h)
    if (land) ctx.putImageData(renderMap(land, view, MAP_WALL.w, MAP_WALL.h), ox, oy)
    for (const stop of firstStops) {
      const pos = projectToMap(stop.lat, stop.lon, view)
      const px = ox + Math.round(pos.x * (MAP_WALL.w - 1))
      const py = oy + Math.round(pos.y * (MAP_WALL.h - 1))
      ctx.fillStyle = '#2a2233'
      ctx.fillRect(px - 1, py - 1, 3, 3)
      ctx.fillStyle = '#e04434'
      ctx.fillRect(px, py, 1, 1)
    }
  }

  /** Every frame of a person's sheet: direction, animation and frame index, in atlas order. */
  private characterFrames() {
    return CHARACTER_DIRECTIONS.flatMap((direction) =>
      CHARACTER_ANIMS.flatMap((anim) =>
        Array.from({ length: CHAR_FRAMES }, (_, frame) => ({ direction, anim, frame, name: `${direction}-${anim}-${frame}` })),
      ),
    )
  }

  private bakeCharacters() {
    const who: CharacterName[] = ['guest', 'joao']
    const atlas = this.textures.get('house-characters').getSourceImage() as HTMLImageElement
    const frames = this.characterFrames()
    const texture = this.textures.createCanvas('house-chars', frames.length * CHAR_W, who.length * CHAR_H)!
    const ctx = texture.getContext()
    who.forEach((name, row) => {
      const look = name === 'guest' ? this.cfg.outfit : LOOKS[name]
      frames.forEach((f, col) => {
        drawCharacter(ctx, atlas, col * CHAR_W, row * CHAR_H, look, f.direction, f.anim, f.frame)
        texture.add(`${name}-${f.name}`, 0, col * CHAR_W, row * CHAR_H, CHAR_W, CHAR_H)
      })
    })
    texture.refresh()

    // Matching outline frames (1px larger each side) for João's focus cue.
    const OUT_W = CHAR_W + 2
    const OUT_H = CHAR_H + 2
    const outlines = this.textures.createCanvas('house-chars-outline', frames.length * OUT_W, OUT_H)!
    const frame = document.createElement('canvas')
    frame.width = CHAR_W
    frame.height = CHAR_H
    const frameCtx = frame.getContext('2d')!
    frames.forEach((f, col) => {
      frameCtx.clearRect(0, 0, CHAR_W, CHAR_H)
      drawCharacter(frameCtx, atlas, 0, 0, LOOKS.joao, f.direction, f.anim, f.frame)
      outlines.getContext().drawImage(traceSilhouette(frame).outline, col * OUT_W, 0)
      outlines.add(`joao-${f.name}`, 0, col * OUT_W, 0, OUT_W, OUT_H)
    })
    outlines.refresh()

    // A walk cycle covers two steps; the idle loop is a slow breath.
    for (const name of who) {
      for (const direction of CHARACTER_DIRECTIONS) {
        for (const anim of CHARACTER_ANIMS) {
          this.anims.create({
            key: `${name}-${anim}-${direction}`,
            frames: Array.from({ length: CHAR_FRAMES }, (_, i) => ({ key: 'house-chars', frame: `${name}-${direction}-${anim}-${i}` })),
            frameRate: anim === 'idle' ? 6 : name === 'guest' ? 18 : 11,
            repeat: -1,
          })
        }
      }
    }
  }

  /** Zeno's frames, his matching outlines for the focus cue, and his walk cycles. */
  private bakeZeno() {
    const sheet = this.textures.createCanvas('house-zeno', CAT_FRAMES.length * TILE, TILE)!
    const OUT = TILE + 2
    const outlines = this.textures.createCanvas('house-zeno-outline', CAT_FRAMES.length * OUT, OUT)!
    const frame = document.createElement('canvas')
    frame.width = TILE
    frame.height = TILE
    const frameCtx = frame.getContext('2d')!
    CAT_FRAMES.forEach((name, i) => {
      drawCat(sheet.getContext(), i * TILE, 0, name)
      sheet.add(`zeno-${name}`, 0, i * TILE, 0, TILE, TILE)
      frameCtx.clearRect(0, 0, TILE, TILE)
      drawCat(frameCtx, 0, 0, name)
      outlines.getContext().drawImage(traceSilhouette(frame).outline, i * OUT, 0)
      outlines.add(`zeno-${name}`, 0, i * OUT, 0, OUT, OUT)
    })
    sheet.refresh()
    outlines.refresh()
    for (const facing of FACINGS) {
      this.anims.create({
        key: `zeno-walk-${facing}`,
        frames: ['a', 'idle', 'b', 'idle'].map((step) => ({ key: 'house-zeno', frame: `zeno-${facing}-${step}` })),
        frameRate: 12,
        repeat: -1,
      })
    }
    // His toy lives outside the baked house so it can move.
    const toy = this.textures.createCanvas('zeno-toy', TILE, TILE)!
    drawProp(toy.getContext(), 0, 0, 'cattoy')
    toy.refresh()
    const poop = this.textures.createCanvas('litter-poop', TILE, TILE)!
    drawPoop(poop.getContext())
    poop.refresh()
    const stink = this.textures.createCanvas('litter-stink', 9, 8)!
    drawStink(stink.getContext())
    stink.refresh()
    const heart = this.textures.createCanvas('zeno-heart', 7, 6)!
    drawHeart(heart.getContext())
    heart.refresh()
  }

  private buildCollision() {
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        if (!isFloorCell(x, y)) this.solid.add(key({ x, y }))
      }
    }
    for (const item of this.furnishings.decor) {
      if (item.kind === 'prop' && CHAIR_PROPS.has(item.prop)) propTiles(item).forEach((t) => this.chairs.add(key(t)))
      if (!item.solid) continue
      const tiles = item.kind === 'prop' ? propTiles(item) : [{ x: item.x, y: item.y }]
      tiles.forEach((tile) => this.solid.add(key(tile)))
    }
    for (const object of this.furnishings.interactables) {
      object.tiles.forEach((tile) => this.objectsByTile.set(key(tile), object))
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

  /** The cosy bits: warm light pools under lamps and screens, and the Pi's blinking LEDs. */
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
      const image = this.add
        .image(item.x * TILE + light.x, item.y * TILE + light.y, 'glow')
        .setDisplaySize(light.radius * 2, light.radius * 2)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(30)
      this.glows.push({ image, day: item.prop === 'tv' ? 0.35 : 0.6, night: item.prop === 'tv' ? 0.8 : 1 })
    }

    // Night: everything but the light pools and interaction cues sinks into blue.
    this.nightOverlay = this.add
      .rectangle(-20 * TILE, -20 * TILE, (MAP_WIDTH + 40) * TILE, (MAP_HEIGHT + 40) * TILE, 0x0b1030)
      .setOrigin(0)
      .setDepth(29)
    this.applyNight(this.cfg.night)

    // The Pi's disk enclosure on the study desk.
    const rack = this.propAt('desk')
    if (rack) {
      const leds = this.add.graphics().setDepth(1)
      const blink = () => {
        leds.clear()
        for (const led of DESK_LEDS) {
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

  private applyNight(on: boolean) {
    this.nightOverlay.setAlpha(on ? 0.55 : 0)
    for (const glow of this.glows) glow.image.setAlpha(on ? glow.night : glow.day)
  }

  /** Fade out, flip day/night, fade back in — as if the visitor just woke up. */
  private setNight(on: boolean, animate: boolean) {
    if (!animate || this.reducedMotion) {
      this.applyNight(on)
      return
    }
    const camera = this.cameras.main
    camera.fadeOut(450, 8, 10, 24)
    camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.applyNight(on)
      camera.fadeIn(700, 8, 10, 24)
    })
  }

  /** Redraw the visitor's frames in a new outfit from the wardrobe. */
  private repaintGuest(outfit: Outfit) {
    const texture = this.textures.get('house-chars') as Phaser.Textures.CanvasTexture
    const atlas = this.textures.get('house-characters').getSourceImage() as HTMLImageElement
    const ctx = texture.getContext()
    // The guest is the first row of the sheet.
    ctx.clearRect(0, 0, texture.width, CHAR_H)
    this.characterFrames().forEach((f, col) => {
      drawCharacter(ctx, atlas, col * CHAR_W, 0, outfit, f.direction, f.anim, f.frame)
    })
    texture.refresh()
  }


  /** Where a piece of decor draws, in world pixels. */
  private decorRect(item: Decor) {
    if (item.kind === 'limezu') return limezuRect(item.sprite, item.x, item.y)
    const size = item.kind === 'prop' ? PROP_SIZES[item.prop] : { w: TILE, h: TILE }
    return { x: item.x * TILE, y: item.y * TILE, ...size }
  }

  /** Draws a piece of decor onto a canvas whose top-left is world point (ox, oy). */
  private drawDecor(ctx: CanvasRenderingContext2D, item: Decor, ox: number, oy: number) {
    const { x, y } = this.decorRect(item)
    if (item.kind === 'prop') drawProp(ctx, x - ox, y - oy, item.prop)
    else if (item.kind === 'limezu') {
      drawLimezu(ctx, this.textures.get('limezu-furniture').getSourceImage() as HTMLImageElement, item.sprite, x - ox, y - oy)
    } else {
      const sheet = this.textures.get('furniture').getSourceImage() as HTMLImageElement
      const sx = (item.frame % KENNEY_COLUMNS) * 17
      const sy = Math.floor(item.frame / KENNEY_COLUMNS) * 17
      ctx.drawImage(sheet, sx, sy, 16, 16, x - ox, y - oy, 16, 16)
    }
  }

  private decorTiles(item: Decor): Point[] {
    return item.kind === 'prop' ? propTiles(item) : [{ x: item.x, y: item.y }]
  }

  /**
   * Interaction cues: for every interactable, trace the silhouette of the
   * furniture it's made of into an outline and a "lit up" overlay, plus a
   * sparkle shown while the visitor is close by.
   */
  private bakeCues() {
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const small = (name: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) => {
      const texture = this.textures.createCanvas(name, w, h)!
      draw(texture.getContext())
      texture.refresh()
    }
    small('cue-sparkle', 7, 7, drawSparkle)
    small('cue-arrow', 7, 6, drawFocusArrow)

    for (const object of this.furnishings.interactables) {
      const keys = new Set(object.tiles.map(key))
      const parts = this.furnishings.decor.filter(
        (item) => item.solid && this.decorTiles(item).some((tile) => keys.has(key(tile))),
      )
      const rects =
        parts.length > 0
          ? parts.map((item) => this.decorRect(item))
          : object.tiles.map((tile) => ({ x: tile.x * TILE, y: tile.y * TILE, w: TILE, h: TILE }))
      const bx = Math.min(...rects.map((r) => r.x))
      const by = Math.min(...rects.map((r) => r.y))
      const bounds = {
        x: bx,
        y: by,
        w: Math.max(...rects.map((r) => r.x + r.w)) - bx,
        h: Math.max(...rects.map((r) => r.y + r.h)) - by,
      }

      const source = document.createElement('canvas')
      source.width = bounds.w
      source.height = bounds.h
      const ctx = source.getContext('2d')!
      if (parts.length === 0) {
        // Things baked into the walls (the front door) get a plain tile outline.
        ctx.fillStyle = '#000'
        ctx.fillRect(0, 0, bounds.w, bounds.h)
      }
      for (const item of parts) this.drawDecor(ctx, item, bx, by)

      const { outline, shine } = traceSilhouette(source)
      this.textures.addCanvas(`cue-outline-${object.id}`, outline)
      this.textures.addCanvas(`cue-shine-${object.id}`, shine)
      this.cues.set(object.id, {
        bounds,
        outline: this.add.image(bx - 1, by - 1, `cue-outline-${object.id}`).setOrigin(0).setDepth(31).setVisible(false),
        shine: this.add
          .image(bx - 1, by - 1, `cue-shine-${object.id}`)
          .setOrigin(0)
          .setDepth(31)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setVisible(false),
        sparkle: this.add.image(bx + bounds.w - 3, by + 3, 'cue-sparkle').setDepth(32).setVisible(false),
      })
    }

    this.focusArrow = this.add.image(0, 0, 'cue-arrow').setOrigin(0.5, 1).setDepth(33).setVisible(false)
  }

  /** Show the focus outline/arrow on `target` and sparkles on anything close by. */
  private updateCues(target: Target | null) {
    this.focused = target
    for (const [id, cue] of this.cues) {
      const isFocused = target?.kind === 'object' && target.object.id === id
      cue.outline.setVisible(isFocused)
      cue.shine.setVisible(isFocused)
      cue.sparkle.setVisible(this.inputEnabled && !isFocused && this.isNear(id))
    }
    this.npcOutline.setVisible(target?.kind === 'npc')
    this.zenoOutline.setVisible(target?.kind === 'zeno')
    this.focusArrow.setVisible(target !== null)
  }

  /** Within two tiles, and in the same room — walls shouldn't leak sparkles. */
  private isNear(objectId: string): boolean {
    const object = this.furnishings.interactables.find((o) => o.id === objectId)!
    const { x, y } = this.player.tile
    const here = roomAt(x, y)?.id ?? this.currentRoom
    if (roomOf(object.tiles)?.id !== here) return false
    return object.tiles.some((tile) => Math.max(Math.abs(tile.x - x), Math.abs(tile.y - y)) <= 2)
  }

  /** Per-frame pulse, bob and twinkle for the cues (static under reduced motion). */
  private animateCues(time: number) {
    const still = this.reducedMotion
    const wave = Math.sin(time / 180)
    let arrowX = 0
    let arrowY = 0
    const target = this.focused
    if (target?.kind === 'object') {
      const cue = this.cues.get(target.object.id)!
      cue.outline.setAlpha(still ? 1 : 0.75 + 0.25 * wave)
      cue.shine.setAlpha(still ? 0.12 : 0.1 + 0.07 * wave)
      arrowX = cue.bounds.x + cue.bounds.w / 2
      arrowY = cue.bounds.y - 1
    } else if (target?.kind === 'npc') {
      const sprite = this.npc.sprite
      this.npcOutline
        .setPosition(sprite.x, sprite.y + 1)
        .setFrame(sprite.frame.name)
        .setFlipX(sprite.flipX)
        .setDepth(31)
        .setAlpha(still ? 1 : 0.75 + 0.25 * wave)
      arrowX = sprite.x
      arrowY = sprite.y - CHAR_H + CHAR_HEADROOM - 10
    } else if (target?.kind === 'zeno') {
      const sprite = this.zeno.sprite
      this.zenoOutline
        .setPosition(sprite.x, sprite.y + 1)
        .setFrame(sprite.frame.name)
        .setFlipX(sprite.flipX)
        .setDepth(31)
        .setAlpha(still ? 1 : 0.75 + 0.25 * wave)
      arrowX = sprite.x
      arrowY = sprite.y - TILE - 2
    }
    if (target) {
      const bob = still ? 0 : Math.round(Math.sin(time / 160) * 1.5)
      this.focusArrow.setPosition(Math.round(arrowX), Math.round(arrowY) + bob)
    }
    let i = 0
    for (const cue of this.cues.values()) {
      if (cue.sparkle.visible) {
        cue.sparkle.setAlpha(still ? 1 : 0.35 + 0.65 * Math.abs(Math.sin(time / 320 + i * 1.7)))
      }
      i++
    }
  }

  // -------------------------------------------------------------------------
  // Characters and movement

  private addWalker(who: Walker['who'], tile: Point, facing: Direction, texture = 'house-chars'): Walker {
    const sprite = this.add
      .sprite(tile.x * TILE + TILE / 2, (tile.y + 1) * TILE, texture, who === 'zeno' ? 'zeno-down-idle' : `${who}-down-idle-0`)
      .setOrigin(0.5, 1)
      .setDepth(10 + tile.y / 100)
    const walker: Walker = { sprite, who, tile: { ...tile }, facing, moving: false }
    this.setIdle(walker)
    return walker
  }

  /** Zeno's side frames face right and flip for left; people have a frame set per direction. */
  private spriteFacing(direction: Direction): Facing {
    return direction === 'left' || direction === 'right' ? 'side' : direction
  }

  private setIdle(walker: Walker) {
    if (walker.who === 'zeno') {
      walker.sprite.stop()
      walker.sprite.setFrame(`zeno-${this.spriteFacing(walker.facing)}-idle`)
      walker.sprite.setFlipX(walker.facing === 'left')
    } else if (this.reducedMotion) {
      walker.sprite.stop()
      walker.sprite.setFrame(`${walker.who}-${walker.facing}-idle-0`)
    } else {
      walker.sprite.play(`${walker.who}-idle-${walker.facing}`, true)
    }
  }

  private face(walker: Walker, direction: Direction) {
    walker.facing = direction
    if (!walker.moving) this.setIdle(walker)
  }

  private heldDirection(): Direction | null {
    if (this.padDirection) return this.padDirection
    const k = this.keys
    if (k.LEFT.isDown || k.A.isDown) return 'left'
    if (k.RIGHT.isDown || k.D.isDown) return 'right'
    if (k.UP.isDown || k.W.isDown) return 'up'
    if (k.DOWN.isDown || k.S.isDown) return 'down'
    return null
  }

  /** Free floor for people. `self` is the walker asking, who doesn't block themselves. */
  private isWalkable(x: number, y: number, self?: Walker): boolean {
    if (this.solid.has(key({ x, y }))) return false
    return !this.occupied(x, y, self)
  }

  /** Free for Zeno: floor, plus the furniture he's allowed on. */
  private zenoCanWalk(x: number, y: number): boolean {
    const k = key({ x, y })
    if (this.solid.has(k) && !this.zenoPerches.has(k)) return false
    return !this.occupied(x, y, this.zeno)
  }

  private occupied(x: number, y: number, self?: Walker): boolean {
    return [this.player, this.npc, this.zeno].some(
      (walker) => walker && walker !== self && walker.tile.x === x && walker.tile.y === y,
    )
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
    this.cfg.bridge.game.emit('step')
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
    const anim =
      walker.who === 'zeno' ? `zeno-walk-${this.spriteFacing(walker.facing)}` : `${walker.who}-walk-${walker.facing}`
    if (walker.who === 'zeno') walker.sprite.setFlipX(walker.facing === 'left')
    if (walker.sprite.anims.currentAnim?.key !== anim || !walker.sprite.anims.isPlaying) {
      walker.sprite.play(anim)
    }
    this.tweens.add({
      targets: walker.sprite,
      x: target.x * TILE + TILE / 2,
      y: (target.y + 1) * TILE,
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
  private findPath(
    goals: Point[],
    start: Point = this.player.tile,
    walkable: (x: number, y: number) => boolean = (x, y) => this.isWalkable(x, y),
  ): Point[] | null {
    const goalKeys = new Set(goals.map(key))
    if (goalKeys.has(key(start))) return []
    const previous = new Map<string, Point | null>([[key(start), null]])
    const queue: Point[] = [start]
    while (queue.length > 0) {
      const current = queue.shift()!
      for (const delta of Object.values(DELTAS)) {
        const next = { x: current.x + delta.x, y: current.y + delta.y }
        const k = key(next)
        if (previous.has(k) || !walkable(next.x, next.y)) continue
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
    if (!inArea || this.chairs.has(key(target)) || !this.isWalkable(target.x, target.y, this.npc)) {
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
    this.npcLabel.setPosition(Math.round(this.npc.sprite.x), Math.round(this.npc.sprite.y - CHAR_H + CHAR_HEADROOM - 1))
  }

  // -------------------------------------------------------------------------
  // Zeno

  /**
   * One beat of cat: keep walking to a favourite spot if he's on his way to one,
   * otherwise sit down for a while, set off for a spot, or trot about, mostly in
   * a straight line, stopping now and then to think about it.
   */
  private tickZeno() {
    const zeno = this.zeno
    if (zeno.moving || !this.inputEnabled || this.pendingTarget?.kind === 'zeno') return
    if (this.time.now < this.zenoRestUntil) return

    if (this.zenoPath.length > 0) {
      const next = this.zenoPath.shift()!
      const direction = this.directionTo(zeno.tile, next)
      if (direction && this.zenoCanWalk(next.x, next.y)) {
        this.stepZeno(direction)
      } else {
        this.zenoPath = []
        this.zenoPlaying = false
        if (this.zenoLitterTrip) {
          this.zenoLitterTrip = false
          this.zenoNextLitterAt = this.time.now + 5000
        }
      }
      return
    }

    const now = this.time.now
    if (now >= this.zenoNextLitterAt && this.goToLitterBox()) return

    // A cat's afternoon: mostly ambling about in short, wandering bursts, with
    // plenty of stopping to look around, the odd sit-down, a trip to a favourite
    // spot, and only now and then a game with the toy.
    const roll = Math.random()
    if (roll < 0.07) {
      this.restZeno(3000, 9000, true)
    } else if (roll < 0.14) {
      if (!this.goToSpot()) this.restZeno(500, 1500, false)
    } else if (roll < 0.16 && now >= this.zenoNextPlayAt) {
      if (!this.playWithToy()) this.restZeno(500, 1500, false)
    } else if (roll < 0.3) {
      // Look around without going anywhere.
      const directions = Object.keys(DELTAS) as Direction[]
      this.face(zeno, directions[Math.floor(Math.random() * directions.length)])
      this.restZeno(400, 1400, false)
    } else if (roll < 0.45) {
      this.restZeno(600, 2600, false)
    } else {
      const directions = (Object.keys(DELTAS) as Direction[]).filter((d) =>
        this.zenoCanWalk(zeno.tile.x + DELTAS[d].x, zeno.tile.y + DELTAS[d].y),
      )
      if (directions.length === 0) return
      const ahead = directions.includes(zeno.facing) && Math.random() < 0.35
      this.stepZeno(ahead ? zeno.facing : directions[Math.floor(Math.random() * directions.length)])
    }
  }

  private goToSpot(): boolean {
    const spots = this.furnishings.zeno.spots
    const spot = spots[Math.floor(Math.random() * spots.length)]
    const path = this.findPath([spot], this.zeno.tile, (x, y) => this.zenoCanWalk(x, y))
    if (!path || path.length === 0 || path.length > ZENO_MAX_TRIP) return false
    this.zenoPath = path
    this.zenoOnTrip = true
    return true
  }

  private goToLitterBox(): boolean {
    const path = this.findPath([this.furnishings.zeno.litterBox], this.zeno.tile, (x, y) => this.zenoCanWalk(x, y))
    if (!path || path.length === 0) {
      // Blocked for now (someone's in the way): try again shortly.
      this.zenoNextLitterAt = this.time.now + 5000
      return false
    }
    this.zenoPath = path
    this.zenoOnTrip = false
    this.zenoPlaying = false
    this.zenoLitterTrip = true
    return true
  }

  /** A few seconds sat in the open tray, then out he hops and leaves it for cleaning. */
  private enterLitterBox() {
    this.zenoLitterTrip = false
    this.zenoInBox = true
    this.restZeno(0, 0, true)
    this.zenoRestUntil = Infinity
    this.updateHint()
    this.time.delayedCall(between([3500, 6000]), () => {
      this.zenoInBox = false
      this.litterDirty = true
      this.poop.setVisible(true)
      this.stink.setVisible(true)
      this.zeno.facing = 'down'
      this.setIdle(this.zeno)
      this.zenoNextLitterAt = this.time.now + between(ZENO_LITTER_GAP_MS)
      // Hop straight out onto the floor, so the box is free to be cleaned.
      const out = (Object.keys(DELTAS) as Direction[]).find((d) => {
        const t = { x: this.zeno.tile.x + DELTAS[d].x, y: this.zeno.tile.y + DELTAS[d].y }
        return this.zenoCanWalk(t.x, t.y) && !this.zenoPerches.has(key(t))
      })
      this.zenoRestUntil = 0
      if (out) this.stepZeno(out)
      this.updateHint()
    })
  }

  private stepZeno(direction: Direction) {
    const zeno = this.zeno
    const target = { x: zeno.tile.x + DELTAS[direction].x, y: zeno.tile.y + DELTAS[direction].y }
    zeno.facing = direction
    // Walking into his toy always sends it skittering on ahead.
    if (target.x === this.toyTile.x && target.y === this.toyTile.y) this.batToy(direction)
    this.moveWalker(zeno, target, ZENO_STEP_MS, () => {
      this.setIdle(zeno)
      if (this.zenoLitterTrip && this.zenoPath.length === 0) {
        this.enterLitterBox()
      } else if (this.zenoOnTrip && this.zenoPath.length === 0) {
        this.zenoOnTrip = false
        this.restZeno(5000, 12000, true)
      } else if (this.zenoPlaying && this.zenoPath.length === 0) {
        this.chaseToy()
      }
      this.updateHint()
    })
  }

  /** Go and find the toy, if it's not too far, for a game of bat-and-chase. */
  private playWithToy(): boolean {
    const path = this.findPath([this.toyTile], this.zeno.tile, (x, y) => this.zenoCanWalk(x, y))
    if (!path || path.length === 0 || path.length > ZENO_MAX_TRIP) return false
    this.zenoPath = path
    this.zenoOnTrip = false
    this.zenoPlaying = true
    this.zenoChases = 1 + Math.floor(Math.random() * 3)
    this.zenoNextPlayAt = this.time.now + between(ZENO_PLAY_GAP_MS)
    return true
  }

  /** After a swat, pounce after the toy, or sit down once he's had enough. */
  private chaseToy() {
    const path =
      this.zenoChases > 0 ? this.findPath([this.toyTile], this.zeno.tile, (x, y) => this.zenoCanWalk(x, y)) : null
    if (path && path.length > 0 && path.length <= ZENO_MAX_CHASE) {
      this.zenoChases--
      this.zenoPath = path
      return
    }
    this.zenoPlaying = false
    this.restZeno(3000, 7000, true)
  }

  /**
   * Knock the toy one to three tiles along `direction`, stopping at anything in
   * the way. Against a wall it glances off sideways, so it never gets stuck in
   * a corner for good.
   */
  private batToy(direction: Direction) {
    const sideways: Direction[] = direction === 'up' || direction === 'down' ? ['left', 'right'] : ['up', 'down']
    if (Math.random() < 0.5) sideways.reverse()
    const reach = 1 + Math.floor(Math.random() * 3)
    let dest = this.toyTile
    for (const d of [direction, ...sideways]) {
      const delta = DELTAS[d]
      for (let i = 0; i < reach; i++) {
        const next = { x: dest.x + delta.x, y: dest.y + delta.y }
        if (!this.toyCanLand(next)) break
        dest = next
      }
      if (dest !== this.toyTile) break
    }
    if (dest === this.toyTile) return
    const tiles = Math.abs(dest.x - this.toyTile.x) + Math.abs(dest.y - this.toyTile.y)
    this.toyTile = dest
    const x = dest.x * TILE
    const y = dest.y * TILE
    if (this.reducedMotion) {
      this.toy.setPosition(x, y)
      return
    }
    // The swat lands halfway through his step.
    this.tweens.add({ targets: this.toy, x, y, delay: ZENO_STEP_MS / 2, duration: TOY_SLIDE_MS * tiles, ease: 'Quad.easeOut' })
  }

  /** Plain open floor: not a doorway, not under furniture, not under anyone's feet. */
  private toyCanLand(tile: Point): boolean {
    return cellAt(tile.x, tile.y) === '.' && !this.solid.has(key(tile)) && !this.occupied(tile.x, tile.y)
  }

  /** Stay put for a while, sitting down properly if `sit`. */
  private restZeno(minMs: number, maxMs: number, sit: boolean) {
    this.zenoRestUntil = this.time.now + minMs + Math.random() * (maxMs - minMs)
    if (!sit) return
    const sprite = this.zeno.sprite
    sprite.stop()
    sprite.setFrame('zeno-sit')
    const facing = this.zeno.facing
    sprite.setFlipX(facing === 'left' || (facing !== 'right' && Math.random() < 0.5))
  }

  /** Petting: he turns to the visitor, sits, and a heart floats up. */
  private petZeno() {
    const opposite: Record<Direction, Direction> = { up: 'down', down: 'up', left: 'right', right: 'left' }
    this.zenoPath = []
    this.zenoOnTrip = false
    this.zenoPlaying = false
    if (this.zenoLitterTrip) {
      this.zenoLitterTrip = false
      this.zenoNextLitterAt = this.time.now + 15_000
    }
    if (Math.abs(this.zeno.tile.x - this.player.tile.x) + Math.abs(this.zeno.tile.y - this.player.tile.y) === 1) {
      this.zeno.facing = opposite[this.player.facing]
    }
    this.restZeno(6000, 10000, true)
    const heart = this.add
      .image(this.zeno.sprite.x, this.zeno.sprite.y - TILE, 'zeno-heart')
      .setOrigin(0.5, 1)
      .setDepth(33)
    if (this.reducedMotion) {
      this.time.delayedCall(900, () => heart.destroy())
      return
    }
    this.tweens.add({
      targets: heart,
      y: heart.y - 10,
      alpha: 0,
      duration: 1100,
      ease: 'Sine.easeOut',
      onComplete: () => heart.destroy(),
    })
  }

  // -------------------------------------------------------------------------
  // Interaction

  private targetAt(tile: Point): Target | null {
    if (this.npc.tile.x === tile.x && this.npc.tile.y === tile.y) return { kind: 'npc' }
    if (!this.zenoInBox && this.zeno.tile.x === tile.x && this.zeno.tile.y === tile.y) return { kind: 'zeno' }
    const object = this.objectsByTile.get(key(tile))
    return object ? { kind: 'object', object } : null
  }

  /** Like targetAt, but João's head (which pokes into the tile above him) counts too. */
  private pointerTargetAt(tile: Point): Target | null {
    if (this.npc.tile.x === tile.x && this.npc.tile.y === tile.y + 1) return { kind: 'npc' }
    return this.targetAt(tile)
  }

  private facingTile(): Point {
    const d = DELTAS[this.player.facing]
    return { x: this.player.tile.x + d.x, y: this.player.tile.y + d.y }
  }

  private targetTiles(target: Target): Point[] {
    if (target.kind === 'npc') return [this.npc.tile]
    if (target.kind === 'zeno') return [this.zeno.tile]
    return target.object.tiles
  }

  private targetLabel(target: Target): string {
    if (target.kind === 'npc') return 'Talk to João'
    if (target.kind === 'zeno') return 'Pet Zeno'
    return target.object.label
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
    } else if (target.kind === 'zeno') {
      this.petZeno()
      action = { type: 'dialogue', id: 'zeno' }
    } else if (target.object.id === 'litterbox') {
      action = { type: 'dialogue', id: this.litterDirty ? 'litterbox-dirty' : 'litterbox-clean' }
      this.litterDirty = false
      this.poop.setVisible(false)
      this.stink.setVisible(false)
    } else {
      action = target.object.action
    }
    if (action.type === 'dialogue' && action.id === 'bathroom' && !this.reducedMotion) {
      // Knock knock.
      this.cameras.main.shake(160, 0.003)
    }
    this.cfg.bridge.game.emit('interact', action)
  }

  private handleTap(pointer: Phaser.Input.Pointer) {
    if (!this.inputEnabled) return
    // With the on-screen pad, touches on the house are just looking around.
    if (pointer.wasTouch && !this.tapToMove) return
    const tile = { x: Math.floor(pointer.worldX / TILE), y: Math.floor(pointer.worldY / TILE) }
    const target = this.pointerTargetAt(tile)

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
    this.hoverTarget = this.pointerTargetAt(tile)
    this.input.setDefaultCursor(this.hoverTarget ? 'pointer' : 'default')
    this.updateHint()
  }

  private updateHint() {
    const facing = this.targetAt(this.facingTile())
    const target = this.hoverTarget ?? facing
    this.updateCues(target)
    const hint: Hint | null = target
      ? { label: this.targetLabel(target), hover: this.hoverTarget !== null && target === this.hoverTarget }
      : null
    const signature = hint ? `${hint.label}|${hint.hover}` : ''
    if (signature === this.lastHint) return
    this.lastHint = signature
    this.cfg.bridge.game.emit('hint', hint)
  }

  private updateRoom() {
    const room = roomAt(this.player.tile.x, this.player.tile.y)
    if (!room || room.id === this.currentRoom) return
    this.currentRoom = room.id
    this.cfg.bridge.game.emit('room', room.id)
  }

  private spawnFacing(room: RoomId): Direction {
    return getRoom(room).spawnFacing
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
        const free = this.neighbours([spawn]).find((t) => this.isWalkable(t.x, t.y, this.npc))
        if (free) {
          this.npc.tile = free
          this.npc.sprite.setPosition(free.x * TILE + TILE / 2, (free.y + 1) * TILE)
          this.syncNpcLabel()
        }
      }
      // Zeno too: he just jumps aside.
      if (this.zeno.tile.x === spawn.x && this.zeno.tile.y === spawn.y && !this.zeno.moving && !this.zenoInBox) {
        const free = this.neighbours([spawn]).find((t) => this.zenoCanWalk(t.x, t.y))
        if (free) {
          this.zeno.tile = free
          this.zeno.sprite.setPosition(free.x * TILE + TILE / 2, (free.y + 1) * TILE).setDepth(10 + free.y / 100)
          this.zenoPath = []
          this.zenoPlaying = false
        }
      }
      this.player.tile = { ...spawn }
      this.player.sprite.setPosition(spawn.x * TILE + TILE / 2, (spawn.y + 1) * TILE)
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
      ui.on('night', ({ on, animate }) => this.setNight(on, animate)),
      ui.on('outfit', (outfit) => this.repaintGuest(outfit)),
      ui.on('interactFacing', () => this.interactFacing()),
      ui.on('padDirection', (direction) => {
        // A quick tap that lifts before the next frame still takes one step.
        if (direction) this.queuedStep = direction
        this.padDirection = direction
      }),
      ui.on('tapToMove', (enabled) => {
        this.tapToMove = enabled
        if (!enabled) {
          this.path = []
          this.pendingTarget = null
        }
      }),
      ui.on('inputEnabled', (enabled) => {
        this.inputEnabled = enabled
        this.input.keyboard!.enabled = enabled
        this.input.keyboard!.resetKeys()
        this.path = []
        this.pendingTarget = null
        this.queuedStep = null
        this.queuedInteract = false
        this.padDirection = null
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
