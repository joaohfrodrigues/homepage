import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { EventCard } from '@/components/hobby-feed/event-card'
import { GearCard } from '@/components/hobby-feed/gear-card'
import { HouseOverlay } from '@/components/house/house-overlay'
import {
  GigPosters,
  KitBag,
  MedalWall,
  NowShowing,
  TrailSign,
} from '@/components/house/hobby-centerpieces'
import { getRoom } from '@/game/layout'
import { getHobbyTopic, TOPICS } from '@/game/topics'
import type { EventItem } from '@/lib/events'
import type { GearItem } from '@/lib/gear'
import { getHobbyWindowContent } from '@/lib/hobby-window'
import { buildOpenGraphMetadata } from '@/lib/site-config'

interface Props {
  params: Promise<{ hobby: string }>
}

export function generateStaticParams() {
  return TOPICS.filter((topic) => topic.hobbies).map((topic) => ({
    hobby: topic.href.slice('/hobbies/'.length),
  }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const topic = getHobbyTopic((await params).hobby)
  if (!topic) return { title: 'Not found' }
  return {
    title: topic.title,
    description: topic.look,
    ...buildOpenGraphMetadata({
      type: 'website',
      title: topic.title,
      description: topic.look,
      url: topic.href,
    }),
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10" aria-label={title}>
      <h2 className="font-pixel mb-4 text-xl">{title}</h2>
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">{children}</div>
    </section>
  )
}

function Events({ title, items }: { title: string; items: EventItem[] }) {
  if (items.length === 0) return null
  return (
    <Section title={title}>
      {items.map((item) => (
        <EventCard key={item.slug} item={item} />
      ))}
    </Section>
  )
}

function Gear({ title, items, testId }: { title: string; items: GearItem[]; testId?: string }) {
  if (items.length === 0) return null
  return (
    <Section title={title}>
      {items.map((item) => (
        <GearCard key={item.slug} item={item} testId={testId} />
      ))}
    </Section>
  )
}

/**
 * A hobby as a window over the house: a pixel centrepiece in keeping with the
 * furniture that opened it, then the same event and gear cards /hobbies uses.
 */
export default async function HobbyWindowPage({ params }: Props) {
  const topic = getHobbyTopic((await params).hobby)
  if (!topic?.hobbies) notFound()

  const content = await getHobbyWindowContent(topic.hobbies)
  const { events, gear, watched } = content

  return (
    <HouseOverlay eyebrow={`${getRoom(topic.room).name} · ${topic.item}`} title={topic.title}>
      <p className="mb-2 text-[#6d6359] italic">{topic.look}</p>
      {content.blurbs.map((blurb) => (
        <p key={blurb} className="mb-2 text-[#6d6359]">
          {blurb}
        </p>
      ))}
      <div className="mt-5">
        {topic.id === 'running' && <MedalWall events={events} />}
        {topic.id === 'hiking' && <TrailSign events={events} />}
        {topic.id === 'drums' && <GigPosters events={events} />}
        {topic.id === 'watching' && <NowShowing latest={watched[0]} />}
        {topic.id === 'camera' && <KitBag gear={gear} />}
      </div>

      {topic.id === 'running' && (
        <>
          <Events title="Races" items={events} />
          <Gear title="On the shoe rack" items={gear} />
        </>
      )}
      {topic.id === 'hiking' && (
        <>
          <Events title="Hikes" items={events} />
          <Gear title="In the backpack" items={gear} />
        </>
      )}
      {topic.id === 'drums' && (
        <>
          <Events title="Gigs" items={events} />
          <Gear title="The kit" items={gear} />
        </>
      )}
      {topic.id === 'watching' && (
        <>
          <Gear title="Films" items={watched.filter((item) => item.hobbySlug === 'film')} testId="watch-card" />
          <Gear title="Series" items={watched.filter((item) => item.hobbySlug === 'series')} testId="watch-card" />
        </>
      )}
      {topic.id === 'camera' && <Gear title="In the bag" items={gear} />}
    </HouseOverlay>
  )
}
