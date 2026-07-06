import type { HobbyFeedEntry } from './hobby-feed'

// Hobby-chip selection ORs together; the gear-only toggle then ANDs against
// that result, since it's an independent facet (item kind, not a hobby).
// Kept in its own module (only a type-only import of hobby-feed.ts) so client
// components can filter without pulling in the server-only data-fetching code.
export function matchesHobbyFeedFilter(
  entry: HobbyFeedEntry,
  selectedHobbies: ReadonlySet<string>,
  gearOnly: boolean
): boolean {
  if (gearOnly && entry.kind !== 'gear') return false
  if (selectedHobbies.size > 0 && !selectedHobbies.has(entry.item.hobbySlug)) return false
  return true
}
