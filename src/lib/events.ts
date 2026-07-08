import { reader } from './reader'
import { getHobbies } from './hobbies'

export type EventItem = {
  slug: string
  name: string
  location: string
  photo: string | null
  note: string
  link: string
  dateAdded: string
  hobbySlug: string
  hobbyTitle: string
  hobbyOrder: number
}

export async function getEventItems(): Promise<EventItem[]> {
  const [eventEntries, hobbies] = await Promise.all([
    reader.collections.events.all(),
    getHobbies(),
  ])

  const hobbiesBySlug = new Map(hobbies.map((hobby) => [hobby.slug, hobby]))

  const items: EventItem[] = []
  for (const entry of eventEntries) {
    const hobby = entry.entry.hobby ? hobbiesBySlug.get(entry.entry.hobby) : undefined
    if (!hobby) {
      console.warn(
        `Event item "${entry.slug}" references unknown hobby "${entry.entry.hobby}" — skipping.`
      )
      continue
    }

    items.push({
      slug: entry.slug,
      name: entry.entry.name,
      location: entry.entry.location,
      photo: entry.entry.photo ?? null,
      note: entry.entry.note,
      link: entry.entry.link ?? '',
      dateAdded: entry.entry.date ?? '',
      hobbySlug: hobby.slug,
      hobbyTitle: hobby.title,
      hobbyOrder: hobby.order,
    })
  }

  return items
}
