/** "July 2, 2026" — for article publish dates. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/** "Jul 2026" — for hobby/gear feed dates. Empty input yields null. */
export function formatMonthYear(dateOnly: string): string | null {
  if (!dateOnly) return null
  return new Date(`${dateOnly}T00:00:00`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
  })
}
