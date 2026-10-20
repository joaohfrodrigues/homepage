'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { FLOOR_PLAN, MAP_HEIGHT, MAP_WIDTH, ROOMS, type Room, type RoomId } from '@/game/layout'
import { TOPICS } from '@/game/topics'
import { cn } from '@/lib/utils'

interface Props {
  currentRoom: RoomId | null
  onTeleport: (room: RoomId) => void
  onContact: () => void
  onClose: () => void
}

const ROOM_COLORS: Record<RoomId, string> = {
  hall: '#e7bfb4',
  corridor: '#cdb48c',
  living: '#d9b98c',
  kitchen: '#d2ccc1',
  study: '#7f9f88',
  bedroom: '#b9c8b2',
  bathroom: '#c9dbe3',
}

/** The front-door directory and the M-key minimap: the fast path through the house. */
export function DirectoryPanel({ currentRoom, onTeleport, onContact, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="directory-title"
        className="pixel-window relative max-h-[90dvh] w-full max-w-3xl overflow-y-auto p-5 sm:p-7"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation()
            onClose()
          }
        }}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="font-pixel text-xs uppercase tracking-widest text-[#8e2a20]">Directory</p>
            <h2 id="directory-title" className="font-pixel text-2xl">
              Where to?
            </h2>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} className="pixel-button" aria-label="Close directory">
            <X size={14} />
          </button>
        </div>

        <FloorPlan currentRoom={currentRoom} onTeleport={onTeleport} />

        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          {ROOMS.filter((room) => room.listed).map((room) => (
            <section key={room.id}>
              <RoomButton room={room} current={room.id === currentRoom} onClick={() => onTeleport(room.id)} />
              <ul className="mt-1 flex flex-col">
                {TOPICS.filter((topic) => topic.room === room.id).map((topic) => (
                  <li key={topic.id}>
                    <Link
                      href={topic.href}
                      scroll={false}
                      className="flex items-baseline justify-between gap-2 px-3 py-1 text-sm hover:bg-[#ebe0c8]"
                    >
                      <span>{topic.title}</span>
                      <span className="font-pixel shrink-0 text-xs text-[#8a7f70]">{topic.item}</span>
                    </Link>
                  </li>
                ))}
                {room.id === 'living' && (
                  <li>
                    <Link href="/about" scroll={false} className="flex px-3 py-1 text-sm hover:bg-[#ebe0c8]">
                      About João
                    </Link>
                  </li>
                )}
                {room.id === 'hall' && (
                  <li>
                    <button
                      type="button"
                      onClick={onContact}
                      className="flex w-full items-baseline justify-between gap-2 px-3 py-1 text-left text-sm hover:bg-[#ebe0c8]"
                    >
                      <span>Contact</span>
                      <span className="font-pixel shrink-0 text-xs text-[#8a7f70]">The post</span>
                    </button>
                  </li>
                )}
              </ul>
            </section>
          ))}
        </div>
        <p className="font-pixel mt-6 text-xs text-[#6d6359]">Tip: press M anywhere in the house to open this.</p>
      </div>
    </div>
  )
}

function RoomButton({ room, current, onClick }: { room: Room; current: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('flex w-full flex-col px-3 py-2 text-left hover:bg-[#ebe0c8]', current && 'bg-[#ebe0c8]')}
    >
      <span className="font-pixel text-lg">
        {room.name} {current ? <span className="text-xs text-[#8e2a20]">· you are here</span> : '→'}
      </span>
      <span className="text-xs text-[#6d6359]">{room.blurb}</span>
    </button>
  )
}

/** The house plan drawn from the same layout the game uses; open rooms are clickable. */
function FloorPlan({ currentRoom, onTeleport }: { currentRoom: RoomId | null; onTeleport: (room: RoomId) => void }) {
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
        [...row].map((cell, x) =>
          cell === 'D' || cell === 'd' || cell === 'F' ? (
            <rect
              key={`${x},${y}`}
              x={x}
              y={y}
              width={1}
              height={1}
              fill={cell === 'D' ? '#d9b98c' : '#c0392b'}
              aria-hidden
            />
          ) : null,
        ),
      )}
    </svg>
  )
}
