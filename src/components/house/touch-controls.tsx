'use client'

import { useEffect, useRef, useState } from 'react'
import type { HouseBridge } from '@/game/bridge'
import type { Direction } from '@/game/layout'
import { cn } from '@/lib/utils'

interface Props {
  bridge: HouseBridge
  /** What A would do right now, if anything; lights the button up. */
  actionLabel: string | null
}

/** How far the knob travels from the centre of the base, in CSS pixels. */
const STICK_RADIUS = 40
/** Wobbles shorter than this don't count as a direction. */
const DEAD_ZONE = 12

interface Stick {
  pointerId: number
  /** Where the thumb landed: the centre of the base. */
  origin: { x: number; y: number }
  /** The knob's offset from the origin, clamped to the base. */
  knob: { x: number; y: number }
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
 * Floating joystick and A button for touch screens. The stick appears wherever
 * a thumb lands on the left half of the screen and snaps to four directions;
 * everything is translucent so the house shows through.
 */
export function TouchControls({ bridge, actionLabel }: Props) {
  const heldRef = useRef<Direction | null>(null)
  // Mirrored in a ref: pointermove can arrive before React re-renders from pointerdown.
  const stickRef = useRef<Stick | null>(null)
  const [stick, setStickState] = useState<Stick | null>(null)

  function setStick(next: Stick | null) {
    stickRef.current = next
    setStickState(next)
  }

  function hold(direction: Direction | null) {
    if (heldRef.current === direction) return
    heldRef.current = direction
    bridge.ui.emit('padDirection', direction)
  }

  // Let go if the controls unmount mid-press (a dialogue opens, say).
  useEffect(() => () => bridge.ui.emit('padDirection', null), [bridge])

  function onDown(e: React.PointerEvent<HTMLDivElement>) {
    if (stickRef.current) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const box = e.currentTarget.getBoundingClientRect()
    // Keep the whole base on screen even when the thumb lands near an edge.
    const origin = {
      x: Math.min(Math.max(e.clientX - box.left, STICK_RADIUS + 8), box.width - STICK_RADIUS - 8),
      y: Math.min(Math.max(e.clientY - box.top, STICK_RADIUS + 8), box.height - STICK_RADIUS - 8),
    }
    setStick({ pointerId: e.pointerId, origin, knob: { x: 0, y: 0 } })
  }

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const stick = stickRef.current
    if (!stick || e.pointerId !== stick.pointerId) return
    const box = e.currentTarget.getBoundingClientRect()
    const dx = e.clientX - box.left - stick.origin.x
    const dy = e.clientY - box.top - stick.origin.y
    setStick({ ...stick, knob: clampToBase(dx, dy) })
    hold(directionOf(dx, dy))
  }

  function onUp(e: React.PointerEvent<HTMLDivElement>) {
    if (stickRef.current?.pointerId !== e.pointerId) return
    setStick(null)
    hold(null)
  }

  // At rest, a faint stick sits bottom-left so visitors know where to put a thumb.
  const base = stick?.origin ?? null
  const direction = stick ? directionOf(stick.knob.x, stick.knob.y) : null

  return (
    <div className="pointer-events-none absolute inset-x-0 top-20 bottom-0 select-none [-webkit-touch-callout:none]" data-testid="touch-controls">
      <div
        role="group"
        aria-label="Joystick: drag to walk"
        className="pointer-events-auto absolute inset-y-0 left-0 w-1/2 touch-none"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div
          className={cn(
            'absolute size-20 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-[#f4ecd8]/35 bg-[#2a2233]/35 transition-opacity',
            base ? 'opacity-100' : 'bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-6 translate-x-0 translate-y-0 opacity-60',
          )}
          style={base ? { left: base.x, top: base.y } : undefined}
        >
          <div
            className={cn(
              'absolute top-1/2 left-1/2 size-9 rounded-full shadow-[0_3px_0_rgba(18,14,24,0.45)]',
              direction ? 'bg-[#e8c95a]/80' : 'bg-[#f4ecd8]/55',
            )}
            style={{
              transform: `translate(calc(-50% + ${stick?.knob.x ?? 0}px), calc(-50% + ${stick?.knob.y ?? 0}px))`,
            }}
          />
        </div>
      </div>

      <button
        type="button"
        aria-label={actionLabel ? `A: ${actionLabel}` : 'A'}
        className={cn(
          'font-pixel pointer-events-auto absolute right-4 bottom-[max(2.5rem,calc(env(safe-area-inset-bottom)+1rem))] flex size-16 touch-none items-center justify-center rounded-full text-xl shadow-[0_3px_0_rgba(18,14,24,0.45)] transition-colors active:translate-y-0.5 active:shadow-none',
          actionLabel ? 'bg-[#8e2a20]/70 text-[#f4ecd8]' : 'bg-[#2a2233]/45 text-[#f4ecd8]/60',
        )}
        onPointerDown={(e) => {
          e.preventDefault()
          bridge.ui.emit('interactFacing')
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        A
      </button>
    </div>
  )
}
