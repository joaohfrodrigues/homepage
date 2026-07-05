import { getWatchHistory, type WatchEntryType } from './watch-history'
import type { GearItem } from './gear'

const CATEGORY_LABEL: Record<WatchEntryType, string> = {
  film: 'Film',
  series: 'Series',
}

export async function getWatchItems(): Promise<GearItem[]> {
  const history = await getWatchHistory()

  return history.map((entry) => {
    const ratingNote = entry.rating != null ? `${entry.rating}/10` : ''
    const note = [ratingNote, entry.note].filter(Boolean).join(' — ')

    return {
      slug: entry.id,
      name: entry.year ? `${entry.title} (${entry.year})` : entry.title,
      category: CATEGORY_LABEL[entry.type],
      photo: entry.posterUrl,
      note,
      link: '',
      dateAdded: entry.watchedAt,
      hobbySlug: 'watching',
      hobbyTitle: 'Watching',
    }
  })
}
