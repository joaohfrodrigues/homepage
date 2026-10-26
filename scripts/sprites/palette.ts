/**
 * Checks the furniture against the house palette (src/game/palette.ts) and
 * writes the palette out for pixel editors.
 *
 * Usage:
 *     bun run sprites:palette            # props drawing off the palette, worst first
 *     bun run sprites:palette --all      # every off-palette colour, with its nearest swatch
 *
 * Always rewrites scripts/sprites/house-palette.gpl (GIMP palette: LibreSprite
 * and Pixelorama both load it) and .sprites/palette.png (one swatch per pixel,
 * the "color image" the AI generator is held to).
 */
import { createCanvas } from '@napi-rs/canvas'
import { mkdirSync } from 'node:fs'
import { PALETTE_ENTRIES, PALETTE_HEX, nearestSwatch } from '../../src/game/palette'
import { PROP_NAMES, opaqueColours, renderProp } from './render'

const all = process.argv.includes('--all')

const gpl = [
  'GIMP Palette',
  'Name: Homepage house',
  `Columns: 8`,
  '#',
  ...PALETTE_ENTRIES.map(({ swatch, hex }) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
    return `${String(r).padStart(3)} ${String(g).padStart(3)} ${String(b).padStart(3)}\t${swatch}`
  }),
].join('\n')
await Bun.write('scripts/sprites/house-palette.gpl', gpl + '\n')

mkdirSync('.sprites', { recursive: true })
const strip = createCanvas(PALETTE_ENTRIES.length, 1)
const sctx = strip.getContext('2d')
PALETTE_ENTRIES.forEach(({ hex }, x) => {
  sctx.fillStyle = hex
  sctx.fillRect(x, 0, 1, 1)
})
await Bun.write('.sprites/palette.png', strip.toBuffer('image/png'))

const report = PROP_NAMES.map((name) => {
  const colours = opaqueColours(renderProp(name))
  const total = [...colours.values()].reduce((a, b) => a + b, 0)
  const off = [...colours].filter(([hex]) => !PALETTE_HEX.has(hex))
  return { name, share: off.reduce((sum, [, n]) => sum + n, 0) / total, off }
}).filter((prop) => prop.off.length)

report.sort((a, b) => b.share - a.share)
for (const { name, share, off } of report) {
  console.log(`${name.padEnd(14)} ${(share * 100).toFixed(0).padStart(3)}% off-palette (${off.length} colours)`)
  if (all) {
    for (const [hex, n] of off.sort((a, b) => b[1] - a[1])) {
      const near = nearestSwatch(hex)
      console.log(`    ${hex} ×${String(n).padEnd(4)} → ${near.swatch} ${near.hex}  ΔE ${near.distance.toFixed(1)}`)
    }
  }
}
console.log(`\n${PROP_NAMES.length - report.length}/${PROP_NAMES.length} props are fully on the ${PALETTE_HEX.size}-colour palette.`)
console.log('Wrote scripts/sprites/house-palette.gpl and .sprites/palette.png')
