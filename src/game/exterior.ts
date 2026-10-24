import * as Phaser from 'phaser'
import type { Weather } from '@/lib/weather'
import { MAP_HEIGHT, MAP_WIDTH, TILE, cellAt } from './layout'
import { hash, rect, type Ctx } from './pixels'

/**
 * Lisbon outside the balcony, baked once under the house: the calçada street
 * below the railing and the neighbour's terracotta roof beside it, fading into
 * the night further out. Everywhere else the flat sits in the dark. A gull
 * rests on the roof's chimney, and by day, under a calm sky, others glide
 * past, seen only over the street and the roof.
 */

/** The patch of outside that's drawn, in tiles: beside and beyond the balcony. */
const OUTSIDE = { x: 18, y: 0, w: 13, h: 9 }
/** Below this row the cells beside the balcony are the neighbour's roof; above, the street. */
const ROOF_FROM = 2
const BACKGROUND = '#141019'

const ROOF = { base: '#b8583c', dark: '#8f3f2b', light: '#d07454', ridge: 5 }
const CHIMNEY = { x: 25, y: 4 }

/** Covers the flat and the patch outside, with room to spare, for the night's dark. */
export const NIGHT_BOUNDS = {
  x: -30 * TILE,
  y: -10 * TILE,
  w: (MAP_WIDTH + 60) * TILE,
  h: (MAP_HEIGHT + 20) * TILE,
}

/** Open to the sky and drawn: the street and the roof by the balcony. */
export function isOutdoors(tx: number, ty: number) {
  return (
    tx >= OUTSIDE.x && tx < OUTSIDE.x + OUTSIDE.w && ty >= OUTSIDE.y && ty < OUTSIDE.y + OUTSIDE.h && cellAt(tx, ty) === ' '
  )
}

// ---------------------------------------------------------------------------
// Painting

/** Paints the patch onto `ctx`, whose origin is the patch's top-left corner. */
export function paintExterior(ctx: Ctx) {
  ctx.imageSmoothingEnabled = false
  ctx.save()
  ctx.translate(-OUTSIDE.x * TILE, -OUTSIDE.y * TILE)
  for (let ty = OUTSIDE.y; ty < OUTSIDE.y + OUTSIDE.h; ty++) {
    for (let tx = OUTSIDE.x; tx < OUTSIDE.x + OUTSIDE.w; tx++) {
      if (!isOutdoors(tx, ty)) continue
      if (ty < ROOF_FROM) drawCalcada(ctx, tx * TILE, ty * TILE)
      else drawRoof(ctx, tx * TILE, ty * TILE, tx, ty)
    }
  }
  const cx = CHIMNEY.x * TILE + 3
  const cy = CHIMNEY.y * TILE + 6
  drawChimney(ctx, cx, cy)
  drawRestingGull(ctx, cx + 1, cy - 3)
  ctx.restore()
  fadeEdges(ctx)
}

/**
 * Calçada portuguesa four floors down: small white limestone setts with bands
 * of black basalt waving through them, a kerb along the building.
 */
function drawCalcada(ctx: Ctx, ox: number, oy: number) {
  rect(ctx, ox, oy, 16, 16, '#bdb6a6')
  for (let y = 0; y < 16; y += 3) {
    for (let x = (y / 3) % 2 ? 1 : 0; x < 16; x += 3) {
      const wx = ox + x
      const wy = oy + y
      const wave = (wy + 5 * Math.sin((wx * Math.PI) / 24)) % 22
      const dark = wave >= 0 && wave < 5
      const light = hash(wx, wy) > 0.5
      rect(ctx, wx, wy, 2, 2, dark ? (light ? '#4a4850' : '#3b3a40') : light ? '#ece8dd' : '#e2ddd0')
    }
  }
  if (oy / TILE === ROOF_FROM - 1) {
    rect(ctx, ox, oy + 13, 16, 3, '#d8d0bd')
    rect(ctx, ox, oy + 13, 16, 1, '#c4bba6')
  }
  // It's a long way down: the street sits in a little shade.
  rect(ctx, ox, oy, 16, 16, 'rgba(20,14,30,0.12)')
}

/** Curved terracotta tiles in courses, the shaded slope above the ridge and the sunny one below. */
function drawRoof(ctx: Ctx, ox: number, oy: number, tx: number, ty: number) {
  rect(ctx, ox, oy, 16, 16, ROOF.base)
  for (let course = 0; course < 4; course++) {
    const y = oy + course * 4
    const shift = (course + ty) % 2 ? 2 : 0
    for (let x = shift; x < 16; x += 4) {
      rect(ctx, ox + x, y, 1, 3, ROOF.light)
      rect(ctx, ox + x + 2, y + 3, 2, 1, ROOF.dark)
    }
    rect(ctx, ox, y + 3, 16, 1, 'rgba(60,20,10,0.25)')
  }
  if (ty < ROOF.ridge) rect(ctx, ox, oy, 16, 16, 'rgba(40,15,25,0.16)')
  if (ty === ROOF.ridge) {
    rect(ctx, ox, oy, 16, 3, '#d98a66')
    rect(ctx, ox, oy + 3, 16, 1, ROOF.dark)
    for (let x = (tx * 16) % 6; x < 16; x += 6) rect(ctx, ox + x, oy, 1, 3, ROOF.dark)
  }
  // The eave above the street: a gutter along the roof's edge.
  if (ty === ROOF_FROM) {
    rect(ctx, ox, oy, 16, 2, '#7d7a80')
    rect(ctx, ox, oy + 2, 16, 1, 'rgba(0,0,0,0.25)')
  }
}

function drawChimney(ctx: Ctx, x: number, y: number) {
  rect(ctx, x + 2, y + 10, 10, 3, 'rgba(30,10,10,0.25)')
  rect(ctx, x, y, 10, 11, '#ece6d8')
  rect(ctx, x + 7, y, 3, 11, '#cfc6b3')
  rect(ctx, x - 1, y - 2, 12, 3, '#a14a33')
  rect(ctx, x + 2, y - 1, 6, 1, '#3b3540')
}

function drawRestingGull(ctx: Ctx, x: number, y: number) {
  rect(ctx, x + 1, y, 3, 2, '#f4f4f0')
  rect(ctx, x, y + 1, 1, 1, '#e8c33a')
  rect(ctx, x + 2, y + 2, 5, 2, '#f4f4f0')
  rect(ctx, x + 3, y + 2, 4, 1, '#a9b1ba')
  rect(ctx, x + 7, y + 2, 1, 1, '#2b2a33')
}

/** The patch fades into the night to the east and down the roof, rather than stopping dead. */
function fadeEdges(ctx: Ctx) {
  const { width, height } = ctx.canvas
  const east = ctx.createLinearGradient(width - 5 * TILE, 0, width, 0)
  east.addColorStop(0, 'rgba(20,16,25,0)')
  east.addColorStop(1, BACKGROUND)
  ctx.fillStyle = east
  ctx.fillRect(width - 5 * TILE, 0, 5 * TILE, height)
  // The roof's far end, below.
  const south = ctx.createLinearGradient(0, height - 3 * TILE, 0, height)
  south.addColorStop(0, 'rgba(20,16,25,0)')
  south.addColorStop(1, BACKGROUND)
  ctx.fillStyle = south
  ctx.fillRect(0, height - 3 * TILE, width, 3 * TILE)
}

// ---------------------------------------------------------------------------
// The scene layer

/** How grey the patch goes under each sky. */
const TINT: Record<Weather, number> = { clear: 0xffffff, cloudy: 0xd4d6dc, rain: 0xb8bcc6, storm: 0xa2a6b2 }
/** Gaps between gulls, and how fast they glide, in px/s. */
const GULL_GAP_MS: [number, number] = [14_000, 30_000]
const FIRST_GULL_MS: [number, number] = [4_000, 9_000]
const GULL_SPEED: [number, number] = [38, 54]
/** How quickly a gull fades as it crosses into or out of the outdoors, per frame. */
const GULL_FADE = 0.12
const GULL_W = 11
const GULL_H = 15

const between = ([min, max]: [number, number]) => min + Math.random() * (max - min)

/** A gull from above, facing right: wings spread, or raised mid-beat. */
function drawGull(ctx: Ctx, ox: number, raised: boolean) {
  const white = '#f4f4f0'
  const wing = '#a9b1ba'
  rect(ctx, ox, 7, 2, 1, '#c9ced4')
  rect(ctx, ox + 2, 6, 7, 3, white)
  rect(ctx, ox + 8, 6, 2, 2, white)
  rect(ctx, ox + 10, 7, 1, 1, '#e8c33a')
  const reach = raised ? 3 : 5
  for (const dir of [-1, 1]) {
    for (let i = 1; i <= reach; i++) {
      const y = dir < 0 ? 6 - i : 8 + i
      const x = ox + 5 - Math.floor(i / 2)
      rect(ctx, x, y, 3, 1, i === reach ? '#2b2a33' : wing)
    }
  }
}

/**
 * Bakes the patch outside the balcony under the house, and sends a gull
 * gliding past it every so often, by day and under a calm sky, while it's in
 * view. A gull shows only over the street and the roof, fading out over the
 * flat and the dark; `onCry` fires as it comes into sight. Under reduced
 * motion only the resting gull stays.
 */
export class Exterior {
  private image: Phaser.GameObjects.Image
  private night: boolean
  private weather: Weather = 'clear'

  constructor(
    private scene: Phaser.Scene,
    private options: { reducedMotion: boolean; night: boolean; onCry: () => void },
  ) {
    this.night = options.night
    const texture = scene.textures.createCanvas('house-exterior', OUTSIDE.w * TILE, OUTSIDE.h * TILE)!
    paintExterior(texture.getContext())
    texture.refresh()
    this.image = scene.add
      .image(OUTSIDE.x * TILE, OUTSIDE.y * TILE, 'house-exterior')
      .setOrigin(0)
      .setDepth(-1)

    const gull = scene.textures.createCanvas('gull', GULL_W * 2, GULL_H)!
    drawGull(gull.getContext(), 0, false)
    drawGull(gull.getContext(), GULL_W, true)
    gull.add('spread', 0, 0, 0, GULL_W, GULL_H)
    gull.add('raised', 0, GULL_W, 0, GULL_W, GULL_H)
    gull.refresh()

    if (!options.reducedMotion) this.queueGull(between(FIRST_GULL_MS))
  }

  setNight(on: boolean) {
    this.night = on
  }

  setWeather(weather: Weather) {
    this.weather = weather
    this.image.setTint(TINT[weather])
  }

  private calm() {
    return !this.night && (this.weather === 'clear' || this.weather === 'cloudy')
  }

  /** Whether any of the outside patch is on screen. */
  private outsideInView() {
    const view = this.scene.cameras.main.worldView
    return Phaser.Geom.Intersects.RectangleToRectangle(
      view,
      new Phaser.Geom.Rectangle(OUTSIDE.x * TILE, OUTSIDE.y * TILE, OUTSIDE.w * TILE, OUTSIDE.h * TILE),
    )
  }

  private queueGull(delay: number) {
    this.scene.time.delayedCall(delay, () => {
      if (this.calm() && !document.hidden && this.outsideInView()) {
        this.glide()
        if (Math.random() < 0.3) this.scene.time.delayedCall(between([500, 1200]), () => this.glide(true))
      }
      this.queueGull(between(GULL_GAP_MS))
    })
  }

  /** One gull across the view, over the street or the roof, with a lazy flap and a call. */
  private glide(follower = false) {
    const view = this.scene.cameras.main.worldView
    const rightward = Math.random() < 0.5
    const startX = rightward ? view.x - GULL_W : view.right + GULL_W
    const endX = rightward ? view.right + GULL_W : view.x - GULL_W
    const top = OUTSIDE.y * TILE + 6
    const bottom = (OUTSIDE.y + OUTSIDE.h) * TILE - 10
    const startY = top + Math.random() * (bottom - top)
    const endY = Phaser.Math.Clamp(startY + (Math.random() - 0.5) * 3 * TILE, top, bottom)
    const duration = (Math.abs(endX - startX) / between(GULL_SPEED)) * 1000

    const bird = this.scene.add.image(startX, startY, 'gull', 'spread').setDepth(28.6).setFlipX(!rightward).setAlpha(0)
    const shadow = this.scene.add
      .image(startX + 6, startY + 18, 'gull', 'spread')
      .setDepth(1.5)
      .setFlipX(!rightward)
      .setTint(0x000000)
      .setAlpha(0)
    let beat = 0
    let called = follower
    const flap = this.scene.time.addEvent({
      delay: 170,
      loop: true,
      callback: () => {
        // Bursts of flapping between long glides.
        beat = (beat + 1) % 16
        const frame = beat < 6 && beat % 2 ? 'raised' : 'spread'
        bird.setFrame(frame)
        shadow.setFrame(frame)
      },
    })
    this.scene.tweens.add({
      targets: bird,
      x: endX,
      y: endY,
      duration,
      onUpdate: () => {
        const outside = isOutdoors(Math.floor(bird.x / TILE), Math.floor(bird.y / TILE))
        const alpha = Phaser.Math.Clamp(bird.alpha + (outside ? GULL_FADE : -GULL_FADE), 0, 1)
        bird.setAlpha(alpha)
        shadow.setPosition(bird.x + 6, bird.y + 18)
        shadow.setAlpha(isOutdoors(Math.floor(shadow.x / TILE), Math.floor(shadow.y / TILE)) ? alpha * 0.15 : 0)
        if (!called && alpha > 0.5) {
          called = true
          this.options.onCry()
        }
      },
      onComplete: () => {
        flap.remove()
        bird.destroy()
        shadow.destroy()
      },
    })
  }
}
