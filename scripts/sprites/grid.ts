/**
 * Round-trips furniture between the game and a pixel editor (LibreSprite,
 * Pixelorama, or anything that saves PNG).
 *
 * Usage:
 *     bun run sprites:grid export fridge              # → .sprites/fridge.png, 1px per pixel
 *     bun run sprites:grid import .sprites/fridge.png # → .sprites/fridge.ts, a GridSprite to paste
 *                                                     #   into src/game/sprites/props.ts, and
 *                                                     #   .sprites/fridge.snapped.png to check it
 *
 * Import snaps every opaque pixel to the nearest palette swatch and warns when
 * one is far off (ΔE over 6), so a Blender render or an AI draft comes out on
 * the palette. Fully transparent pixels become '.', translucent ones the drop
 * shadow ','. Load scripts/sprites/house-palette.gpl in the editor to paint with
 * the palette directly.
 */
import { loadImage, createCanvas } from '@napi-rs/canvas'
import { mkdirSync } from 'node:fs'
import { basename, extname } from 'node:path'
import { SHADOW_KEY, TRANSPARENT, drawGrid } from '../../src/game/grid-sprite'
import { nearestSwatch, type Swatch } from '../../src/game/palette'
import type { PropName } from '../../src/game/pixels'
import { PROP_NAMES, asCtx, renderProp, toHex } from './render'

const [command, target, out] = process.argv.slice(2)
mkdirSync('.sprites', { recursive: true })

if (command === 'export') {
  if (!PROP_NAMES.includes(target as PropName)) throw new Error(`No prop called ${target}`)
  const path = out ?? `.sprites/${target}.png`
  await Bun.write(path, renderProp(target as PropName).toBuffer('image/png'))
  console.log(`Wrote ${path}`)
} else if (command === 'import') {
  const image = await loadImage(target)
  const canvas = createCanvas(image.width, image.height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(image, 0, 0)
  const { data } = ctx.getImageData(0, 0, image.width, image.height)

  // Keys: the ramp's initial if it's free (lower case first, then upper), else the next free letter.
  const keyOf = new Map<Swatch, string>()
  const taken = new Set([TRANSPARENT, SHADOW_KEY])
  const pool = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const keyFor = (swatch: Swatch) => {
    let key = keyOf.get(swatch)
    if (!key) {
      const initial = swatch[0]
      key = [initial, initial.toUpperCase(), ...pool].find((k) => !taken.has(k))
      if (!key) throw new Error('More colours than keys; reduce the image to fewer colours first')
      taken.add(key)
      keyOf.set(swatch, key)
    }
    return key
  }

  const far = new Map<string, { swatch: Swatch; distance: number }>()
  const rows: string[] = []
  for (let y = 0; y < image.height; y++) {
    let row = ''
    for (let x = 0; x < image.width; x++) {
      const i = (y * image.width + x) * 4
      const alpha = data[i + 3]
      if (alpha === 0) row += TRANSPARENT
      else if (alpha < 255) row += SHADOW_KEY
      else {
        const hex = toHex(data[i], data[i + 1], data[i + 2])
        const near = nearestSwatch(hex)
        if (near.distance > 6) far.set(hex, near)
        row += keyFor(near.swatch)
      }
    }
    rows.push(row)
  }

  const name = basename(target, extname(target))
  const keyLines = [...keyOf].map(([swatch, key]) => `    ${key}: '${swatch}',`).join('\n')
  const source = `const ${name.replace(/\W+(\w)/g, (_, c: string) => c.toUpperCase())}: GridSprite = {\n  keys: {\n${keyLines}\n  },\n  rows: [\n${rows.map((r) => `    '${r}',`).join('\n')}\n  ],\n}\n`
  const path = out ?? `.sprites/${name}.ts`
  await Bun.write(path, source)
  const snapped = createCanvas(image.width, image.height)
  const keys = Object.fromEntries([...keyOf].map(([swatch, key]) => [key, swatch]))
  drawGrid(asCtx(snapped.getContext('2d')), { keys, rows }, 0, 0)
  await Bun.write(`.sprites/${name}.snapped.png`, snapped.toBuffer('image/png'))
  console.log(`Wrote ${path} and .sprites/${name}.snapped.png: ${image.width}x${image.height}, ${keyOf.size} swatches`)
  if (far.size) {
    // Renders and AI drafts have many near-identical shades; name only the worst few.
    const worst = [...far].sort((a, b) => b[1].distance - a[1].distance).slice(0, 5)
    console.warn(`  ${far.size} colours were far from the palette (ΔE > 6), worst:`)
    for (const [hex, { swatch, distance }] of worst) console.warn(`    ${hex} → ${swatch} (ΔE ${distance.toFixed(1)})`)
  }
} else {
  console.error('Usage: bun run sprites:grid export <prop> [out.png] | import <file.png> [out.ts]')
  process.exit(1)
}
