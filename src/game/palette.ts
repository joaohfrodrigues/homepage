/**
 * The house palette: every colour the hand-drawn art may use, in named ramps
 * from dark to light. Taken from the art as it stood (near-duplicates merged),
 * so the existing furniture mostly sits on it already. New art, and anything
 * redrawn as a grid sprite (grid-sprite.ts), uses only these colours; shading
 * one step up or down a ramp keeps light and shadow consistent across props.
 *
 * `bun run sprites:palette` reports what still draws off it, and writes the
 * palette out for LibreSprite / Pixelorama.
 */
export const RAMPS = {
  ink: ['#1f1d24', '#2a2233', '#3a3340', '#4a4458'],
  plum: ['#3b3150', '#574b6e', '#5f5766', '#8a8090'],
  steel: ['#2b2a33', '#3a3a44', '#5a6672', '#8a9099', '#b8bcc4'],
  white: ['#c9c3b5', '#dcdcd4', '#e8e4da', '#f2f2ee', '#fbf7ee'],
  frost: ['#c9dbe3', '#d3dde3', '#e8eef2', '#f4f6f8'],
  cream: ['#a89f91', '#c9bfa9', '#e3d6b4', '#f4ecd8', '#fff1c8'],
  linen: ['#e0d5c2', '#e4ddcc', '#efe7d6', '#f3ece0'],
  walnut: ['#2b1c12', '#4a3122', '#6b4630', '#8a5d3f', '#a2714c'],
  oak: ['#a8835a', '#c29c70', '#caa57a', '#d2ae84', '#dcbb92'],
  ochre: ['#b5803e', '#d39a4e', '#d3ab68'],
  terracotta: ['#7a3d21', '#8c412a', '#a0522d', '#b75d3c', '#e07a3a'],
  brass: ['#c9a227', '#e8c33a', '#e8c95a', '#f0d9a0'],
  red: ['#8e2a20', '#8e2f35', '#c0392b', '#e05a48', '#f08a7a'],
  pink: ['#d97aa8', '#d9a99d', '#e8a0a8', '#e7bfb4'],
  green: ['#1f4a33', '#3b5c2b', '#2f6b45', '#4f7a3a', '#62924a', '#b7d35a'],
  sage: ['#3f5a4a', '#7f9f88', '#a8b2a4', '#c9d6c3'],
  teal: ['#2f5f63', '#7fd1b9'],
  navy: ['#1d2731', '#26323f', '#1f3b4d', '#355a75'],
  blue: ['#3f6b8a', '#3f6fae', '#4b7da0', '#5a88a8', '#6b8aa8'],
  sky: ['#5f8fa8', '#7fb0c9', '#9ccbe0', '#cbe7f2'],
} as const satisfies Record<string, readonly string[]>

export type RampName = keyof typeof RAMPS
/** A palette colour by ramp and step, darkest first: `'walnut.2'`. */
export type Swatch = `${RampName}.${number}`

/** The soft drop shadow laid under furniture; translucent, so it isn't a palette colour. */
export const SHADOW = 'rgba(20, 14, 30, 0.28)'

export function swatch(name: Swatch): string {
  const dot = name.lastIndexOf('.')
  const hex = (RAMPS[name.slice(0, dot) as RampName] as readonly string[] | undefined)?.[Number(name.slice(dot + 1))]
  if (!hex) throw new Error(`No palette colour ${name}`)
  return hex
}

/** Every palette colour with its swatch name, ramp by ramp. */
export const PALETTE_ENTRIES: { swatch: Swatch; hex: string }[] = Object.entries(RAMPS).flatMap(([ramp, hexes]) =>
  hexes.map((hex, step) => ({ swatch: `${ramp}.${step}` as Swatch, hex })),
)

export const PALETTE_HEX: ReadonlySet<string> = new Set(PALETTE_ENTRIES.map((entry) => entry.hex))

/** CIELAB, so "nearest colour" matches what the eye calls near. */
function toLab(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255
    return v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92
  })
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const x = f((r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047)
  const y = f(r * 0.2126 + g * 0.7152 + b * 0.0722)
  const z = f((r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883)
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)]
}

/** The palette colour closest to `hex`, and how far off it is (ΔE; under ~3 is hard to tell apart). */
export function nearestSwatch(hex: string): { swatch: Swatch; hex: string; distance: number } {
  const [l, a, b] = toLab(hex)
  let best = { ...PALETTE_ENTRIES[0], distance: Infinity }
  for (const entry of PALETTE_ENTRIES) {
    const [l2, a2, b2] = toLab(entry.hex)
    const distance = Math.hypot(l - l2, a - a2, b - b2)
    if (distance < best.distance) best = { ...entry, distance }
  }
  return best
}
