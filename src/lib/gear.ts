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
}

export type GearCategoryGroup = {
  category: string
  items: GearItem[]
}

export type GearHobbyGroup = {
  hobbySlug: string
  hobbyTitle: string
  categories: GearCategoryGroup[]
}

export async function getGearGroupedByHobby(): Promise<GearHobbyGroup[]> {
  const [gearEntries, hobbies] = await Promise.all([
    reader.collections.gear.all(),
    getHobbies(),
  ])

  const hobbiesBySlug = new Map(hobbies.map((hobby) => [hobby.slug, hobby]))

  const groupsBySlug = new Map<string, Map<string, GearItem[]>>()

  for (const entry of gearEntries) {
    const hobbySlug = entry.entry.hobby
    if (!hobbySlug || !hobbiesBySlug.has(hobbySlug)) continue

    const item: GearItem = {
      slug: entry.slug,
      name: entry.entry.name,
      category: entry.entry.category,
      photo: resolveImage(entry.entry.photo),
      note: entry.entry.note,
      link: entry.entry.link,
    }

    if (!groupsBySlug.has(hobbySlug)) groupsBySlug.set(hobbySlug, new Map())
    const categories = groupsBySlug.get(hobbySlug)!
    if (!categories.has(item.category)) categories.set(item.category, [])
    categories.get(item.category)!.push(item)
  }

  return hobbies
    .filter((hobby) => groupsBySlug.has(hobby.slug))
    .map((hobby) => ({
      hobbySlug: hobby.slug,
      hobbyTitle: hobby.title,
      categories: Array.from(groupsBySlug.get(hobby.slug)!.entries()).map(
        ([category, items]) => ({ category, items })
      ),
    }))
}
