import { mercX, mercY, type MapView } from './map-projection'

/** public/house/world-land.json, packed by scripts/build_house_map.py. */
export interface LandData {
  scale: number
  rings: number[][]
}

export const LAND_URL = '/house/world-land.json'

const SEA = [127, 176, 201]
const SEA_DARK = [111, 160, 188]
const LAND = [233, 217, 166]
const COAST = [92, 70, 50]
export const SEA_CSS = '#7fb0c9'

const SUPERSAMPLE = 8
/** Share of a pixel's samples that must be land for it to count as land. */
const LAND_THRESHOLD = 96 / 255

interface Ring {
  /** Mercator x, y pairs. */
  points: Float64Array
  minX: number
  maxX: number
  minY: number
  maxY: number
}

const decoded = new WeakMap<LandData, Ring[]>()

function decode(land: LandData): Ring[] {
  const cached = decoded.get(land)
  if (cached) return cached
  const rings = land.rings.map((flat) => {
    const points = new Float64Array(flat.length)
    let lon = 0
    let lat = 0
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (let i = 0; i < flat.length; i += 2) {
      lon += flat[i]
      lat += flat[i + 1]
      const x = mercX(lon / land.scale)
      const y = mercY(lat / land.scale)
      points[i] = x
      points[i + 1] = y
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    }
    return { points, minX, maxX, minY, maxY }
  })
  decoded.set(land, rings)
  return rings
}

let landPromise: Promise<LandData> | null = null

/** Fetch the land outlines once per page. */
export function loadLand(): Promise<LandData> {
  landPromise ??= fetch(LAND_URL).then((res) => {
    if (!res.ok) throw new Error(`world map: ${res.status}`)
    return res.json() as Promise<LandData>
  })
  landPromise.catch(() => {
    landPromise = null
  })
  return landPromise
}

let scratch: HTMLCanvasElement | null = null

/**
 * Rasterize the view as `width` x `height` pixel art: land is filled at 8x,
 * then each pixel is land or sea by a hard threshold so the coastline stays
 * crisp, land touching the sea gets an outline, and the sea a sparse dither
 * anchored to the world so it doesn't swim when the view pans.
 */
export function renderMap(land: LandData, view: MapView, width: number, height: number): ImageData {
  const sw = width * SUPERSAMPLE
  const sh = height * SUPERSAMPLE
  scratch ??= document.createElement('canvas')
  scratch.width = sw
  scratch.height = sh
  const ctx = scratch.getContext('2d', { willReadFrequently: true })!
  ctx.clearRect(0, 0, sw, sh)

  const sx = sw / view.w
  const sy = sh / view.h
  ctx.beginPath()
  for (const ring of decode(land)) {
    if (ring.maxX < view.x || ring.minX > view.x + view.w) continue
    if (ring.maxY < view.y || ring.minY > view.y + view.h) continue
    const p = ring.points
    ctx.moveTo((p[0] - view.x) * sx, (p[1] - view.y) * sy)
    for (let i = 2; i < p.length; i += 2) ctx.lineTo((p[i] - view.x) * sx, (p[i + 1] - view.y) * sy)
    ctx.closePath()
  }
  ctx.fillStyle = '#fff'
  ctx.fill('evenodd')

  const samples = ctx.getImageData(0, 0, sw, sh).data
  const isLand = new Uint8Array(width * height)
  const cutoff = LAND_THRESHOLD * 255 * SUPERSAMPLE * SUPERSAMPLE
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0
      for (let dy = 0; dy < SUPERSAMPLE; dy++) {
        let i = ((y * SUPERSAMPLE + dy) * sw + x * SUPERSAMPLE) * 4 + 3
        for (let dx = 0; dx < SUPERSAMPLE; dx++, i += 4) sum += samples[i]
      }
      isLand[y * width + x] = sum >= cutoff ? 1 : 0
    }
  }

  const out = new ImageData(width, height)
  const px = out.data
  const gx0 = Math.floor((view.x / view.w) * width)
  const gy0 = Math.floor((view.y / view.h) * height)
  const sea = (x: number, y: number) => x >= 0 && x < width && y >= 0 && y < height && !isLand[y * width + x]
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let color = SEA
      if (isLand[y * width + x]) {
        color = sea(x + 1, y) || sea(x - 1, y) || sea(x, y + 1) || sea(x, y - 1) ? COAST : LAND
      } else {
        const gx = gx0 + x
        const gy = gy0 + y
        if ((gx + gy * 3) % 11 === 0 && Math.floor(gy / 4) % 2 === 0) color = SEA_DARK
      }
      const i = (y * width + x) * 4
      px[i] = color[0]
      px[i + 1] = color[1]
      px[i + 2] = color[2]
      px[i + 3] = 255
    }
  }
  return out
}
