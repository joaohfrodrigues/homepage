import { reader } from './reader'
import { getHobbies } from './hobbies'

const EVENTS_IMAGE_PUBLIC_PATH = '/images/events/'

function resolveImage(filename: string | null | undefined): string | null {
  return filename ? `${EVENTS_IMAGE_PUBLIC_PATH}${filename}` : null
}

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
      photo: resolveImage(entry.entry.photo),
      note: entry.entry.note,
      link: entry.entry.link ?? '',
      dateAdded: entry.entry.date ?? '',
      hobbySlug: hobby.slug,
      hobbyTitle: hobby.title,
    })
  }

  return items
}
