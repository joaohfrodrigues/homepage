import 'server-only'
import { getEventItems, type EventItem } from './events'
import { getGearItems, type GearItem } from './gear'
import { getHobbies } from './hobbies'
import { getWatchItems } from './watch-items'

export interface HobbyWindowContent {
  /** Blurbs from the matching Keystatic hobbies, minus the internal-only ones. */
  blurbs: string[]
  /** Newest first. */
  events: EventItem[]
  gear: GearItem[]
  /** Films and series (from Plex), newest watched first. */
  watched: GearItem[]
}

/** Everything a hobby window shows, filtered to the given Keystatic hobby slugs. */
export async function getHobbyWindowContent(hobbySlugs: string[]): Promise<HobbyWindowContent> {
  const slugs = new Set(hobbySlugs)
  const [hobbies, events, gear, watched] = await Promise.all([
    getHobbies(),
    getEventItems(),
    getGearItems(),
    getWatchItems(),
  ])
  const newestFirst = <T extends { dateAdded: string }>(a: T, b: T) => b.dateAdded.localeCompare(a.dateAdded)

  return {
    // Some hobbies only exist so gear can be tagged against them; their blurb says so.
    blurbs: hobbies
      .filter((hobby) => slugs.has(hobby.slug) && hobby.blurb && !hobby.blurb.startsWith('Internal entry'))
      .map((hobby) => hobby.blurb),
    events: events.filter((item) => slugs.has(item.hobbySlug)).sort(newestFirst),
    gear: gear.filter((item) => slugs.has(item.hobbySlug)).sort(newestFirst),
    watched: watched.filter((item) => slugs.has(item.hobbySlug)).sort(newestFirst),
  }
}
