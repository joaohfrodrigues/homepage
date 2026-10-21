import { pick } from './deterministic-pick'

// The house's pixel palette: the medal ribbons, gig posters and brass trim.
const PALETTE = [
  { bg: 'bg-[#4f7a3a]', text: 'text-[#f4ecd8]' },
  { bg: 'bg-[#c0392b]', text: 'text-[#f4ecd8]' },
  { bg: 'bg-[#8e2f35]', text: 'text-[#f4ecd8]' },
  { bg: 'bg-[#3f6b8a]', text: 'text-[#f4ecd8]' },
  { bg: 'bg-[#2f5f63]', text: 'text-[#f4ecd8]' },
  { bg: 'bg-[#c9a227]', text: 'text-[#2a2233]' },
]

export function tagColor(label: string) {
  return pick(label, PALETTE)
}
