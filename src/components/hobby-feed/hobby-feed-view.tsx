'use client'

import { useState } from 'react'
import type { HobbyFeedEntry } from '@/lib/hobby-feed'
import { matchesHobbyFeedFilter } from '@/lib/hobby-feed-filter'
import { GearCard } from './gear-card'
import { EventCard } from './event-card'
import { HobbyFilterBar } from './hobby-filter-bar'

function buildFilterQuery(hobbies: ReadonlySet<string>, gearOnly: boolean): string {
  const params = new URLSearchParams()
  if (hobbies.size > 0) params.set('hobby', [...hobbies].join(','))
  if (gearOnly) params.set('gear', '1')
  return params.toString()
}

export function HobbyFeedView({
  feed,
  initialSelectedHobbies,
  initialGearOnly,
}: {
  feed: HobbyFeedEntry[]
  initialSelectedHobbies: string[]
  initialGearOnly: boolean
}) {
  const [selectedHobbies, setSelectedHobbies] = useState(() => new Set(initialSelectedHobbies))
  const [gearOnly, setGearOnly] = useState(initialGearOnly)

  // Filtering runs entirely client-side against the feed already fetched by
  // the server component — a chip click never re-hits the data source.
  // history.replaceState (not the Next.js router) keeps the URL shareable
  // without triggering a server round-trip.
  function applyFilters(hobbies: Set<string>, nextGearOnly: boolean) {
    setSelectedHobbies(hobbies)
    setGearOnly(nextGearOnly)
    const query = buildFilterQuery(hobbies, nextGearOnly)
    window.history.replaceState(null, '', query ? `?${query}` : window.location.pathname)
  }

  function toggleHobby(slug: string) {
    const next = new Set(selectedHobbies)
    if (next.has(slug)) {
      next.delete(slug)
    } else {
      next.add(slug)
    }
    applyFilters(next, gearOnly)
  }

  function toggleGearOnly() {
    applyFilters(selectedHobbies, !gearOnly)
  }

  function clear() {
    applyFilters(new Set(), false)
  }

  const filteredFeed = feed.filter((entry) => matchesHobbyFeedFilter(entry, selectedHobbies, gearOnly))

  return (
    <>
      <HobbyFilterBar
        selectedHobbies={selectedHobbies}
        gearOnly={gearOnly}
        onToggleHobby={toggleHobby}
        onToggleGearOnly={toggleGearOnly}
        onClear={clear}
      />

      <div
        data-testid="hobby-feed"
        className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4"
      >
        {filteredFeed.map((entry) => {
          if (entry.kind === 'event') {
            return <EventCard key={`event-${entry.item.slug}`} item={entry.item} />
          }

          if (entry.kind === 'watch') {
            return <GearCard key={`watch-${entry.item.slug}`} item={entry.item} testId="watch-card" />
          }

          return <GearCard key={`gear-${entry.item.slug}`} item={entry.item} />
        })}
      </div>
    </>
  )
}
