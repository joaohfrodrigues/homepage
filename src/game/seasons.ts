/**
 * Seasonal touches: a few props and lines that turn up around the holidays,
 * going by the visitor's own calendar. `?season=xmas` (or any other season,
 * or `none`) previews one whatever the date.
 */

export const SEASONS = ['xmas', 'santos', 'halloween', 'newyear', 'birthday'] as const
export type Season = (typeof SEASONS)[number]

/** João's birthday as month (1-12) and day; the party only happens once it's set. */
const BIRTHDAY: { month: number; day: number } | null = null

/** The season on this local date, or null on an ordinary day. */
export function seasonOn(date: Date): Season | null {
  const month = date.getMonth() + 1
  const day = date.getDate()
  if (BIRTHDAY && month === BIRTHDAY.month && day === BIRTHDAY.day) return 'birthday'
  if ((month === 12 && day === 31) || (month === 1 && day === 1)) return 'newyear'
  // The tree stays up until Dia de Reis, when the last bolo-rei gets eaten.
  if (month === 12 || (month === 1 && day <= 6)) return 'xmas'
  // Santos Populares: the whole of June, with Santo António on the 13th.
  if (month === 6) return 'santos'
  if (month === 10 && day >= 25) return 'halloween'
  return null
}

/** The season to dress the house for: a `?season=` preview if there is one, else the date's. */
export function currentSeason(search: string, date = new Date()): Season | null {
  const preview = new URLSearchParams(search).get('season')
  if (preview === 'none') return null
  if (SEASONS.includes(preview as Season)) return preview as Season
  return seasonOn(date)
}
