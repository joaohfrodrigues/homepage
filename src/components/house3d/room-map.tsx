'use client'

import type { RoomId } from '@/game/layout'
import { LAYOUT, type Wall } from '@/game/house3d/layout'
import { ROOM_COLORS } from '../house/directory-panel'
import { PanelWindow } from '../house/panel-window'

interface Props {
  currentRoom: RoomId | null
  onTeleport: (room: RoomId) => void
  onClose: () => void
}

const WIDTH = Math.max(...LAYOUT.rooms.map((r) => r.rect[0] + r.rect[2]))
const HEIGHT = Math.max(...LAYOUT.rooms.map((r) => r.rect[1] + r.rect[3]))
const LINK_COLOR = '#8a7f70'

/** A doorway or opening between two rooms, as a short bar across the wall line. */
function links(wall: Wall) {
  if (!wall.rooms[0] || !wall.rooms[1]) return []
  return wall.openings
    .filter((o) => o.kind !== 'window')
    .map((o) =>
      wall.axis === 'h' ? (
        <rect key={`${wall.id}-${o.from}`} x={o.from} y={wall.at - 0.3} width={o.width} height={0.6} fill={LINK_COLOR} />
      ) : (
        <rect key={`${wall.id}-${o.from}`} x={wall.at - 0.3} y={o.from} width={0.6} height={o.width} fill={LINK_COLOR} />
      ),
    )
}

/**
 * The 3D house's room teleport, like the pixel house's floor plan in the
 * directory: rooms as blocks, doorways between them, the current room outlined.
 */
export function RoomMap({ currentRoom, onTeleport, onClose }: Props) {
  return (
    <PanelWindow title="Jump to a room" eyebrow="Floor plan" width="narrow" onClose={onClose}>
      <svg viewBox={`-0.5 -0.5 ${WIDTH + 1} ${HEIGHT + 1}`} className="w-full bg-[#2a2233]" role="group" aria-label="Floor plan">
        {LAYOUT.rooms.map((room) => {
          const [x, y, w, h] = room.rect
          const go = () => onTeleport(room.id)
          return (
            <g
              key={room.id}
              role="button"
              tabIndex={0}
              aria-label={`Go to the ${room.name.toLowerCase()}`}
              aria-current={room.id === currentRoom ? 'location' : undefined}
              className="cursor-pointer outline-none [&:focus-visible>rect]:opacity-80 [&:hover>rect]:opacity-80"
              onClick={go}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  go()
                }
              }}
            >
              <rect x={x + 0.15} y={y + 0.15} width={w - 0.3} height={h - 0.3} fill={ROOM_COLORS[room.id]} />
              {room.id === currentRoom && (
                <rect x={x + 0.5} y={y + 0.5} width={w - 1} height={h - 1} fill="none" stroke="#c0392b" strokeWidth={0.4} />
              )}
              <text
                x={x + w / 2}
                y={y + h / 2 + 0.4}
                textAnchor="middle"
                // Shrink long names to fit narrow rooms (Pixelify glyphs are ~0.6em wide).
                fontSize={Math.min(1.3, (w - 0.6) / (room.name.length * 0.6))}
                className="font-pixel"
                fill="#2a2233"
              >
                {room.name}
              </text>
            </g>
          )
        })}
        <g aria-hidden>{LAYOUT.walls.flatMap(links)}</g>
      </svg>
      <p className="font-pixel mt-4 text-xs text-[#6d6359]">Tip: press M anywhere in the house to open this.</p>
    </PanelWindow>
  )
}
