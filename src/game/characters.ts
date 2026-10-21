/**
 * The house's people, layered from LimeZu's Modern Interiors character
 * generator pieces (limezu.itch.io). scripts/import_limezu.mjs packs the
 * picked pieces' idle and walk rows into one atlas plus character-pieces.json.
 * Pieces stack body, eyes, outfit, hair, face, hat, all on the same 16x32 grid.
 */
import PIECES from './character-pieces.json'
import type { Direction } from './layout'

export const CHARACTERS_URL = '/house/characters.png'

/** A character frame: a tile wide and two tall, like the pack draws them. */
export const CHAR_W = PIECES.frame.w
export const CHAR_H = PIECES.frame.h
/** Empty rows above the tallest hair and hats; labels and markers sit at this height. */
export const CHAR_HEADROOM = 6
/** Frames per direction in each animation. */
export const CHAR_FRAMES = 6

export type CharacterName = 'joao' | 'guest'
export type CharacterAnim = 'idle' | 'walk'
export const CHARACTER_ANIMS: CharacterAnim[] = ['idle', 'walk']
/** Directions in the order the pack's sheets lay them out. */
export const CHARACTER_DIRECTIONS: Direction[] = ['right', 'up', 'left', 'down']

export type PartName = keyof typeof PIECES.parts
export interface PieceVariant {
  id: string
  slot: number
  swatch: string
}
export interface PieceStyle {
  label: string
  variants: PieceVariant[]
}
export const PARTS = PIECES.parts as Record<PartName, PieceStyle[]>
/** Parts a visitor can go without. */
export const OPTIONAL_PARTS: PartName[] = ['hat', 'face']

/** A person's look: a piece id per part, or null for an optional part left off. */
export type Outfit = Record<PartName, string | null>

export const LOOKS: Record<CharacterName, Outfit> = {
  // Grey cap, dark beard and a teal shirt, as in the About photo.
  joao: { skin: 'Body_02', hair: 'Hairstyle_01_04', outfit: 'Outfit_17_01', face: 'Accessory_13_Beard_01', hat: 'Accessory_04_Snapback_04' },
  guest: { skin: 'Body_03', hair: 'Hairstyle_08_02', outfit: 'Outfit_04_01', face: null, hat: 'Accessory_04_Snapback_01' },
}
export const DEFAULT_OUTFIT: Outfit = LOOKS.guest

const SLOTS = new Map(Object.values(PARTS).flatMap((styles) => styles.flatMap((s) => s.variants.map((v) => [v.id, v.slot] as const))))

/** Where a piece id sits in its part: which style, which colour variant. */
export function findPiece(part: PartName, id: string | null): { style: number; variant: number } | null {
  for (const [style, s] of PARTS[part].entries()) {
    const variant = s.variants.findIndex((v) => v.id === id)
    if (variant >= 0) return { style, variant }
  }
  return null
}

/** Keeps only pieces the wardrobe still offers; anything else falls back to the default. */
export function cleanOutfit(saved: unknown): Outfit {
  const outfit = { ...DEFAULT_OUTFIT }
  if (!saved || typeof saved !== 'object') return outfit
  for (const part of Object.keys(PARTS) as PartName[]) {
    const value = (saved as Record<string, unknown>)[part]
    if (value === null && OPTIONAL_PARTS.includes(part)) outfit[part] = null
    else if (typeof value === 'string' && findPiece(part, value)) outfit[part] = value
  }
  return outfit
}

/** A random look; optional parts are left off about half the time. */
export function randomOutfit(random = Math.random): Outfit {
  const pick = <T,>(items: T[]) => items[Math.floor(random() * items.length)]
  const outfit = {} as Outfit
  for (const part of Object.keys(PARTS) as PartName[]) {
    outfit[part] = OPTIONAL_PARTS.includes(part) && random() < 0.5 ? null : pick(pick(PARTS[part]).variants).id
  }
  return outfit
}

/**
 * Draws one CHAR_W x CHAR_H frame of a look from the atlas image. `frame` is
 * 0..CHAR_FRAMES-1 within the direction's animation.
 */
export function drawCharacter(
  ctx: CanvasRenderingContext2D,
  atlas: CanvasImageSource,
  ox: number,
  oy: number,
  outfit: Outfit,
  direction: Direction,
  anim: CharacterAnim,
  frame: number,
) {
  const col = CHARACTER_DIRECTIONS.indexOf(direction) * CHAR_FRAMES + frame
  const row = anim === 'idle' ? 0 : 1
  const piece = (part: PartName) => (outfit[part] ? SLOTS.get(outfit[part]) : undefined)
  // Bottom to top, as the pack's generator stacks them.
  const stack = [piece('skin'), PIECES.eyes, piece('outfit'), piece('hair'), piece('face'), piece('hat')]
  for (const slot of stack) {
    if (slot === undefined) continue
    const sx = (slot % PIECES.columns) * PIECES.slot.w + col * CHAR_W
    const sy = Math.floor(slot / PIECES.columns) * PIECES.slot.h + row * CHAR_H
    ctx.drawImage(atlas, sx, sy, CHAR_W, CHAR_H, ox, oy, CHAR_W, CHAR_H)
  }
}
