import { reader } from './reader'
import { getHobbies } from './hobbies'

const GEAR_IMAGE_PUBLIC_PATH = '/images/gear/'

function resolveImage(filename: string | null | undefined): string | null {
  return filename ? `${GEAR_IMAGE_PUBLIC_PATH}${filename}` : null
}

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
      photo: resolveImage(entry.entry.photo),
      note: entry.entry.note,
      link: entry.entry.link,
      dateAdded: entry.entry.dateAdded ?? '',
      hobbySlug: hobby.slug,
      hobbyTitle: hobby.title,
    })
  }

  return items
}
