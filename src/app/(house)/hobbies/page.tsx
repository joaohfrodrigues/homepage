import type { Metadata } from 'next'
import Link from 'next/link'
import { getHobbyFeed, getHobbyFilterCategories } from '@/lib/hobby-feed'
import { buildOpenGraphMetadata } from '@/lib/site-config'
import { HobbyFeedView } from '@/components/hobby-feed/hobby-feed-view'
import { HouseOverlay } from '@/components/house/house-overlay'
import { getRoom } from '@/game/layout'
import { TOPICS } from '@/game/topics'

const description = "Out and about."

export const metadata: Metadata = {
  title: 'Hobbies',
  description,
  ...buildOpenGraphMetadata({
    type: 'website',
    title: 'Hobbies',
    description,
    url: '/hobbies',
  }),
}

/**
 * Every hobby at once, as a window over the house: a shortcut to each hobby's
 * own window, then the whole filterable feed of events, gear and watch history.
 */
export default async function HobbiesPage({
  searchParams,
}: {
  searchParams: Promise<{ hobby?: string; gear?: string }>
}) {
  const params = await searchParams
  const initialSelectedHobbies = params.hobby ? params.hobby.split(',').filter(Boolean) : []
  const initialGearOnly = params.gear === '1'

  const feed = await getHobbyFeed()
  const filterCategories = getHobbyFilterCategories(feed)

  return (
    <HouseOverlay eyebrow="Around the house" title="Hobbies">
      <p className="mb-5 text-[#6d6359]">{description} Each hobby has a spot in the house — go to it, or browse everything below.</p>

      <nav aria-label="Hobby windows">
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {TOPICS.filter((topic) => topic.hobbies).map((topic) => (
            <li key={topic.id}>
              <Link href={topic.href} scroll={false} className="pixel-card flex h-full flex-col px-3 py-2">
                <span className="font-pixel text-xs uppercase tracking-widest text-[#8e2a20]">
                  {getRoom(topic.room).name}
                </span>
                <span className="font-pixel text-lg leading-tight">{topic.title} →</span>
                <span className="text-xs text-[#6d6359]">{topic.item}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section className="mt-10" aria-label="Everything">
        <h2 className="font-pixel mb-4 text-xl">Everything</h2>
        <HobbyFeedView
          feed={feed}
          filterCategories={filterCategories}
          initialSelectedHobbies={initialSelectedHobbies}
          initialGearOnly={initialGearOnly}
        />
      </section>
    </HouseOverlay>
  )
}
