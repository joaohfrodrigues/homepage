import { reader } from './reader'
import type { GearItem } from './gear'
import { getHobbies } from './hobbies'

// Plex only ever tells us 'film' or 'series' — that enum is fixed in the
// Keystatic schema. The label/slug/order still come from the matching
// "Film"/"Series" hobby entries so a rename there follows through here too.
const FALLBACK_LABEL: Record<'film' | 'series', string> = { film: 'Film', series: 'Series' }

export async function getWatchItems(): Promise<GearItem[]> {
  const [entries, hobbies] = await Promise.all([reader.collections.watchItems.all(), getHobbies()])
  const hobbiesBySlug = new Map(hobbies.map((hobby) => [hobby.slug, hobby]))

  return entries
    .filter((e) => !e.entry.hidden)
    .map((e) => {
      const ratingNote = e.entry.rating != null ? `${e.entry.rating}/10` : ''
      const note = [ratingNote, e.entry.note].filter(Boolean).join(' — ')
      const hobby = hobbiesBySlug.get(e.entry.type)
      const label = hobby?.title ?? FALLBACK_LABEL[e.entry.type]

      return {
        slug: e.slug,
        // Plex's history API rarely populates year at all (only a couple of
        // entries ever have it, when the title itself disambiguates a
        // duplicate show name) — omit it everywhere so every card is
        // consistent rather than showing it for a handful of entries.
        name: e.entry.title,
        category: label,
        photo: e.entry.posterUrl || null,
        note,
        link: '',
        dateAdded: e.entry.watchedAt,
        hobbySlug: hobby?.slug ?? e.entry.type,
        hobbyTitle: label,
        hobbyOrder: hobby?.order ?? 99,
      }
    })
}
