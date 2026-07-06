import { reader } from './reader'
import type { GearItem } from './gear'
import { HOBBY_FILTER_CATEGORIES } from './hobby-filter-categories'

const CATEGORY_LABEL: Record<'film' | 'series', string> = {
  film: HOBBY_FILTER_CATEGORIES.find((c) => c.slug === 'film')!.label,
  series: HOBBY_FILTER_CATEGORIES.find((c) => c.slug === 'series')!.label,
}

export async function getWatchItems(): Promise<GearItem[]> {
  const entries = await reader.collections.watchItems.all()

  return entries
    .filter((e) => !e.entry.hidden)
    .map((e) => {
      const ratingNote = e.entry.rating != null ? `${e.entry.rating}/10` : ''
      const note = [ratingNote, e.entry.note].filter(Boolean).join(' — ')

      return {
        slug: e.slug,
        // Plex's history API rarely populates year at all (only a couple of
        // entries ever have it, when the title itself disambiguates a
        // duplicate show name) — omit it everywhere so every card is
        // consistent rather than showing it for a handful of entries.
        name: e.entry.title,
        category: CATEGORY_LABEL[e.entry.type],
        photo: e.entry.posterUrl || null,
        note,
        link: '',
        dateAdded: e.entry.watchedAt,
        hobbySlug: e.entry.type,
        hobbyTitle: CATEGORY_LABEL[e.entry.type],
      }
    })
}
