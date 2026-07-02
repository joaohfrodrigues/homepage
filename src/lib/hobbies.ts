import { reader } from './reader'

const HOBBIES_IMAGE_PUBLIC_PATH = '/images/hobbies/'

function resolveImage(filename: string | null | undefined): string | null {
  return filename ? `${HOBBIES_IMAGE_PUBLIC_PATH}${filename}` : null
}

export type HobbyTile = {
  image: string | null
  caption: string
}

export type HobbySummary = {
  slug: string
  title: string
  blurb: string
  coverImage: string | null
  order: number
  showOnLandingPage: boolean
  dateAdded: string
  tiles: HobbyTile[]
}

export async function getHobbies(): Promise<HobbySummary[]> {
  const entries = await reader.collections.hobbies.all()
  return entries
    .map((e) => ({
      slug: e.slug,
      title: e.entry.title,
      blurb: e.entry.blurb,
      coverImage: resolveImage(e.entry.coverImage),
      order: e.entry.order ?? 99,
      showOnLandingPage: e.entry.showOnLandingPage,
      dateAdded: e.entry.dateAdded ?? '',
      tiles: e.entry.tiles.map((tile) => ({
        image: resolveImage(tile.image),
        caption: tile.caption,
      })),
    }))
    .sort((a, b) => a.order - b.order)
}

export async function getLandingHobbies(): Promise<HobbySummary[]> {
  const hobbies = await getHobbies()
  return hobbies.filter((hobby) => hobby.showOnLandingPage)
}
