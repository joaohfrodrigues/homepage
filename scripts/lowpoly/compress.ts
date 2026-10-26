/**
 * Shrinks the low-poly house's downloads in public/house3d/ after a Blender
 * build (`bun run house3d:compress`):
 *
 * - every GLB the build scripts wrote (house-<room>.glb, joao.glb) is
 *   deduplicated, pruned and meshopt-compressed in place (the page decodes it
 *   with three.js's MeshoptDecoder). Files already compressed are left alone,
 *   so it's safe to run twice;
 * - joao-animations.glb is made from the KayKit Adventurers animation files,
 *   keeping only the clips the page plays (CLIPS).
 *
 * Prints each file's size before and after.
 */

import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { NodeIO, type Document } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, mergeDocuments, meshopt, prune, resample, unpartition } from '@gltf-transform/functions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'

const ROOT = path.resolve(import.meta.dir, '..', '..')
const OUT_DIR = path.join(ROOT, 'public', 'house3d')
const ANIMATIONS = path.join(ROOT, 'assets', 'kaykit', 'adventurers', 'animations', 'Rig_Medium')
const ANIMATION_FILES = ['Rig_Medium_General.glb', 'Rig_Medium_MovementBasic.glb']
/** The clips src/components/house3d/low-poly-house.tsx plays. */
const CLIPS = ['Idle_A', 'Walking_A', 'Interact']

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready])
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder })

const kb = (bytes: number) => `${(bytes / 1024).toFixed(0)} KB`
const compress = (doc: Document) =>
  doc.transform(dedup(), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }))

for (const name of readdirSync(OUT_DIR).filter((f) => f.endsWith('.glb') && f !== 'joao-animations.glb')) {
  const file = path.join(OUT_DIR, name)
  const doc = await io.read(file)
  if (doc.getRoot().listExtensionsUsed().some((e) => e.extensionName === 'EXT_meshopt_compression')) {
    console.log(`${name}: already compressed (${kb(statSync(file).size)})`)
    continue
  }
  const before = statSync(file).size
  await compress(doc)
  await io.write(file, doc)
  console.log(`${name}: ${kb(before)} → ${kb(statSync(file).size)}`)
}

// João's clips: both animation files merged, everything but the clips and the skeleton they move dropped.
const anims = await io.read(path.join(ANIMATIONS, ANIMATION_FILES[0]))
for (const name of ANIMATION_FILES.slice(1)) mergeDocuments(anims, await io.read(path.join(ANIMATIONS, name)))
const before = ANIMATION_FILES.reduce((sum, name) => sum + statSync(path.join(ANIMATIONS, name)).size, 0)
for (const clip of anims.getRoot().listAnimations()) if (!CLIPS.includes(clip.getName())) clip.dispose()
for (const mesh of anims.getRoot().listMeshes()) mesh.dispose()
for (const skin of anims.getRoot().listSkins()) skin.dispose()
await anims.transform(unpartition(), resample(), prune())
await compress(anims)
const out = path.join(OUT_DIR, 'joao-animations.glb')
await io.write(out, anims)
const kept = anims.getRoot().listAnimations().map((a) => a.getName())
console.log(`joao-animations.glb (${kept.join(', ')}): ${kb(before)} → ${kb(statSync(out).size)}`)

const total = readdirSync(OUT_DIR)
  .filter((f) => f.endsWith('.glb'))
  .reduce((sum, f) => sum + statSync(path.join(OUT_DIR, f)).size, 0)
console.log(`public/house3d/ in all: ${kb(total)}`)
