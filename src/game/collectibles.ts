import type { DialogueId } from './bridge'

/** Something hidden in the house, found by looking closely at the furniture it's tucked into. */
export interface Collectible {
  id: string
  /** The dialogue that opens when the furniture it's hidden in is used; finding it adds `line`. */
  spot: DialogueId
  line: string
}

/** João's lost drumsticks: one in every room he's had a practice session in his head. */
export const COLLECTIBLES: Collectible[] = [
  { id: 'stick-sofa', spot: 'sofa', line: 'Something’s digging into your back. Down the side of the cushions: a drumstick!' },
  { id: 'stick-drawer', spot: 'drawer', line: 'Under the takeaway menus, rattling about with the spoons: a drumstick.' },
  { id: 'stick-post', spot: 'letterbox', line: 'Tucked in among the envelopes, as if someone meant to post it: a drumstick.' },
  { id: 'stick-bed', spot: 'bed', line: 'There’s something hard under the pillow. A drumstick, of course.' },
  { id: 'stick-balcony', spot: 'balcony', line: 'Stuck upright in the palm’s pot like a garden stake: a drumstick.' },
]

/** What `spot` still hides, if anything. */
export function collectibleAt(spot: DialogueId, found: string[]): Collectible | undefined {
  return COLLECTIBLES.find((item) => item.spot === spot && !found.includes(item.id))
}
