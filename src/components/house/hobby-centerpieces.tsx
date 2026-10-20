import Link from 'next/link'
import type { EventItem } from '@/lib/events'
import type { GearItem } from '@/lib/gear'
import { formatMonthYear } from '@/lib/format-date'
import { cn } from '@/lib/utils'

/*
 * The pixel-art centrepiece at the top of each hobby window — the in-house
 * counterpart of the travel map — with the existing event and gear cards
 * listed underneath it by the page.
 */

const RIBBONS = [
  ['#3f6b8a', '#f4ecd8'],
  ['#c0392b', '#f4ecd8'],
  ['#4f7a3a', '#e8c95a'],
  ['#2a2233', '#c0392b'],
  ['#c9a227', '#3f6b8a'],
] as const

function year(item: EventItem): string {
  return item.dateAdded.slice(0, 4)
}

/** Filled pixel circle as SVG rects, matching the disc() used for the in-game props. */
function PixelDisc({ cx, cy, r, fill }: { cx: number; cy: number; r: number; fill: string }) {
  const rows = []
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.round(Math.sqrt(r * r - dy * dy))
    rows.push(<rect key={dy} x={cx - half} y={cy + dy} width={half * 2} height={1} fill={fill} />)
  }
  return <>{rows}</>
}

/** Running: a medal hanger by the front door, one medal per race. */
export function MedalWall({ events }: { events: EventItem[] }) {
  if (events.length === 0) return null
  return (
    <div className="relative border-4 border-[#2a2233] bg-[#e7bfb4] px-4 pb-5 pt-7">
      <div className="absolute inset-x-4 top-3 h-2 bg-[#6b4a2e]" aria-hidden />
      <ul className="flex flex-wrap justify-center gap-x-6 gap-y-6">
        {events.map((event, i) => {
          const [left, right] = RIBBONS[i % RIBBONS.length]
          return (
            <li key={event.slug} className="flex w-24 flex-col items-center text-center">
              <svg viewBox="0 0 16 26" className="h-20 w-12" style={{ shapeRendering: 'crispEdges' }} aria-hidden>
                <rect x={4} y={0} width={4} height={12} fill={left} />
                <rect x={8} y={0} width={4} height={12} fill={right} />
                <rect x={7} y={10} width={2} height={4} fill="#2a2233" />
                <PixelDisc cx={8} cy={19} r={6} fill="#2a2233" />
                <PixelDisc cx={8} cy={19} r={5} fill="#c9a227" />
                <PixelDisc cx={8} cy={19} r={3} fill="#e8c95a" />
                <rect x={6} y={16} width={2} height={1} fill="#fff3c4" />
              </svg>
              <span className="font-pixel mt-1 text-sm text-[#8e2a20]">{year(event)}</span>
              <span className="font-pixel text-xs leading-tight text-[#2a2233]">{event.name}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Hiking: a wooden trail signpost with a board per hike, pointing alternately left and right. */
export function TrailSign({ events }: { events: EventItem[] }) {
  if (events.length === 0) return null
  return (
    <div className="relative flex flex-col items-center border-4 border-[#2a2233] bg-[#9fc3d6] px-4 pb-0 pt-5">
      <div className="absolute bottom-0 h-full w-4 bg-[#6b4a2e]" aria-hidden />
      <ul className="relative flex w-full max-w-md flex-col gap-3 pb-10">
        {events.map((event, i) => {
          const pointsRight = i % 2 === 0
          return (
            <li
              key={event.slug}
              className={cn(
                'font-pixel border-2 border-[#2a2233] bg-[#b07a4a] px-5 py-2 text-[#f4ecd8]',
                pointsRight ? 'ml-auto mr-0 pr-8' : 'ml-0 mr-auto pl-8',
              )}
              style={{
                width: '80%',
                clipPath: pointsRight
                  ? 'polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)'
                  : 'polygon(14px 0, 100% 0, 100% 100%, 14px 100%, 0 50%)',
              }}
            >
              <span className="block text-base leading-tight">{event.name}</span>
              <span className="block text-xs text-[#f4ecd8]/80">
                {[event.location, year(event)].filter(Boolean).join(' · ')}
              </span>
            </li>
          )
        })}
      </ul>
      <div className="relative h-4 w-full bg-[#4f7a3a]" aria-hidden />
    </div>
  )
}

const POSTER_COLORS = ['#c0392b', '#2f5f63', '#c9a227', '#3f6b8a', '#8e2f35']

/** Drums: gig posters pinned on the study wall. */
export function GigPosters({ events }: { events: EventItem[] }) {
  if (events.length === 0) return null
  return (
    <ul className="grid grid-cols-2 gap-5 border-4 border-[#2a2233] bg-[#3f5a4a] p-5 sm:grid-cols-3 lg:grid-cols-4">
      {events.map((event, i) => (
        <li
          key={event.slug}
          className="flex aspect-[3/4] flex-col justify-between p-3 text-[#f4ecd8] shadow-[4px_4px_0_#1d1a22]"
          style={{
            background: POSTER_COLORS[i % POSTER_COLORS.length],
            transform: `rotate(${i % 2 === 0 ? -1.5 : 1.2}deg)`,
          }}
        >
          <span className="font-pixel text-xs tracking-[0.3em]">LIVE</span>
          <span className="font-pixel text-xl leading-tight sm:text-2xl">{event.name}</span>
          <span className="font-pixel border-t-2 border-dashed border-[#f4ecd8]/60 pt-2 text-xs">
            {formatMonthYear(event.dateAdded)}
            {event.location && <span className="block opacity-80">{event.location}</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Watching: the living-room TV showing whatever was watched last. */
export function NowShowing({ latest }: { latest: GearItem | undefined }) {
  if (!latest) return null
  return (
    <div className="flex flex-col items-center gap-4 border-4 border-[#2a2233] bg-[#efe3c8] p-5 sm:flex-row sm:items-stretch">
      <div className="w-full max-w-sm shrink-0">
        <div className="border-[6px] border-[#2a2233] bg-[#26323f] p-2 shadow-[0_6px_0_#6b4a2e]">
          <div className="flex aspect-video items-center justify-center overflow-hidden bg-[#1d2731]">
            {latest.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={latest.photo} alt={latest.name} className="h-full w-auto object-contain" />
            ) : (
              <span className="font-pixel text-[#a69cba]">No signal</span>
            )}
          </div>
        </div>
        <div className="mx-auto h-3 w-1/2 bg-[#6b4a2e]" aria-hidden />
      </div>
      <div className="flex flex-col justify-center">
        <p className="font-pixel text-xs uppercase tracking-widest text-[#8e2a20]">Now showing</p>
        <p className="font-pixel text-2xl leading-tight">{latest.name}</p>
        <p className="text-sm text-[#6d6359]">
          {[latest.category, formatMonthYear(latest.dateAdded.slice(0, 10)), latest.note].filter(Boolean).join(' · ')}
        </p>
      </div>
    </div>
  )
}

/** Camera: the kit bag laid open, one padded compartment per item. */
export function KitBag({ gear }: { gear: GearItem[] }) {
  if (gear.length === 0) return null
  return (
    <div className="border-4 border-[#2a2233] bg-[#3a3340] p-3">
      <div className="border-2 border-dashed border-[#6d6359] p-3">
        <ul className="grid gap-3 sm:grid-cols-3">
          {gear.map((item) => {
            const isLens = /lens/i.test(item.category)
            return (
              <li key={item.slug} className="flex items-center gap-3 bg-[#2a2233] p-3 text-[#f4ecd8]">
                <svg viewBox="0 0 16 12" className="h-9 w-12 shrink-0" style={{ shapeRendering: 'crispEdges' }} aria-hidden>
                  {isLens ? (
                    <>
                      <rect x={3} y={1} width={10} height={10} fill="#1b1b20" />
                      <rect x={3} y={3} width={10} height={1} fill="#55555f" />
                      <rect x={3} y={7} width={10} height={1} fill="#55555f" />
                      <rect x={13} y={2} width={2} height={8} fill="#3a3a44" />
                    </>
                  ) : (
                    <>
                      <rect x={1} y={2} width={14} height={9} fill="#1b1b20" />
                      <rect x={2} y={1} width={4} height={2} fill="#3a3a44" />
                      <PixelDisc cx={9} cy={6} r={3} fill="#3a3a44" />
                      <PixelDisc cx={9} cy={6} r={2} fill="#14141a" />
                      <rect x={10} y={5} width={1} height={1} fill="#8fb5d6" />
                    </>
                  )}
                </svg>
                <span>
                  <span className="font-pixel block leading-tight">{item.name}</span>
                  <span className="text-xs text-[#a69cba]">{item.category}</span>
                </span>
              </li>
            )
          })}
        </ul>
      </div>
      <Link
        href="/photography"
        scroll={false}
        className="pixel-button mt-3"
      >
        See where it&rsquo;s been → Travel map
      </Link>
    </div>
  )
}
