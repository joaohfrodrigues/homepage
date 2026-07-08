import { reader } from './reader'
import { getHobbies } from './hobbies'

export type GearItem = {
  slug: string
  name: string
  category: string
  photo: string | null
  note: string
  link: string
  dateAdded: string
  hobbySlug: string
  hobbyTitle: string
  hobbyOrder: number
}

export async function getGearItems(): Promise<GearItem[]> {
  const [gearEntries, hobbies] = await Promise.all([
    reader.collections.gear.all(),
    getHobbies(),
  ])

  const hobbiesBySlug = new Map(hobbies.map((hobby) => [hobby.slug, hobby]))

  const items: GearItem[] = []
  for (const entry of gearEntries) {
    const hobby = entry.entry.hobby ? hobbiesBySlug.get(entry.entry.hobby) : undefined
    if (!hobby) {
      console.warn(
        `Gear item "${entry.slug}" references unknown hobby "${entry.entry.hobby}" — skipping.`
      )
      continue
    }

    items.push({
      slug: entry.slug,
      name: entry.entry.name,
      category: entry.entry.category,
      photo: entry.entry.photo ?? null,
      note: entry.entry.note,
      link: entry.entry.link ?? '',
      dateAdded: entry.entry.dateAdded ?? '',
      hobbySlug: hobby.slug,
      hobbyTitle: hobby.title,
      hobbyOrder: hobby.order,
    })
  }

  return items
}
