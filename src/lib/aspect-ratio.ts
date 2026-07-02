import { pick } from './deterministic-pick'

const PALETTE = ['aspect-[4/3]', 'aspect-square', 'aspect-[3/4]', 'aspect-[4/5]'] as const

export function pickAspectRatio(seed: string): string {
  return pick(seed, PALETTE)
}
