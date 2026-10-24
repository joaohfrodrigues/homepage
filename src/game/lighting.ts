import * as Phaser from 'phaser'
import type { Weather } from '@/lib/weather'
import { EXTERIOR_BOUNDS, EXTERIOR_LAMPS } from './exterior'
import type { Decor } from './furnishings'
import { FLOOR_PLAN, TILE, cellAt, roomAt, wallPartAt } from './layout'
import { FESTOON_BULBS, type PropName } from './pixels'

/**
 * Light in the house. By day the windows let in soft, neutral light when the
 * sun is out. At night the house sinks into blue and only lamps you can see
 * are on, low and warm: the floor lamps, a pendant over the table, a bedside
 * lamp, a little lamp on the hall console and festoon bulbs on the balcony.
 * The TV and the study's monitor throw a cool fan of light forward rather than
 * a ring. The dark is one canvas with soft holes cut where light falls, so
 * lamps light what's around them instead of glowing on top of it; a faint tint
 * on top gives each its colour.
 */

/** The night's blue, and how much of the scene it covers away from any light. */
const NIGHT = 'rgba(11, 16, 48, 0.64)'
/** How much daylight each sky lets in, as a share of a sunny day's. */
const DAYLIGHT: Record<Weather, number> = { clear: 1, cloudy: 0.3, rain: 0, storm: 0 }

const WARM = 0xffc27a
const SCREEN = 0x9db8ff

type Shape = 'pool' | 'fan' | 'beam'

interface Light {
  /** Anchor in world px: a pool's centre, or the near end of a fan or beam. */
  x: number
  y: number
  shape: Shape
  w: number
  h: number
  /** A fan or beam opening upwards (from a window in the wall below) rather than down. */
  up?: boolean
  colour: number
  /** How much of the night's dark it lifts at its brightest, 0–1. */
  reveal: number
  /** Strength of its colour on top at night. */
  night: number
  /** Strength of its colour by day; windows scale with the sky. */
  day: number
  window?: boolean
  flicker?: boolean
}

/** Light given off by furniture, from the prop's top-left corner. */
const PROP_LIGHTS: Partial<Record<PropName, Omit<Light, 'x' | 'y'> & { dx: number; dy: number }>> = {
  floorlamp: { dx: 8, dy: 6, shape: 'pool', w: 76, h: 64, colour: WARM, reveal: 0.78, night: 0.22, day: 0 },
  pendant: { dx: 8, dy: 16, shape: 'pool', w: 76, h: 60, colour: WARM, reveal: 0.6, night: 0.16, day: 0 },
  console: { dx: 8, dy: 4, shape: 'pool', w: 56, h: 72, colour: WARM, reveal: 0.6, night: 0.18, day: 0 },
  nightstand: { dx: 8, dy: 3, shape: 'pool', w: 54, h: 46, colour: WARM, reveal: 0.72, night: 0.2, day: 0 },
  alarmclock: { dx: 8, dy: 6, shape: 'pool', w: 18, h: 14, colour: 0xff6050, reveal: 0.2, night: 0.25, day: 0 },
  // Screens light the floor in front of them.
  tv: { dx: 32, dy: 40, shape: 'fan', w: 104, h: 92, colour: SCREEN, reveal: 0.5, night: 0.2, day: 0.05, flicker: true },
  desk: { dx: 24, dy: 14, shape: 'fan', w: 60, h: 50, colour: 0xa9c4ff, reveal: 0.42, night: 0.16, day: 0.04 },
}

/** Builds every light in the house from the furniture and the floor plan. */
export function houseLights(decor: Decor[]): Light[] {
  const lights: Light[] = []
  for (const item of decor) {
    if (item.kind !== 'prop') continue
    const spec = PROP_LIGHTS[item.prop]
    if (!spec) continue
    const { dx, dy, ...light } = spec
    lights.push({ ...light, x: item.x * TILE + dx, y: item.y * TILE + dy })
  }
  for (const lamp of EXTERIOR_LAMPS) {
    lights.push({ x: lamp.x, y: lamp.y, shape: 'pool', w: 48, h: 42, colour: WARM, reveal: 0.7, night: 0.3, day: 0 })
  }
  // The festoon bulbs along the balcony railing.
  FLOOR_PLAN.forEach((row, ty) => {
    for (let tx = 0; tx < row.length; tx++) {
      const bulb = row[tx] === '=' ? FESTOON_BULBS.front : row[tx] === '|' ? FESTOON_BULBS.side : null
      if (!bulb) continue
      lights.push({ x: tx * TILE + bulb.x, y: ty * TILE + bulb.y, shape: 'pool', w: 30, h: 26, colour: 0xffd690, reveal: 0.42, night: 0.22, day: 0 })
    }
  })
  lights.push(...windowLights())
  return lights
}

/**
 * Daylight through every window: a fan down the floor from the street windows
 * in the north walls, and a stronger one up from the sunny back windows.
 */
function windowLights(): Light[] {
  const lights: Light[] = []
  FLOOR_PLAN.forEach((row, ty) => {
    for (let tx = 0; tx < row.length; tx++) {
      if (row[tx] !== 'W' || cellAt(tx - 1, ty) === 'W') continue
      const x = (tx + 1) * TILE
      const part = wallPartAt(tx, ty)
      const base = { x, shape: 'beam' as const, colour: 0xfffaf0, reveal: 0, night: 0, window: true }
      if (part === 'lower') lights.push({ ...base, y: (ty + 1) * TILE, w: 44, h: 72, day: 0.2 })
      else if (part === 'cap' && roomAt(tx, ty - 1)) lights.push({ ...base, y: ty * TILE, w: 44, h: 64, up: true, day: 0.26 })
    }
  })
  return lights
}

/** A soft round pool, white with the brightness in its alpha. */
function poolShape(size: number): HTMLCanvasElement {
  return shape(size, size, (x, y) => {
    const d = Math.min(1, Math.hypot(x - size / 2, y - size / 2) / (size / 2))
    return (1 - d) ** 2
  })
}

/**
 * Light spreading from a source along the top edge, `start` of the width
 * across there (a screen's narrow fan, a window's broad beam), widening and
 * fading as it goes.
 */
function spreadShape(w: number, h: number, start: number, falloff: number): HTMLCanvasElement {
  return shape(w, h, (x, y) => {
    const t = y / h
    const half = (w / 2) * (start + (1 - start) * t)
    const side = Math.abs(x - w / 2) / half
    const edge = side < 0.55 ? 1 : Math.max(0, 1 - (side - 0.55) / 0.45)
    return (1 - t) ** falloff * edge * edge
  })
}

function shape(w: number, h: number, alpha: (x: number, y: number) => number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const image = ctx.createImageData(w, h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      image.data.set([255, 255, 255, Math.round(255 * alpha(x + 0.5, y + 0.5))], i)
    }
  }
  ctx.putImageData(image, 0, 0)
  return canvas
}

export class Lighting {
  private lights: Light[]
  private shapes: Record<Shape, HTMLCanvasElement>
  private dark: Phaser.Textures.CanvasTexture
  private darkImage: Phaser.GameObjects.Image
  private tints: { light: Light; image: Phaser.GameObjects.Image }[] = []
  private night = false
  private weather: Weather = 'clear'
  private flicker = 1

  constructor(
    private scene: Phaser.Scene,
    decor: Decor[],
    reducedMotion: boolean,
  ) {
    this.lights = houseLights(decor)
    this.shapes = { pool: poolShape(64), fan: spreadShape(64, 64, 0.2, 1.6), beam: spreadShape(64, 64, 0.7, 1.3) }
    for (const [name, canvas] of Object.entries(this.shapes)) scene.textures.addCanvas(`light-${name}`, canvas)

    const { x, y, w, h } = EXTERIOR_BOUNDS
    this.dark = scene.textures.createCanvas('night-dark', w, h)!
    this.darkImage = scene.add.image(x, y, 'night-dark').setOrigin(0).setDepth(29).setVisible(false)

    for (const light of this.lights) {
      const image = scene.add
        .image(light.x, light.y, `light-${light.shape}`)
        .setOrigin(0.5, light.shape === 'pool' ? 0.5 : light.up ? 1 : 0)
        .setFlipY(Boolean(light.up))
        .setDisplaySize(light.w, light.h)
        .setTint(light.colour)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(30)
      this.tints.push({ light, image })
    }

    // The TV's picture changes, and its light with it.
    if (!reducedMotion) {
      const flick = () => {
        this.flicker = 0.7 + Math.random() * 0.45
        this.applyTints()
        scene.time.delayedCall(120 + Math.random() * 380, flick)
      }
      flick()
    }
    this.paintDark()
    this.apply()
  }

  setNight(on: boolean) {
    this.night = on
    this.apply()
  }

  setWeather(weather: Weather) {
    this.weather = weather
    this.apply()
  }

  private apply() {
    this.darkImage.setVisible(this.night)
    this.applyTints()
  }

  private applyTints() {
    for (const { light, image } of this.tints) {
      let alpha = this.night ? light.night : light.window ? light.day * DAYLIGHT[this.weather] : light.day
      if (light.flicker) alpha *= this.flicker
      image.setAlpha(alpha).setVisible(alpha > 0)
    }
  }

  /** The night: blue everywhere, with each light's shape cut out of it. */
  private paintDark() {
    const ctx = this.dark.getContext()
    const { x, y } = EXTERIOR_BOUNDS
    ctx.clearRect(0, 0, this.dark.width, this.dark.height)
    ctx.fillStyle = NIGHT
    ctx.fillRect(0, 0, this.dark.width, this.dark.height)
    ctx.globalCompositeOperation = 'destination-out'
    for (const light of this.lights) {
      if (light.reveal <= 0) continue
      ctx.globalAlpha = light.reveal
      ctx.save()
      ctx.translate(light.x - x, light.y - y)
      if (light.shape === 'pool') ctx.drawImage(this.shapes.pool, -light.w / 2, -light.h / 2, light.w, light.h)
      else {
        if (light.up) ctx.scale(1, -1)
        ctx.drawImage(this.shapes[light.shape], -light.w / 2, 0, light.w, light.h)
      }
      ctx.restore()
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    this.dark.refresh()
  }
}
