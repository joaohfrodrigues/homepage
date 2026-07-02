const PALETTE = ['aspect-[4/3]', 'aspect-square', 'aspect-[3/4]', 'aspect-[4/5]']

export function pickAspectRatio(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return PALETTE[hash % PALETTE.length]
}
