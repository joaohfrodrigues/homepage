import { getLandingHobbies, type HobbySummary } from './hobbies'
import { getGearItems, type GearItem } from './gear'

export type HobbyFeedEntry =
  | { kind: 'hobby'; dateAdded: string; hobby: HobbySummary }
  | { kind: 'gear'; dateAdded: string; item: GearItem }

export async function getHobbyFeed(): Promise<HobbyFeedEntry[]> {
  const [landingHobbies, gearItems] = await Promise.all([getLandingHobbies(), getGearItems()])

  const entries: HobbyFeedEntry[] = [
    ...landingHobbies.map(
      (hobby): HobbyFeedEntry => ({ kind: 'hobby', dateAdded: hobby.dateAdded, hobby })
    ),
    ...gearItems.map((item): HobbyFeedEntry => ({ kind: 'gear', dateAdded: item.dateAdded, item })),
  ]

  return entries.sort((a, b) => b.dateAdded.localeCompare(a.dateAdded))
}
