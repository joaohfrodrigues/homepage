/**
 * Contact sheet of the house's furniture: each prop at 1x on the oak floor it
 * stands on, and blown up with a pixel grid (tile edges every 16px in bold).
 * For looking at the art while drawing it, without starting the game.
 *
 * Usage:
 *     bun run sprites:preview                      # every prop
 *     bun run sprites:preview sofa tv desk         # just these
 *     bun run sprites:preview sofa --limezu sofa   # with LimeZu sprites alongside, to compare
 *     bun run sprites:preview --png path/to/a.png  # any PNG, e.g. a Blender render
 *     options: --scale 8 (default 8) --out .sprites/preview.png
 */
import { createCanvas, loadImage, type Canvas, type Image } from '@napi-rs/canvas'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import LIMEZU from '../../src/game/limezu-furniture.json'
import { drawFloor, type PropName } from '../../src/game/pixels'
import { PROP_NAMES, asCtx, renderProp } from './render'

const args = process.argv.slice(2)
const option = (name: string) => {
  const i = args.indexOf(`--${name}`)
  if (i < 0) return undefined
  const [value] = args.splice(i, 2).slice(1)
  return value
}
const scale = Number(option('scale') ?? 8)
const out = option('out') ?? '.sprites/preview.png'
const limezu = option('limezu')?.split(',') ?? []
const png = option('png')
const names = args.length ? (args as PropName[]) : png ? [] : PROP_NAMES
for (const name of names) if (!PROP_NAMES.includes(name)) throw new Error(`No prop called ${name}`)
for (const name of limezu) if (!(name in LIMEZU)) throw new Error(`No LimeZu sprite called ${name}`)

const cells: { label: string; art: Canvas }[] = names.map((name) => ({ label: name, art: renderProp(name) }))
if (limezu.length || png) {
  const crop = (image: Image, x: number, y: number, w: number, h: number) => {
    const canvas = createCanvas(w, h)
    canvas.getContext('2d').drawImage(image, x, y, w, h, 0, 0, w, h)
    return canvas
  }
  if (limezu.length) {
    const atlas = await loadImage('public/house/limezu-furniture.png')
    for (const name of limezu) {
      const { x, y, w, h } = LIMEZU[name as keyof typeof LIMEZU]
      cells.push({ label: `limezu:${name}`, art: crop(atlas, x, y, w, h) })
    }
  }
  if (png) {
    const image = await loadImage(png)
    cells.push({ label: png.split('/').pop()!, art: crop(image, 0, 0, image.width, image.height) })
  }
}

const PAD = 12
const LABEL = 14
const cellW = (art: Canvas) => art.width + PAD + art.width * scale
const cellH = (art: Canvas) => LABEL + Math.max(art.height, art.height * scale)
const COLUMNS = Math.max(1, Math.min(cells.length, Math.floor(1600 / Math.max(...cells.map((c) => cellW(c.art) + PAD)))))
const rows: (typeof cells)[] = []
for (let i = 0; i < cells.length; i += COLUMNS) rows.push(cells.slice(i, i + COLUMNS))
const colW = Math.max(...cells.map((c) => cellW(c.art))) + PAD
const sheet = createCanvas(PAD + COLUMNS * colW, PAD + rows.reduce((sum, row) => sum + Math.max(...row.map((c) => cellH(c.art))) + PAD, 0))
const ctx = sheet.getContext('2d')
ctx.imageSmoothingEnabled = false
ctx.fillStyle = '#20202a'
ctx.fillRect(0, 0, sheet.width, sheet.height)
ctx.font = '11px sans-serif'

let top = PAD
for (const row of rows) {
  row.forEach(({ label, art }, column) => {
    const left = PAD + column * colW
    ctx.fillStyle = '#e8e4da'
    ctx.fillText(`${label}  ${art.width}x${art.height}`, left, top + 10)
    const y = top + LABEL
    // 1x on the floor it would stand on.
    const floor = createCanvas(art.width, art.height)
    for (let ty = 0; ty < art.height; ty += 16) {
      for (let tx = 0; tx < art.width; tx += 16) drawFloor(asCtx(floor.getContext('2d')), tx, ty, 'oak', tx / 16, ty / 16)
    }
    floor.getContext('2d').drawImage(art, 0, 0)
    ctx.drawImage(floor, left, y)
    // Blown up on a checkerboard, so transparency and shadows show.
    const bx = left + art.width + PAD
    for (let py = 0; py < art.height; py++) {
      for (let px = 0; px < art.width; px++) {
        ctx.fillStyle = (px + py) % 2 ? '#3a3a46' : '#44444f'
        ctx.fillRect(bx + px * scale, y + py * scale, scale, scale)
      }
    }
    ctx.drawImage(art, 0, 0, art.width, art.height, bx, y, art.width * scale, art.height * scale)
    for (let px = 0; px <= art.width; px++) {
      ctx.fillStyle = px % 16 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.35)'
      ctx.fillRect(bx + px * scale, y, 1, art.height * scale)
    }
    for (let py = 0; py <= art.height; py++) {
      ctx.fillStyle = py % 16 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.35)'
      ctx.fillRect(bx, y + py * scale, art.width * scale, 1)
    }
  })
  top += Math.max(...row.map((c) => cellH(c.art))) + PAD
}

mkdirSync(dirname(out), { recursive: true })
await Bun.write(out, sheet.toBuffer('image/png'))
console.log(`${cells.length} sprites → ${out}`)
