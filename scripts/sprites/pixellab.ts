/**
 * Drafts a sprite with PixelLab's text-to-pixel-art API (pixellab.ai), held to
 * the house palette. Optional: needs your own PIXELLAB_API_KEY in .env, and
 * each call is billed to that account (about $0.01–0.02 an image).
 *
 * Usage:
 *     bun run sprites:ai "a red espresso machine on a counter" --size 16x32
 *     options: --out .sprites/ai.png  --init .sprites/fridge.png (start from an
 *              existing sprite)  --seed 7  --view "high top-down"
 *
 * The draft is a starting point, like a Blender render: snap it with
 * `bun run sprites:grid import .sprites/ai.png`, then clean it up by hand.
 */
import { createCanvas } from '@napi-rs/canvas'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { PALETTE_ENTRIES } from '../../src/game/palette'

const API = 'https://api.pixellab.ai/v2/create-image-pixflux'

const args = process.argv.slice(2)
const option = (name: string) => {
  const i = args.indexOf(`--${name}`)
  if (i < 0) return undefined
  const [value] = args.splice(i, 2).slice(1)
  return value
}
const out = option('out') ?? '.sprites/ai.png'
const [width, height] = (option('size') ?? '16x32').split('x').map(Number)
const init = option('init')
const seed = option('seed')
const view = option('view') ?? 'high top-down'
const description = args.join(' ')

const key = process.env.PIXELLAB_API_KEY
if (!key) {
  console.error('Set PIXELLAB_API_KEY in .env first (create a key at pixellab.ai). See .env.example.')
  process.exit(1)
}
if (!description) {
  console.error('Usage: bun run sprites:ai "<description>" [--size 16x32] [--out file.png] [--init file.png]')
  process.exit(1)
}

// The palette as an image: PixelLab's color_image forces the output onto these colours.
const swatches = createCanvas(PALETTE_ENTRIES.length, 1)
const sctx = swatches.getContext('2d')
PALETTE_ENTRIES.forEach(({ hex }, x) => {
  sctx.fillStyle = hex
  sctx.fillRect(x, 0, 1, 1)
})
const base64Image = (buffer: Buffer | Uint8Array) => ({ type: 'base64', base64: Buffer.from(buffer).toString('base64'), format: 'png' })

const body = {
  description: `${description}, cosy Lisbon flat, pixel art furniture, lit from the top left`,
  image_size: { width, height },
  view,
  outline: 'single color black outline',
  shading: 'medium shading',
  detail: 'medium detail',
  no_background: true,
  color_image: base64Image(swatches.toBuffer('image/png')),
  ...(init ? { init_image: base64Image(new Uint8Array(await Bun.file(init).arrayBuffer())) } : {}),
  ...(seed ? { seed: Number(seed) } : {}),
}

const response = await fetch(API, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})
if (!response.ok) {
  console.error(`PixelLab answered ${response.status}: ${await response.text()}`)
  process.exit(1)
}
const result = (await response.json()) as { image: { base64: string }; usage?: { usd?: number } }
mkdirSync(dirname(out), { recursive: true })
await Bun.write(out, Buffer.from(result.image.base64, 'base64'))
console.log(`Wrote ${out}${result.usage?.usd ? ` ($${result.usage.usd})` : ''}`)
console.log(`Next: bun run sprites:grid import ${out}`)
