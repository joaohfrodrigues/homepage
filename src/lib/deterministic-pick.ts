/** Deterministically picks an item from `palette` based on `seed` — same seed, same item, every time. */
export function pick<T>(seed: string, palette: readonly T[]): T {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return palette[hash % palette.length]
}
