import * as Phaser from 'phaser'
import type { Weather } from '@/lib/weather'
import { MAP_HEIGHT, MAP_WIDTH, TILE, cellAt, getRoom } from './layout'
import { isOutdoors } from './exterior'
import { hash } from './pixels'

/** The glass colours drawWindow paints, as RGB. */
const GLASS = [
  [0x9c, 0xcb, 0xe0],
  [0xcb, 0xe7, 0xf2],
]

/** How grey the panes and the balcony go under each sky. */
const TINT: Record<Weather, { panes: number; balcony: number }> = {
  clear: { panes: 0, balcony: 0 },
  cloudy: { panes: 0.55, balcony: 0.12 },
  rain: { panes: 0.7, balcony: 0.2 },
  storm: { panes: 0.85, balcony: 0.28 },
}

/** Drops trickle down the glass slowly and streak past the balcony fast, in px/s. */
const PANE_DROP_SPEED: [number, number] = [6, 18]
const BALCONY_DROP_SPEED: [number, number] = [150, 210]
const BALCONY_DROPS = 28
/** Outside the flat, as thick as on the balcony: this many streaks through each square of OUTDOOR_CELL px. */
const OUTDOOR_CELL = 24
const OUTDOOR_DROPS = 4
/** Gaps between lightning flashes in a storm. */
const LIGHTNING_GAP_MS: [number, number] = [7_000, 18_000]

/** Blends two RGB triples, `t` of the way from `a` to `b`. */
const mixRgb = (a: number[], b: number[], t: number) => a.map((from, i) => Math.round(from + (b[i] - from) * t))

const between = ([min, max]: [number, number]) => min + Math.random() * (max - min)

interface Drop {
  x: number
  /** Start offset within its run, in px. */
  y: number
  speed: number
}

/** A drop on a window pane wraps within the tile row starting at `top`. */
interface PaneDrop extends Drop {
  top: number
}

/** The night sky through the glass: clear, and under cloud. */
const NIGHT_GLASS = { top: [0x12, 0x19, 0x38], bottom: [0x1f, 0x2b, 0x55], overcast: [0x2a, 0x2e, 0x3c] }
/** Roughly one star for every this many pixels of glass. */
const STAR_EVERY = 45
const MOON = { radius: 3, lit: [0xf4, 0xf1, 0xdc], dark: [0x2b, 0x35, 0x5e], halo: [0x2c, 0x3a, 0x6c] }
/** The moon sits in this window (its left column), low in the right-hand pane. */
const MOON_WINDOW = { tx: 8, ty: 1 }

/**
 * Lisbon's sky through the windows and over the balcony: grey glass and drops
 * running down the `W` windows, rain across the balcony and the street and
 * roof beside it and, in a storm, the odd lightning flash. At night the glass
 * goes dark, with stars and the moon in its current phase on a clear night.
 * Sits under the night overlay so the dark still covers it (the moon and stars
 * shine through it); under reduced motion the drops hold still and the
 * lightning stays away.
 */
export class WeatherLayer {
  private weather: Weather = 'clear'
  /** One byte per world pixel: 1 where a window's glass shows. */
  private glass = new Uint8Array(MAP_WIDTH * TILE * MAP_HEIGHT * TILE)
  private paneDrops: PaneDrop[] = []
  private balconyDrops: Drop[] = []
  private balcony: Phaser.Geom.Rectangle
  private paneTint: Phaser.GameObjects.Image
  private nightClear: Phaser.GameObjects.Image
  private nightOvercast: Phaser.GameObjects.Image
  private skyLights: Phaser.Textures.CanvasTexture
  private skyLightsImage: Phaser.GameObjects.Image
  private night = 0
  private moon = -1
  private balconyTint: Phaser.GameObjects.Rectangle
  private paneRain: Phaser.GameObjects.Graphics
  private balconyRain: Phaser.GameObjects.Graphics
  private outdoorRain: Phaser.GameObjects.Graphics
  private flash: Phaser.GameObjects.Rectangle
  private lightning: Phaser.Time.TimerEvent | null = null

  constructor(
    private scene: Phaser.Scene,
    private reducedMotion: boolean,
  ) {
    const width = MAP_WIDTH * TILE
    const height = MAP_HEIGHT * TILE
    const tint = scene.textures.createCanvas('weather-panes', width, height)!
    this.findGlass(tint.getContext(), width)
    tint.refresh()

    // The front railing row and the slab behind it are open to the sky.
    const { rect } = getRoom('balcony')
    this.balcony = new Phaser.Geom.Rectangle(rect.x * TILE, (rect.y - 1) * TILE, (rect.w + 1) * TILE, (rect.h + 1) * TILE)
    for (let i = 0; i < BALCONY_DROPS; i++) {
      this.balconyDrops.push({
        x: this.balcony.x + Math.random() * this.balcony.width,
        y: Math.random() * this.balcony.height,
        speed: between(BALCONY_DROP_SPEED),
      })
    }

    this.paneTint = scene.add.image(0, 0, 'weather-panes').setOrigin(0).setDepth(1).setAlpha(0)
    // The night's glass under the dark, then the moon and stars above it, so they still shine.
    this.paintNightGlass('night-clear', (y) => mixRgb(NIGHT_GLASS.top, NIGHT_GLASS.bottom, (y % TILE) / TILE))
    this.paintNightGlass('night-overcast', () => NIGHT_GLASS.overcast)
    this.nightClear = scene.add.image(0, 0, 'night-clear').setOrigin(0).setDepth(1).setAlpha(0)
    this.nightOvercast = scene.add.image(0, 0, 'night-overcast').setOrigin(0).setDepth(1).setAlpha(0)
    this.skyLights = scene.textures.createCanvas('night-sky-lights', width, height)!
    this.skyLightsImage = scene.add.image(0, 0, 'night-sky-lights').setOrigin(0).setDepth(29.4).setAlpha(0)
    this.paneRain = scene.add.graphics().setDepth(1)
    this.balconyTint = scene.add
      .rectangle(this.balcony.x, this.balcony.y, this.balcony.width, this.balcony.height, 0x6f7480)
      .setOrigin(0)
      .setDepth(28)
      .setAlpha(0)
    this.balconyRain = scene.add.graphics().setDepth(28)
    this.outdoorRain = scene.add.graphics().setDepth(28)
    // Above the night overlay: lightning lights up the dark too.
    this.flash = scene.add
      .rectangle(-20 * TILE, -20 * TILE, (MAP_WIDTH + 40) * TILE, (MAP_HEIGHT + 40) * TILE, 0xeef2ff)
      .setOrigin(0)
      .setDepth(29.5)
      .setAlpha(0)

    scene.events.on(Phaser.Scenes.Events.UPDATE, this.tick, this)
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, this.tick, this))
  }

  set(weather: Weather) {
    this.weather = weather
    this.paneTint.setAlpha(TINT[weather].panes)
    this.balconyTint.setAlpha(TINT[weather].balcony)
    this.lightning?.remove()
    this.lightning = null
    if (weather === 'storm' && !this.reducedMotion) this.queueLightning()
    this.applyNight()
    this.draw(0)
  }

  /** How far into the night it is (0–1), and the moon's age (0 new, 0.5 full). */
  setNight(night: number, moon: number) {
    this.night = night
    // The moon changes too slowly to repaint for less than a few hours of its cycle.
    if (Math.abs(moon - this.moon) > 0.005) {
      this.moon = moon
      this.paintSkyLights()
    }
    this.applyNight()
  }

  private applyNight() {
    const clear = this.weather === 'clear'
    this.nightClear.setAlpha(clear ? this.night : 0)
    this.nightOvercast.setAlpha(clear ? 0 : this.night)
    this.skyLightsImage.setAlpha(clear ? this.night : 0)
  }

  /** Paints every pixel of glass in `colour(y)`, into a texture of its own. */
  private paintNightGlass(key: string, colour: (y: number) => number[]) {
    const width = MAP_WIDTH * TILE
    const texture = this.scene.textures.createCanvas(key, width, MAP_HEIGHT * TILE)!
    const ctx = texture.getContext()
    const image = ctx.createImageData(width, MAP_HEIGHT * TILE)
    this.glass.forEach((isGlass, i) => {
      if (isGlass) image.data.set([...colour(Math.floor(i / width)), 255], i * 4)
    })
    ctx.putImageData(image, 0, 0)
    texture.refresh()
  }

  /** The stars, and the moon lit from the side its phase says, wherever there's glass. */
  private paintSkyLights() {
    const width = MAP_WIDTH * TILE
    const ctx = this.skyLights.getContext()
    const image = ctx.createImageData(width, MAP_HEIGHT * TILE)
    const put = (x: number, y: number, rgb: number[], alpha = 255) => {
      if (this.isGlass(x, y)) image.data.set([...rgb, alpha], (y * width + x) * 4)
    }
    this.glass.forEach((isGlass, i) => {
      if (isGlass && hash(i % width, Math.floor(i / width)) < 1 / STAR_EVERY) {
        put(i % width, Math.floor(i / width), [0xd8, 0xe0, 0xff], 120 + Math.floor(hash(i, 7) * 120))
      }
    })
    const cx = (MOON_WINDOW.tx + 1) * TILE + 8
    const cy = (MOON_WINDOW.ty + 1) * TILE - 2
    const r = MOON.radius
    // A faint halo, then the disc: lit where the terminator says, earthshine elsewhere.
    for (let dy = -r - 2; dy <= r + 2; dy++) {
      for (let dx = -r - 2; dx <= r + 2; dx++) {
        if (Math.hypot(dx, dy) <= r + 2 && Math.hypot(dx, dy) > r + 0.5) put(cx + dx, cy + dy, MOON.halo, 140)
      }
    }
    const terminator = Math.cos(2 * Math.PI * this.moon)
    const waxing = this.moon < 0.5
    for (let dy = -r; dy <= r; dy++) {
      const half = Math.sqrt(r * r - dy * dy)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) > half + 0.3) continue
        const edge = terminator * half
        const lit = waxing ? dx + 0.5 > edge : dx - 0.5 < -edge
        put(cx + dx, cy + dy, lit ? MOON.lit : MOON.dark)
      }
    }
    ctx.putImageData(image, 0, 0)
    this.skyLights.refresh()
  }

  /**
   * Marks the window glass in the baked house (furniture and frames in front
   * of it stay dry) and paints it grey for the cloud tint. Each run of glass
   * in a window gets a few drops of its own.
   */
  private findGlass(tint: CanvasRenderingContext2D, width: number) {
    const base = (this.scene.textures.get('house-base') as Phaser.Textures.CanvasTexture).getContext()
    tint.fillStyle = '#8b909b'
    for (let ty = 0; ty < MAP_HEIGHT; ty++) {
      for (let tx = 0; tx < MAP_WIDTH; tx++) {
        if (cellAt(tx, ty) !== 'W') continue
        const pixels = base.getImageData(tx * TILE, ty * TILE, TILE, TILE).data
        for (let i = 0; i < TILE * TILE; i++) {
          const [r, g, b] = [pixels[i * 4], pixels[i * 4 + 1], pixels[i * 4 + 2]]
          if (!GLASS.some(([gr, gg, gb]) => r === gr && g === gg && b === gb)) continue
          const x = tx * TILE + (i % TILE)
          const y = ty * TILE + Math.floor(i / TILE)
          this.glass[y * width + x] = 1
          tint.fillRect(x, y, 1, 1)
        }
        for (let n = 0; n < 2; n++) {
          this.paneDrops.push({
            x: tx * TILE + 1 + Math.floor(Math.random() * (TILE - 2)),
            y: Math.random() * TILE,
            top: ty * TILE,
            speed: between(PANE_DROP_SPEED),
          })
        }
      }
    }
  }

  private isGlass(x: number, y: number) {
    return this.glass[Math.floor(y) * MAP_WIDTH * TILE + Math.floor(x)] === 1
  }

  private tick(time: number) {
    // Under reduced motion the drops hold still where they fell; the roofs
    // and courtyard still follow the camera.
    if (this.weather !== 'rain' && this.weather !== 'storm') return
    this.draw(this.reducedMotion ? 0 : time)
  }

  private draw(time: number) {
    this.paneRain.clear()
    this.balconyRain.clear()
    this.outdoorRain.clear()
    if (this.weather !== 'rain' && this.weather !== 'storm') return
    const seconds = time / 1000

    // On the glass: a bead with a short wet trail, wrapping within its tile.
    this.paneRain.fillStyle(0xe6f4fa, 0.9)
    for (const drop of this.paneDrops) {
      const y = drop.top + ((drop.y + seconds * drop.speed) % TILE)
      for (let dy = 0; dy < 3; dy++) {
        if (this.isGlass(drop.x, y - dy)) this.paneRain.fillRect(drop.x, Math.floor(y - dy), 1, 1)
      }
    }

    // On the balcony: slanted streaks blown in off the river.
    const { x, y, width, height } = this.balcony
    this.balconyRain.fillStyle(0xcfe3ef, 0.65)
    for (const drop of this.balconyDrops) {
      const fall = (drop.y + seconds * drop.speed) % height
      const dx = x + ((drop.x - x - fall / 4 + width * 4) % width)
      for (let i = 0; i < 4; i++) this.balconyRain.fillRect(Math.floor(dx - i / 4), Math.floor(y + fall - i), 1, 1)
    }

    this.drawOutdoor(seconds)
  }

  /**
   * Rain over the roofs and courtyard in view. Each square of the world has
   * its own few streaks, so they stay put as the camera moves.
   */
  private drawOutdoor(seconds: number) {
    const view = this.scene.cameras.main.worldView
    const [slow, fast] = BALCONY_DROP_SPEED
    this.outdoorRain.fillStyle(0xcfe3ef, 0.6)
    for (let cy = Math.floor(view.y / OUTDOOR_CELL); cy * OUTDOOR_CELL < view.bottom; cy++) {
      for (let cx = Math.floor(view.x / OUTDOOR_CELL); cx * OUTDOOR_CELL < view.right; cx++) {
        for (let n = 0; n < OUTDOOR_DROPS; n++) {
          const seed = hash(cx * OUTDOOR_DROPS + n, cy)
          const fall = (seed * OUTDOOR_CELL * 7 + seconds * (slow + seed * (fast - slow))) % OUTDOOR_CELL
          const x = cx * OUTDOOR_CELL + hash(cy, cx * OUTDOOR_DROPS + n) * OUTDOOR_CELL - fall / 4
          const y = cy * OUTDOOR_CELL + fall
          if (!isOutdoors(Math.floor(x / TILE), Math.floor(y / TILE))) continue
          for (let i = 0; i < 4; i++) this.outdoorRain.fillRect(Math.floor(x - i / 4), Math.floor(y - i), 1, 1)
        }
      }
    }
  }

  /** A rare double flash, then the next one some seconds later. */
  private queueLightning() {
    this.lightning = this.scene.time.delayedCall(between(LIGHTNING_GAP_MS), () => {
      this.scene.tweens.add({
        targets: this.flash,
        alpha: { from: 0.35, to: 0 },
        duration: 220,
        repeat: 1,
        repeatDelay: 90,
      })
      this.queueLightning()
    })
  }
}
