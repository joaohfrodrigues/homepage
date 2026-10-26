'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { FLOOR_PLAN, MAP_HEIGHT, MAP_WIDTH, ROOMS, getRoom, cellAt, isRoomOpen, type RoomId, type UnlockId } from '@/game/layout'
import { TOPICS } from '@/game/topics'
import type { PanelId, VisitTarget } from '@/game/bridge'
import { openPage } from './house-navigation'
import { useEscapeKey } from './panel-window'

interface Props {
  currentRoom: RoomId | null
  night: boolean
  /** What missions have opened: shut rooms show on the plan but can't be jumped to. */
  unlocks: UnlockId[]
  onTeleport: (room: RoomId) => void
  /** Stands the guest at `target`, then runs `then` (opening its page or panel). */
  onVisit: (target: VisitTarget, then: () => void) => void
  onContact: () => void
  onPanel: (panel: PanelId) => void
  onToggleNight: () => void
  onClose: () => void
}

/** Something to go to: what it is, the item in the house that has it, and what opens. */
interface Entry {
  key: string
  title: string
  room: RoomId
  item: string
  target: VisitTarget
  /** A page; otherwise `open` runs once the guest is standing at the item. */
  href?: string
  open?: () => void
}

/** A directory row: a real link for pages, a button for things that open in place. */
function EntryRow({
  primary,
  secondary,
  entry,
  onVisit,
}: {
  primary: string
  secondary: string
  entry: Entry
  onVisit: Props['onVisit']
}) {
  const router = useRouter()
  const className =
    'flex w-full flex-col px-3 py-1 text-left hover:bg-[#ebe0c8] focus-visible:bg-[#ebe0c8] pointer-coarse:min-h-11 pointer-coarse:justify-center'
  const content = (
    <>
      <span className="text-sm">{primary}</span>
      <span className="font-pixel text-xs text-[#8a7f70]">{secondary}</span>
    </>
  )
  if (entry.href) {
    const href = entry.href
    return (
      <li>
        <Link
          href={href}
          scroll={false}
          className={className}
          onClick={(e) => {
            // New-tab and other modified clicks behave like any link.
            if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
            e.preventDefault()
            onVisit(entry.target, () => openPage(router, href))
          }}
        >
          {content}
        </Link>
      </li>
    )
  }
  return (
    <li>
      <button type="button" className={className} onClick={() => onVisit(entry.target, entry.open!)}>
        {content}
      </button>
    </li>
  )
}

/** Each room's walls on the plan: azulejo blue, warm white, terracotta, ochre tile, greens. */
const ROOM_COLORS: Record<RoomId, string> = {
  hall: '#b9cbe0',
  corridor: '#e6dccb',
  living: '#e9c2a6',
  kitchen: '#e4d9b8',
  study: '#7f9f88',
  bedroom: '#c4d8ea',
  bathroom: '#c9dbe3',
  balcony: '#d8d0bd',
}

/** Open doorways, drawn as plain links between rooms. */
const LINK_COLOR = '#8a7f70'
const isLink = (cell: string) => cell === 'D' || cell === 'd'

/**
 * The front-door directory and the M-key minimap: the fast path through the
 * house. Subjects come first, so nobody needs the floor plan to find photos;
 * picking one walks the guest to its item before the page opens.
 */
export function DirectoryPanel({ currentRoom, night, unlocks, onTeleport, onVisit, onContact, onPanel, onToggleNight, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
  }, [])
  useEscapeKey(onClose)

  const topic = (id: (typeof TOPICS)[number]['id']): Entry => {
    const t = TOPICS.find((candidate) => candidate.id === id)!
    return { key: t.id, title: t.title, room: t.room, item: t.item, target: t.id, href: t.href }
  }
  const about: Entry = { key: 'about', title: 'About João', room: 'living', item: 'João', target: 'joao', href: '/about' }
  const contact: Entry = { key: 'contact', title: 'Contact', room: 'hall', item: 'The post', target: 'letterbox', open: onContact }
  const geoguess: Entry = {
    key: 'geoguess',
    title: 'Where was this taken?',
    room: 'kitchen',
    item: 'Fridge magnets',
    target: 'fridge',
    open: () => onPanel('geoguess'),
  }
  const bica: Entry = { key: 'bica', title: 'Pull a bica', room: 'kitchen', item: 'Coffee machine', target: 'coffee', open: () => onPanel('bica') }
  const leaderboards: Entry = {
    key: 'leaderboards',
    title: 'Leaderboards',
    room: 'corridor',
    item: 'Trophy poster',
    target: 'leaderboards',
    open: () => onPanel('leaderboards'),
  }
  const guestbook: Entry = {
    key: 'guestbook',
    title: 'Guestbook',
    room: 'hall',
    item: 'Guestbook',
    target: 'guestbook',
    open: () => onPanel('guestbook'),
  }
  const wardrobe: Entry = {
    key: 'wardrobe',
    title: 'Change outfit',
    room: 'bedroom',
    item: 'Wardrobe',
    target: 'wardrobe',
    open: () => onPanel('wardrobe'),
  }
  const bed: Entry = {
    key: 'bed',
    title: night ? 'Wake up' : 'Nap until evening',
    room: 'bedroom',
    item: 'Bed',
    target: 'bed',
    open: onToggleNight,
  }

  const subjects: Entry[] = [
    about,
    ...TOPICS.map((t) => topic(t.id)),
    contact,
    geoguess,
    bica,
    leaderboards,
    guestbook,
    wardrobe,
    bed,
  ]

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="directory-title"
        className="pixel-window relative max-h-[calc(100dvh-1rem)] w-full max-w-3xl overflow-y-auto p-4 sm:max-h-[90dvh] sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-4 sm:mb-5">
          <div>
            <p className="font-pixel text-xs uppercase tracking-widest text-[#8e2a20]">Directory</p>
            <h2 id="directory-title" className="font-pixel text-2xl">
              What are you after?
            </h2>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} className="pixel-button" aria-label="Close directory">
            <X size={14} />
          </button>
        </div>

        <nav aria-label="Subjects">
          <ul className="grid sm:grid-cols-2 sm:gap-x-4 lg:grid-cols-3">
            {subjects.map((entry) => (
              <EntryRow
                key={entry.key}
                primary={entry.title}
                secondary={`${getRoom(entry.room).name} · ${entry.item}`}
                entry={entry}
                onVisit={onVisit}
              />
            ))}
          </ul>
        </nav>

        <section aria-labelledby="directory-rooms" className="mt-6 border-t-2 border-[#d8c8a8] pt-5">
          <h3 id="directory-rooms" className="font-pixel text-lg">
            Or jump to a room
          </h3>
          <div className="mx-auto mt-3 max-w-md">
            <FloorPlan currentRoom={currentRoom} unlocks={unlocks} onTeleport={onTeleport} />
          </div>
        </section>
        <p className="font-pixel mt-6 text-xs text-[#6d6359]">Tip: press M anywhere in the house to open this.</p>
        <p className="mt-2 text-xs text-[#6d6359]">
          Characters, plants, rugs and the bed from{' '}
          <a href="https://limezu.itch.io/moderninteriors" className="underline" target="_blank" rel="noreferrer">
            Modern Interiors by LimeZu
          </a>
          .
        </p>
      </div>
    </div>
  )
}

/** The house plan as room blocks and the doorways between them; open rooms are clickable. */
function FloorPlan({
  currentRoom,
  unlocks,
  onTeleport,
}: {
  currentRoom: RoomId | null
  unlocks: UnlockId[]
  onTeleport: (room: RoomId) => void
}) {
  const opened = new Set(unlocks)
  return (
    <svg
      viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
      className="w-full bg-[#2a2233]"
      style={{ shapeRendering: 'crispEdges' }}
      role="group"
      aria-label="Floor plan"
    >
      {ROOMS.map((room) => {
        const { rect } = room
        const isCurrent = room.id === currentRoom
        const fill = ROOM_COLORS[room.id]
        const label = (
          <text
            x={rect.x + rect.w / 2}
            y={rect.y + rect.h / 2 + 0.5}
            textAnchor="middle"
            // Shrink long names to fit narrow rooms (Pixelify glyphs are ~0.6em wide).
            fontSize={Math.min(rect.h < 4 ? 1.3 : 1.6, (rect.w - 0.5) / (room.name.length * 0.6))}
            className="font-pixel"
            fill="#2a2233"
          >
            {room.name}
          </text>
        )
        const body = (
          <>
            <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} fill={fill} />
            {isCurrent && (
              <rect
                x={rect.x + 0.25}
                y={rect.y + 0.25}
                width={rect.w - 0.5}
                height={rect.h - 0.5}
                fill="none"
                stroke="#c0392b"
                strokeWidth={0.5}
              />
            )}
            {label}
          </>
        )
        if (!isRoomOpen(room, opened)) {
          return (
            <g key={room.id} aria-label={`${room.name} (stuck shut)`} opacity={0.6}>
              {body}
            </g>
          )
        }
        return (
          <g
            key={room.id}
            role="button"
            tabIndex={0}
            aria-label={`Go to the ${room.name.toLowerCase()}`}
            className="cursor-pointer outline-none [&:focus-visible>rect]:opacity-80 [&:hover>rect]:opacity-80"
            onClick={() => onTeleport(room.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onTeleport(room.id)
              }
            }}
          >
            {body}
          </g>
        )
      })}
      {FLOOR_PLAN.flatMap((row, y) =>
        [...row].map((_, x) =>
          isLink(cellAt(x, y, opened)) ? <rect key={`${x},${y}`} x={x} y={y} width={1} height={1} fill={LINK_COLOR} aria-hidden /> : null,
        ),
      )}
    </svg>
  )
}
