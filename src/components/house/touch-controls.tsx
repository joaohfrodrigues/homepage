'use client'

import { useEffect, useRef, useState } from 'react'
import type { HouseBridge } from '@/game/bridge'
import type { Direction } from '@/game/layout'
import { cn } from '@/lib/utils'

interface Props {
  bridge: HouseBridge
}

/** How far the knob travels from the centre of the base, in CSS pixels. */
const STICK_RADIUS = 40
/** Wobbles shorter than this don't count as a direction. */
const DEAD_ZONE = 12
/** A touch that moves further than this is a drag (the joystick); anything less is a tap. */
const DRAG_THRESHOLD = 10

interface Touch {
  pointerId: number
  /** Where the thumb landed, relative to the layer. */
  start: { x: number; y: number }
  /** Set once the touch turned into a drag: the joystick's centre and knob offset. */
  stick: { origin: { x: number; y: number }; knob: { x: number; y: number } } | null
}

/** The grid only walks in four directions, so the stick snaps to the dominant axis. */
function directionOf(dx: number, dy: number): Direction | null {
  if (Math.hypot(dx, dy) < DEAD_ZONE) return null
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'left' : 'right'
  return dy < 0 ? 'up' : 'down'
}

function clampToBase(dx: number, dy: number) {
  const distance = Math.hypot(dx, dy)
  if (distance <= STICK_RADIUS) return { x: dx, y: dy }
  return { x: (dx / distance) * STICK_RADIUS, y: (dy / distance) * STICK_RADIUS }
}

/**
 * Touch input for the house. Dragging anywhere brings up a floating joystick
 * under the thumb that snaps to four directions; a touch that lifts without
 * dragging is a tap, handed to the scene to walk to the floor or the thing
 * under it. The joystick is translucent so the house shows through.
 */
export function TouchControls({ bridge }: Props) {
  const heldRef = useRef<Direction | null>(null)
  // Mirrored in a ref: pointermove can arrive before React re-renders from pointerdown.
  const touchRef = useRef<Touch | null>(null)
  const [touch, setTouchState] = useState<Touch | null>(null)

  function setTouch(next: Touch | null) {
    touchRef.current = next
    setTouchState(next)
  }

  function hold(direction: Direction | null) {
    if (heldRef.current === direction) return
    heldRef.current = direction
    bridge.ui.emit('padDirection', direction)
  }

  // Let go if the controls unmount mid-drag (a dialogue opens, say).
  useEffect(() => () => bridge.ui.emit('padDirection', null), [bridge])

  function onDown(e: React.PointerEvent<HTMLDivElement>) {
    if (touchRef.current) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const box = e.currentTarget.getBoundingClientRect()
    setTouch({ pointerId: e.pointerId, start: { x: e.clientX - box.left, y: e.clientY - box.top }, stick: null })
  }

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const current = touchRef.current
    if (!current || e.pointerId !== current.pointerId) return
    const box = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - box.left
    const y = e.clientY - box.top
    let stick = current.stick
    if (!stick) {
      if (Math.hypot(x - current.start.x, y - current.start.y) < DRAG_THRESHOLD) return
      // Keep the whole base on screen even when the thumb lands near an edge.
      const origin = {
        x: Math.min(Math.max(current.start.x, STICK_RADIUS + 8), box.width - STICK_RADIUS - 8),
        y: Math.min(Math.max(current.start.y, STICK_RADIUS + 8), box.height - STICK_RADIUS - 8),
      }
      stick = { origin, knob: { x: 0, y: 0 } }
    }
    const dx = x - stick.origin.x
    const dy = y - stick.origin.y
    setTouch({ ...current, stick: { origin: stick.origin, knob: clampToBase(dx, dy) } })
    hold(directionOf(dx, dy))
  }

  function onUp(e: React.PointerEvent<HTMLDivElement>) {
    const current = touchRef.current
    if (current?.pointerId !== e.pointerId) return
    setTouch(null)
    hold(null)
    if (!current.stick && e.type === 'pointerup') bridge.ui.emit('tapAt', { x: e.clientX, y: e.clientY })
  }

  const stick = touch?.stick ?? null
  const direction = stick ? directionOf(stick.knob.x, stick.knob.y) : null

  return (
    <div
      role="group"
      aria-label="Drag to walk, tap to go to things"
      className="absolute inset-x-0 top-20 bottom-0 touch-none select-none [-webkit-touch-callout:none]"
      data-testid="touch-controls"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      {stick && (
        <div
          className="pointer-events-none absolute size-20 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-[#f4ecd8]/35 bg-[#2a2233]/35"
          style={{ left: stick.origin.x, top: stick.origin.y }}
          data-testid="joystick"
        >
          <div
            className={cn(
              'absolute top-1/2 left-1/2 size-9 rounded-full shadow-[0_3px_0_rgba(18,14,24,0.45)]',
              direction ? 'bg-[#e8c95a]/80' : 'bg-[#f4ecd8]/55',
            )}
            style={{ transform: `translate(calc(-50% + ${stick.knob.x}px), calc(-50% + ${stick.knob.y}px))` }}
          />
        </div>
      )}
    </div>
  )
}
