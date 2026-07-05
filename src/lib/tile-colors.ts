export type TileColor = { bg: string; swatch: string }

// Pastel takes on the classic LEGO brick palette (red, yellow, blue, green, orange, black).
const TILE_PALETTE: TileColor[] = [
  { bg: 'bg-red-50 dark:bg-red-950/40', swatch: 'bg-red-300 dark:bg-red-700' },
  { bg: 'bg-yellow-50 dark:bg-yellow-950/40', swatch: 'bg-yellow-300 dark:bg-yellow-700' },
  { bg: 'bg-blue-50 dark:bg-blue-950/40', swatch: 'bg-blue-300 dark:bg-blue-700' },
  { bg: 'bg-green-50 dark:bg-green-950/40', swatch: 'bg-green-300 dark:bg-green-700' },
  { bg: 'bg-orange-50 dark:bg-orange-950/40', swatch: 'bg-orange-300 dark:bg-orange-700' },
  { bg: 'bg-gray-100 dark:bg-gray-800/60', swatch: 'bg-gray-400 dark:bg-gray-600' },
]

/** Assigns each distinct key a different palette color, in order of first appearance. */
export function assignTileColors(keys: string[]): Map<string, TileColor> {
  const uniqueKeys = Array.from(new Set(keys))
  return new Map(uniqueKeys.map((key, i) => [key, TILE_PALETTE[i % TILE_PALETTE.length]]))
}
